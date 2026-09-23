-- Allow one player login to own multiple characters across campaign groups.
-- Existing accounts and assignments are preserved. Linked pending characters share
-- one activation, while linked active characters immediately use the existing login.

begin;

-- These one-column unique constraints enforced the original one-login/one-character
-- model. Account-level uniqueness is now guarded by the SECURITY DEFINER functions
-- below, while characters intentionally share user_id and login_username.
alter table public.characters drop constraint if exists characters_user_id_key;
alter table public.characters drop constraint if exists characters_login_username_key;

create index if not exists characters_login_username_idx
  on public.characters(login_username);

-- Keep new-account creation strict now that login_username is intentionally allowed
-- to repeat for characters belonging to the same account.
create or replace function public.dm_create_character(
  p_username text,
  p_activation_code text,
  p_character_name text,
  p_class_key text,
  p_level integer,
  p_campaign_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid;
  v_username text := lower(trim(p_username));
begin
  if not public.is_dm() then raise exception 'Only the DM can create players.'; end if;
  if v_username !~ '^[a-z0-9][a-z0-9_-]{2,31}$' then
    raise exception 'Username must be 3–32 characters using letters, numbers, _ or -.';
  end if;
  if char_length(p_activation_code) < 6 then raise exception 'Activation code must be at least 6 characters.'; end if;
  if p_class_key not in ('artificer','barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard') then raise exception 'Unsupported class.'; end if;
  if p_level not between 1 and 20 then raise exception 'Level must be between 1 and 20.'; end if;
  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and created_by = auth.uid()
  ) then
    raise exception 'Choose one of your campaigns.';
  end if;

  if exists (
    select 1 from public.characters where login_username = v_username
  ) or exists (
    select 1 from public.profiles where username = v_username
  ) or exists (
    select 1 from auth.users where lower(email) = v_username || '@dnd-player.invalid'
  ) then
    raise exception 'That username is already in use. Use Add character on the existing account instead.';
  end if;

  insert into public.characters (
    login_username,
    activation_hash,
    name,
    class_key,
    level,
    campaign_id,
    created_by
  )
  values (
    v_username,
    extensions.crypt(p_activation_code, extensions.gen_salt('bf')),
    trim(p_character_name),
    p_class_key,
    p_level,
    p_campaign_id,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Add a new character without creating another login. This works before or after
-- first-time activation: pending characters copy the one-time credential, while
-- active characters attach directly to the existing profile.
create or replace function public.dm_add_character_to_account(
  p_account_character_id uuid,
  p_character_name text,
  p_class_key text,
  p_level integer,
  p_campaign_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.characters%rowtype;
  v_id uuid;
begin
  if not public.is_dm() then raise exception 'Only the DM can add characters.'; end if;
  if p_class_key not in ('artificer','barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard') then raise exception 'Unsupported class.'; end if;
  if p_level not between 1 and 20 then raise exception 'Level must be between 1 and 20.'; end if;
  if char_length(trim(p_character_name)) not between 1 and 80 then raise exception 'Enter a character name.'; end if;
  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and created_by = auth.uid()
  ) then
    raise exception 'Choose one of your campaigns.';
  end if;

  select character.*
  into v_source
  from public.characters character
  where character.id = p_account_character_id
    and character.created_by = auth.uid()
  for update;

  if not found then raise exception 'The account character could not be found.'; end if;
  if v_source.user_id is null and v_source.activation_hash is null then
    raise exception 'This account has no active login or activation code. Reset its access first.';
  end if;

  insert into public.characters (
    user_id,
    login_username,
    activation_hash,
    name,
    class_key,
    level,
    campaign_id,
    created_by
  )
  values (
    v_source.user_id,
    v_source.login_username,
    case when v_source.user_id is null then v_source.activation_hash else null end,
    trim(p_character_name),
    p_class_key,
    p_level,
    p_campaign_id,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- First-time setup claims every pending character carrying the same validated
-- account username and activation code.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_username text;
  v_code text;
  v_character public.characters%rowtype;
  v_display_name text;
begin
  if lower(new.email) like '%@dnd-player.invalid' then
    v_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))));
    v_code := coalesce(new.raw_user_meta_data ->> 'activation_code', '');

    select character.*
    into v_character
    from public.characters character
    where character.login_username = v_username
      and character.user_id is null
      and character.activation_hash is not null
      and extensions.crypt(v_code, character.activation_hash) = character.activation_hash
    order by character.created_at, character.id
    limit 1
    for update;

    if not found then raise exception 'Invalid username or activation code.'; end if;

    insert into public.profiles (id, username, display_name, role)
    values (new.id, v_username, v_character.name, 'player');

    update public.characters character
    set user_id = new.id,
        activation_hash = null
    where character.login_username = v_username
      and character.user_id is null
      and character.activation_hash is not null
      and extensions.crypt(v_code, character.activation_hash) = character.activation_hash;

    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'activation_code'
    where id = new.id;
  else
    v_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_-]+', '', 'g'));
    if char_length(v_username) < 3 or exists(select 1 from public.profiles where username = v_username) then
      v_username := 'user_' || left(replace(new.id::text, '-', ''), 10);
    end if;
    v_display_name := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1));
    insert into public.profiles (id, username, display_name, role)
    values (new.id, v_username, v_display_name, 'player');
  end if;
  return new;
