-- Campaign Compendium database schema
-- Run this migration before supabase/seed.sql.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username)),
  display_name text not null,
  role text not null default 'player' check (role in ('dm', 'player')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_progression (
  class_key text not null,
  level integer not null check (level between 1 and 20),
  cantrips integer not null default 0 check (cantrips >= 0),
  prepared_spells integer not null default 0 check (prepared_spells >= 0),
  max_spell_level integer not null default 0 check (max_spell_level between 0 and 9),
  selection_mode text not null check (selection_mode in ('daily', 'level_choice', 'spellbook', 'none')),
  primary key (class_key, level)
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  login_username text not null unique check (login_username = lower(login_username)),
  activation_hash text,
  name text not null check (char_length(trim(name)) between 1 and 80),
  class_key text not null check (class_key in ('barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard')),
  subclass text,
  level integer not null default 1 check (level between 1 and 20),
  notes text,
  preparation_unlocked boolean not null default false,
  choices_unlocked boolean not null default false,
  max_cantrips_override integer check (max_cantrips_override between 0 and 50),
  max_prepared_override integer check (max_prepared_override between 0 and 100),
  max_spell_level_override integer check (max_spell_level_override between 0 and 9),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activation_state check (
    not (user_id is not null and activation_hash is not null)
  )
);

create table if not exists public.spells (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(trim(name)) between 1 and 120),
  level integer not null default 0 check (level between 0 and 9),
  school text not null,
  classes text[] not null default '{}',
  action_type text not null default 'action',
  casting_time text,
  casting_trigger text,
  range text not null default 'Self',
  components text[] not null default '{}',
  material text,
  duration text not null default 'Instantaneous',
  concentration boolean not null default false,
  ritual boolean not null default false,
  description text not null,
  higher_level text,
  cantrip_upgrade text,
  source_type text not null default 'custom' check (source_type in ('srd', 'custom')),
  source_label text not null default 'Homebrew',
  original_spell_id uuid references public.spells(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.abilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null default 'Ability',
  action_type text,
  uses text,
  recharge text,
  summary text,
  description text not null,
  source text,
  tags text[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_spells (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  spell_id uuid not null references public.spells(id) on delete cascade,
  in_collection boolean not null default true,
  is_prepared boolean not null default false,
  always_prepared boolean not null default false,
  assigned_by_dm boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, spell_id),
  constraint always_is_prepared check (not always_prepared or is_prepared)
);

create table if not exists public.character_abilities (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  ability_id uuid not null references public.abilities(id) on delete cascade,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, ability_id)
);

create index if not exists characters_user_id_idx on public.characters(user_id);
create index if not exists spells_level_name_idx on public.spells(level, name);
create index if not exists spells_classes_gin_idx on public.spells using gin(classes);
create index if not exists character_spells_character_idx on public.character_spells(character_id);
create index if not exists character_abilities_character_idx on public.character_abilities(character_id);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists characters_updated_at on public.characters;
create trigger characters_updated_at before update on public.characters for each row execute function public.set_updated_at();
drop trigger if exists spells_updated_at on public.spells;
create trigger spells_updated_at before update on public.spells for each row execute function public.set_updated_at();
drop trigger if exists abilities_updated_at on public.abilities;
create trigger abilities_updated_at before update on public.abilities for each row execute function public.set_updated_at();
drop trigger if exists character_spells_updated_at on public.character_spells;
create trigger character_spells_updated_at before update on public.character_spells for each row execute function public.set_updated_at();
drop trigger if exists character_abilities_updated_at on public.character_abilities;
create trigger character_abilities_updated_at before update on public.character_abilities for each row execute function public.set_updated_at();

-- A small transliteration fallback that avoids requiring the optional unaccent extension.
create or replace function public.unaccent_fallback(value text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(value, 'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc');
$$;

-- Recreate slugify after its helper exists (PostgreSQL validates referenced functions at creation).
create or replace function public.slugify(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(both '-' from regexp_replace(lower(public.unaccent_fallback(value)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.prepare_spell_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    if new.source_type = 'srd' then
      new.slug := 'srd-' || public.slugify(new.name);
    else
      new.slug := 'custom-' || public.slugify(new.name) || '-' || left(new.id::text, 8);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists spell_slug_before_insert on public.spells;
create trigger spell_slug_before_insert before insert on public.spells for each row execute function public.prepare_spell_slug();

create or replace function public.is_dm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'dm');
$$;

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.class_progression enable row level security;
alter table public.spells enable row level security;
alter table public.abilities enable row level security;
alter table public.character_spells enable row level security;
alter table public.character_abilities enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_dm());
drop policy if exists profiles_dm_all on public.profiles;
create policy profiles_dm_all on public.profiles for all to authenticated
using (public.is_dm()) with check (public.is_dm());

drop policy if exists characters_select on public.characters;
create policy characters_select on public.characters for select to authenticated
using (user_id = auth.uid() or public.is_dm());
drop policy if exists characters_dm_all on public.characters;
create policy characters_dm_all on public.characters for all to authenticated
using (public.is_dm()) with check (public.is_dm());

drop policy if exists progression_read on public.class_progression;
create policy progression_read on public.class_progression for select to authenticated using (true);
drop policy if exists progression_dm_all on public.class_progression;
create policy progression_dm_all on public.class_progression for all to authenticated
using (public.is_dm()) with check (public.is_dm());

drop policy if exists spells_select on public.spells;
create policy spells_select on public.spells for select to authenticated
using (
  source_type = 'srd'
  or public.is_dm()
  or exists (
    select 1
    from public.character_spells cs
    join public.characters c on c.id = cs.character_id
    where cs.spell_id = spells.id and c.user_id = auth.uid()
  )
);
drop policy if exists spells_dm_insert on public.spells;
create policy spells_dm_insert on public.spells for insert to authenticated
with check (public.is_dm() and source_type = 'custom' and created_by = auth.uid());
drop policy if exists spells_dm_update on public.spells;
create policy spells_dm_update on public.spells for update to authenticated
using (public.is_dm() and source_type = 'custom')
with check (public.is_dm() and source_type = 'custom');
drop policy if exists spells_dm_delete on public.spells;
create policy spells_dm_delete on public.spells for delete to authenticated
using (public.is_dm() and source_type = 'custom');

drop policy if exists abilities_select on public.abilities;
create policy abilities_select on public.abilities for select to authenticated
using (
  public.is_dm()
  or exists (
    select 1
    from public.character_abilities ca
    join public.characters c on c.id = ca.character_id
    where ca.ability_id = abilities.id and c.user_id = auth.uid()
  )
);
drop policy if exists abilities_dm_all on public.abilities;
create policy abilities_dm_all on public.abilities for all to authenticated
using (public.is_dm()) with check (public.is_dm() and created_by = auth.uid());

drop policy if exists character_spells_select on public.character_spells;
create policy character_spells_select on public.character_spells for select to authenticated
using (
  public.is_dm()
  or exists(select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
);
drop policy if exists character_spells_dm_all on public.character_spells;
create policy character_spells_dm_all on public.character_spells for all to authenticated
using (public.is_dm()) with check (public.is_dm());

drop policy if exists character_abilities_select on public.character_abilities;
create policy character_abilities_select on public.character_abilities for select to authenticated
using (
  public.is_dm()
  or exists(select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
);
drop policy if exists character_abilities_dm_all on public.character_abilities;
create policy character_abilities_dm_all on public.character_abilities for all to authenticated
using (public.is_dm()) with check (public.is_dm());

grant usage on schema public to anon, authenticated;
grant select on public.class_progression to authenticated;
grant select on public.profiles, public.characters, public.spells, public.abilities, public.character_spells, public.character_abilities to authenticated;
grant insert, update, delete on public.characters, public.spells, public.abilities, public.character_spells, public.character_abilities to authenticated;

create or replace function public.dm_create_character(
  p_username text,
  p_activation_code text,
  p_character_name text,
  p_class_key text,
  p_level integer
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
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
  if p_class_key not in ('barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard') then raise exception 'Unsupported class.'; end if;
  if p_level not between 1 and 20 then raise exception 'Level must be between 1 and 20.'; end if;

  insert into public.characters (login_username, activation_hash, name, class_key, level, created_by)
  values (v_username, crypt(p_activation_code, gen_salt('bf')), trim(p_character_name), p_class_key, p_level, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.dm_rotate_activation_code(p_character_id uuid, p_activation_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_dm() then raise exception 'Only the DM can replace activation codes.'; end if;
  if char_length(p_activation_code) < 6 then raise exception 'Activation code must be at least 6 characters.'; end if;
  update public.characters
  set activation_hash = crypt(p_activation_code, gen_salt('bf'))
  where id = p_character_id and user_id is null;
  if not found then raise exception 'Only an unclaimed player account can receive a new activation code.'; end if;
end;
$$;

create or replace function public.player_toggle_spell(
  p_character_id uuid,
  p_spell_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_character public.characters%rowtype;
  v_spell public.spells%rowtype;
  v_assignment public.character_spells%rowtype;
  v_mode text;
  v_cantrip_limit integer;
  v_spell_limit integer;
  v_max_level integer;
  v_count integer;
begin
  select * into v_character from public.characters where id = p_character_id and user_id = auth.uid();
  if not found then raise exception 'Character not found.'; end if;

  select * into v_spell from public.spells where id = p_spell_id;
  if not found then raise exception 'Spell not found.'; end if;

  select * into v_assignment from public.character_spells where character_id = p_character_id and spell_id = p_spell_id;

  select
    coalesce(v_character.max_cantrips_override, cp.cantrips, 0),
    coalesce(v_character.max_prepared_override, cp.prepared_spells, 0),
    coalesce(v_character.max_spell_level_override, cp.max_spell_level, 0),
    coalesce(cp.selection_mode, 'none')
  into v_cantrip_limit, v_spell_limit, v_max_level, v_mode
  from (select 1) base
  left join public.class_progression cp
    on cp.class_key = v_character.class_key and cp.level = v_character.level;

  if v_spell.source_type = 'custom' and v_assignment.id is null then
    raise exception 'Custom spells must first be granted by the DM.';
  end if;
  if v_spell.source_type = 'srd' and not (v_character.class_key = any(v_spell.classes)) then
    raise exception 'That spell is not on this character’s class list.';
  end if;
  if v_spell.level > v_max_level then raise exception 'That spell level is not available yet.'; end if;

  if not p_active then
    if v_assignment.id is null then return; end if;
    if v_assignment.always_prepared then raise exception 'The DM marked this spell as always prepared.'; end if;
    if v_mode = 'spellbook' or v_assignment.assigned_by_dm then
      update public.character_spells set is_prepared = false where id = v_assignment.id;
    else
      delete from public.character_spells where id = v_assignment.id;
    end if;
    return;
  end if;

  if v_spell.level = 0 then
    if not v_character.choices_unlocked then raise exception 'Cantrip choices are locked by the DM.'; end if;
    select count(*) into v_count
    from public.character_spells cs join public.spells s on s.id = cs.spell_id
    where cs.character_id = p_character_id and s.level = 0 and (cs.is_prepared or cs.always_prepared)
      and cs.spell_id <> p_spell_id and not cs.always_prepared;
    if v_count >= v_cantrip_limit then raise exception 'This character has reached the cantrip limit.'; end if;
  else
    if v_mode in ('daily', 'spellbook') and not v_character.preparation_unlocked then
      raise exception 'Spell preparation is locked by the DM.';
    elsif v_mode = 'level_choice' and not v_character.choices_unlocked then
      raise exception 'Spell choices are locked by the DM.';
    elsif v_mode = 'none' then
      raise exception 'This character has no automatic spell selection.';
    end if;
    if v_mode = 'spellbook' and (v_assignment.id is null or not v_assignment.in_collection) then
      raise exception 'The DM must add that spell to the Wizard’s spellbook first.';
    end if;
    select count(*) into v_count
    from public.character_spells cs join public.spells s on s.id = cs.spell_id
    where cs.character_id = p_character_id and s.level > 0 and cs.is_prepared
      and not cs.always_prepared and cs.spell_id <> p_spell_id;
    if v_count >= v_spell_limit then raise exception 'This character has reached the spell limit.'; end if;
  end if;

  insert into public.character_spells (character_id, spell_id, in_collection, is_prepared, always_prepared, assigned_by_dm)
  values (p_character_id, p_spell_id, true, true, false, false)
  on conflict (character_id, spell_id) do update set is_prepared = true;
end;
$$;

grant execute on function public.dm_create_character(text,text,text,text,integer) to authenticated;
grant execute on function public.dm_rotate_activation_code(uuid,text) to authenticated;
grant execute on function public.player_toggle_spell(uuid,uuid,boolean) to authenticated;
revoke execute on function public.dm_create_character(text,text,text,text,integer) from public, anon;
revoke execute on function public.dm_rotate_activation_code(uuid,text) from public, anon;
revoke execute on function public.player_toggle_spell(uuid,uuid,boolean) from public, anon;

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

    select * into v_character
    from public.characters
    where login_username = v_username
      and user_id is null
      and activation_hash is not null
      and crypt(v_code, activation_hash) = activation_hash
    for update;

    if not found then raise exception 'Invalid username or activation code.'; end if;

    insert into public.profiles (id, username, display_name, role)
    values (new.id, v_username, v_character.name, 'player');

    update public.characters set user_id = new.id, activation_hash = null where id = v_character.id;
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create or replace function public.promote_user_to_dm(p_email text, p_display_name text, p_username text default 'dm')
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then raise exception 'Create the Auth user first, then run this command.'; end if;
  insert into public.profiles (id, username, display_name, role)
  values (v_user_id, lower(trim(p_username)), trim(p_display_name), 'dm')
  on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, role = 'dm';
end;
$$;
revoke all on function public.promote_user_to_dm(text,text,text) from public, anon, authenticated;

-- 2024 class tables. These values remain editable per character through overrides.
with class_data(class_key, selection_mode, cantrips, prepared, max_levels) as (
  values
    ('bard','level_choice', array[2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4], array[4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22], array[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9]),
    ('cleric','daily', array[3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5], array[4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22], array[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9]),
    ('druid','daily', array[2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4], array[4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22], array[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9]),
    ('paladin','daily', array_fill(0, array[20]), array[2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15], array[1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5]),
    ('ranger','level_choice', array_fill(0, array[20]), array[2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15], array[1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5]),
    ('sorcerer','level_choice', array[4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6], array[2,4,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22], array[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9]),
    ('warlock','level_choice', array[2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4], array[2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15], array[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9]),
    ('wizard','spellbook', array[3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5], array[4,5,6,7,9,10,11,12,14,15,16,16,17,18,19,21,22,23,24,25], array[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9])
), expanded as (
  select class_key, level, cantrips[level], prepared[level], max_levels[level], selection_mode
  from class_data cross join generate_series(1, 20) as level
)
insert into public.class_progression (class_key, level, cantrips, prepared_spells, max_spell_level, selection_mode)
select class_key, level, cantrips, prepared, max_levels, selection_mode from expanded
on conflict (class_key, level) do update set
  cantrips = excluded.cantrips,
  prepared_spells = excluded.prepared_spells,
  max_spell_level = excluded.max_spell_level,
  selection_mode = excluded.selection_mode;
