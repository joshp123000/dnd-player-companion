-- Add a DM-controlled account recovery path for players who forget their password.
-- The character and every card assignment stay intact. The old Auth account is
-- removed so the player can safely activate the character again with a new password.

begin;

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
  v_user_id uuid;
  v_profile_role text;
begin
  if not public.is_dm() then
    raise exception 'Only the DM can reset player access.';
  end if;

  if v_username !~ '^[a-z0-9][a-z0-9_-]{2,31}$' then
    raise exception 'Username must be 3–32 characters using letters, numbers, _ or -.';
  end if;

  if char_length(p_activation_code) < 6 then
    raise exception 'Activation code must be at least 6 characters.';
  end if;

  select character.user_id
  into v_user_id
  from public.characters character
  where character.id = p_character_id
    and character.created_by = auth.uid()
  for update;

  if not found then
    raise exception 'Player not found.';
  end if;

  if exists (
    select 1
    from public.characters character
    where character.login_username = v_username
      and character.id <> p_character_id
  ) then
    raise exception 'That username is already assigned to another player.';
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

    -- Deleting the Auth user cascades to the profile and clears characters.user_id.
    -- Character rows and their spell/ability assignments are intentionally preserved.
    delete from auth.users where id = v_user_id;
    if not found then
      raise exception 'The linked login could not be found.';
    end if;
  end if;

  update public.characters
  set
    login_username = v_username,
    activation_hash = extensions.crypt(p_activation_code, extensions.gen_salt('bf'))
  where id = p_character_id
    and created_by = auth.uid()
    and user_id is null;

  if not found then
    raise exception 'The player login could not be reset.';
  end if;
end;
$$;

grant execute on function public.dm_reset_player_login(uuid,text,text) to authenticated;
revoke execute on function public.dm_reset_player_login(uuid,text,text) from public, anon;

commit;