end;
$$;

-- Password recovery and pre-activation access edits now operate on the whole
-- account group, preserving every linked character and assignment.
create or replace function public.dm_reset_player_login(
  p_character_id uuid,
  p_username text,
  p_activation_code text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_username text := lower(trim(p_username));
  v_old_username text;
  v_user_id uuid;
  v_profile_role text;
  v_character_ids uuid[];
begin
  if not public.is_dm() then raise exception 'Only the DM can reset player access.'; end if;
  if v_username !~ '^[a-z0-9][a-z0-9_-]{2,31}$' then
    raise exception 'Username must be 3–32 characters using letters, numbers, _ or -.';
  end if;
  if char_length(p_activation_code) < 6 then
    raise exception 'Activation code must be at least 6 characters.';
  end if;

  select character.user_id, character.login_username
  into v_user_id, v_old_username
  from public.characters character
  where character.id = p_character_id
    and character.created_by = auth.uid()
  for update;

  if not found then raise exception 'Player not found.'; end if;

  if v_user_id is not null then
    if exists (
      select 1 from public.characters
      where user_id = v_user_id and created_by is distinct from auth.uid()
    ) then
      raise exception 'This account includes a character managed by another DM.';
    end if;

    perform 1 from public.characters
    where user_id = v_user_id and created_by = auth.uid()
    for update;

    select array_agg(character.id order by character.created_at, character.id)
    into v_character_ids
    from public.characters character
    where character.user_id = v_user_id
      and character.created_by = auth.uid();
  else
    perform 1 from public.characters
    where user_id is null
      and login_username = v_old_username
      and created_by = auth.uid()
    for update;

    select array_agg(character.id order by character.created_at, character.id)
    into v_character_ids
    from public.characters character
    where character.user_id is null
      and character.login_username = v_old_username
      and character.created_by = auth.uid();
  end if;

  if coalesce(array_length(v_character_ids, 1), 0) = 0 then
    raise exception 'The player account could not be found.';
  end if;

  if exists (
    select 1
    from public.characters character
    where character.login_username = v_username
      and not (character.id = any(v_character_ids))
  ) then
    raise exception 'That username is already assigned to another account.';
  end if;

  if exists (
    select 1
    from public.profiles profile
    where profile.username = v_username
      and profile.id is distinct from v_user_id
  ) or exists (
    select 1
    from auth.users auth_user
    where lower(auth_user.email) = v_username || '@dnd-player.invalid'
      and auth_user.id is distinct from v_user_id
  ) then
    raise exception 'That username is already in use.';
  end if;

  if v_user_id is not null then
    select profile.role
    into v_profile_role
    from public.profiles profile
    where profile.id = v_user_id;

    if v_profile_role is distinct from 'player' then
      raise exception 'Only player logins can be reset.';
    end if;

    delete from auth.users where id = v_user_id;
    if not found then raise exception 'The linked login could not be found.'; end if;
  end if;

  update public.characters character
  set login_username = v_username,
      activation_hash = extensions.crypt(p_activation_code, extensions.gen_salt('bf'))
  where character.id = any(v_character_ids)
    and character.created_by = auth.uid()
    and character.user_id is null;

  if not found then raise exception 'The player login could not be reset.'; end if;
end;
$$;

-- Keep the older helper safe if it is called directly from an existing client.
create or replace function public.dm_rotate_activation_code(
  p_character_id uuid,
  p_activation_code text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text;
begin
  if not public.is_dm() then raise exception 'Only the DM can replace activation codes.'; end if;
  if char_length(p_activation_code) < 6 then raise exception 'Activation code must be at least 6 characters.'; end if;

  select character.login_username
  into v_username
  from public.characters character
  where character.id = p_character_id
    and character.created_by = auth.uid()
    and character.user_id is null
    and character.activation_hash is not null
  for update;

  if not found then raise exception 'Only an unclaimed player account can receive a new activation code.'; end if;

  update public.characters character
  set activation_hash = extensions.crypt(p_activation_code, extensions.gen_salt('bf'))
  where character.login_username = v_username
    and character.created_by = auth.uid()
    and character.user_id is null;
end;
$$;

grant execute on function public.dm_create_character(text,text,text,text,integer,uuid) to authenticated;
grant execute on function public.dm_add_character_to_account(uuid,text,text,integer,uuid) to authenticated;
grant execute on function public.dm_reset_player_login(uuid,text,text) to authenticated;
grant execute on function public.dm_rotate_activation_code(uuid,text) to authenticated;

revoke execute on function public.dm_create_character(text,text,text,text,integer,uuid) from public, anon;
revoke execute on function public.dm_add_character_to_account(uuid,text,text,integer,uuid) from public, anon;
revoke execute on function public.dm_reset_player_login(uuid,text,text) from public, anon;
revoke execute on function public.dm_rotate_activation_code(uuid,text) from public, anon;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

commit;
