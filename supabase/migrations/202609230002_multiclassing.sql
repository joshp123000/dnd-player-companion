-- First-class multiclass support for 2024 rules and the 2025 Artificer.
-- Class levels, spell preparation limits, and spell access remain class-specific.
-- Shared spell-slot totals are derived by the client from these class levels.

begin;

create table if not exists public.character_classes (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  class_key text not null check (class_key in (
    'artificer','barbarian','bard','cleric','druid','fighter','monk',
    'paladin','ranger','rogue','sorcerer','warlock','wizard'
  )),
  class_level integer not null check (class_level between 1 and 20),
  subclass text,
  is_primary boolean not null default false,
  max_cantrips_override integer check (max_cantrips_override between 0 and 50),
  max_prepared_override integer check (max_prepared_override between 0 and 100),
  max_spell_level_override integer check (max_spell_level_override between 0 and 9),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, class_key)
);

create unique index if not exists character_classes_one_primary_idx
  on public.character_classes(character_id)
  where is_primary;
create index if not exists character_classes_character_idx
  on public.character_classes(character_id);

drop trigger if exists character_classes_updated_at on public.character_classes;
create trigger character_classes_updated_at
before update on public.character_classes
for each row execute function public.set_updated_at();

insert into public.character_classes (
  character_id,
  class_key,
  class_level,
  subclass,
  is_primary,
  max_cantrips_override,
  max_prepared_override,
  max_spell_level_override
)
select
  character.id,
  character.class_key,
  character.level,
  character.subclass,
  true,
  character.max_cantrips_override,
  character.max_prepared_override,
  character.max_spell_level_override
from public.characters character
where not exists (
  select 1 from public.character_classes existing
  where existing.character_id = character.id
)
on conflict (character_id, class_key) do nothing;

alter table public.character_classes enable row level security;

drop policy if exists character_classes_select on public.character_classes;
create policy character_classes_select on public.character_classes
for select to authenticated
using (
  public.is_dm()
  or exists (
    select 1 from public.characters character
    where character.id = character_id
      and character.user_id = auth.uid()
  )
);

grant select on public.character_classes to authenticated;

-- Every newly created character starts with one primary class. The DM editor can
-- atomically replace this row with a complete multiclass build afterward.
create or replace function public.seed_character_primary_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.character_classes (
    character_id,
    class_key,
    class_level,
    subclass,
    is_primary,
    max_cantrips_override,
    max_prepared_override,
    max_spell_level_override
  ) values (
    new.id,
    new.class_key,
    new.level,
    new.subclass,
    true,
    new.max_cantrips_override,
    new.max_prepared_override,
    new.max_spell_level_override
  )
  on conflict (character_id, class_key) do nothing;
  return new;
end;
$$;

drop trigger if exists characters_seed_primary_class on public.characters;
create trigger characters_seed_primary_class
after insert on public.characters
for each row execute function public.seed_character_primary_class();

-- A spell assignment has a class source. This allows one spell that appears on
-- two lists to be prepared independently for both classes.
alter table public.character_spells
  add column if not exists source_class_key text;

update public.character_spells assignment
set source_class_key = character.class_key
from public.characters character
where character.id = assignment.character_id
  and assignment.source_class_key is null;

alter table public.character_spells
  alter column source_class_key set default 'dm',
  alter column source_class_key set not null;

alter table public.character_spells
  drop constraint if exists character_spells_source_class_key_check;
alter table public.character_spells
  add constraint character_spells_source_class_key_check check (source_class_key in (
    'dm','artificer','barbarian','bard','cleric','druid','fighter','monk',
    'paladin','ranger','rogue','sorcerer','warlock','wizard'
  ));

alter table public.character_spells
  drop constraint if exists character_spells_character_id_spell_id_key;
alter table public.character_spells
  drop constraint if exists character_spells_character_spell_source_key;
alter table public.character_spells
  add constraint character_spells_character_spell_source_key
  unique (character_id, spell_id, source_class_key);

create index if not exists character_spells_source_class_idx
  on public.character_spells(character_id, source_class_key);

-- Class features now unlock from every class at that class's own level.
create or replace function public.sync_class_abilities(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.characters where id = p_character_id) then
    return;
  end if;

  delete from public.character_abilities assignment
  using public.abilities ability
  where assignment.character_id = p_character_id
    and assignment.ability_id = ability.id
    and assignment.assignment_type in ('automatic', 'dm_excluded')
    and not exists (
      select 1
      from public.character_classes class_level
      where class_level.character_id = p_character_id
        and class_level.class_key = ability.class_key
        and ability.is_system
        and ability.level_required <= class_level.class_level
    );

  with class_order as (
    select
      class_level.*,
      row_number() over (
        order by class_level.is_primary desc, class_level.class_key
      ) - 1 as group_order
    from public.character_classes class_level
    where class_level.character_id = p_character_id
  ), eligible as (
    select
      ability.id as ability_id,
      ((class_order.group_order * 100000)
        + (ability.level_required * 100)
        + ability.feature_order)::integer as sort_order
    from class_order
    join public.abilities ability
      on ability.is_system
      and ability.class_key = class_order.class_key
      and ability.level_required <= class_order.class_level
  )
  update public.character_abilities assignment
  set sort_order = eligible.sort_order
  from eligible
  where assignment.character_id = p_character_id
    and assignment.ability_id = eligible.ability_id
    and assignment.assignment_type = 'automatic';

  with class_order as (
    select
      class_level.*,
      row_number() over (
        order by class_level.is_primary desc, class_level.class_key
      ) - 1 as group_order
    from public.character_classes class_level
    where class_level.character_id = p_character_id
  )
  insert into public.character_abilities (
    character_id,
    ability_id,
    sort_order,
    assignment_type,
    is_enabled
  )
  select
    p_character_id,
    ability.id,
    ((class_order.group_order * 100000)
      + (ability.level_required * 100)
      + ability.feature_order)::integer,
    'automatic',
    true
  from class_order
  join public.abilities ability
    on ability.is_system
    and ability.class_key = class_order.class_key
    and ability.level_required <= class_order.class_level
  where not exists (
    select 1
    from public.character_abilities existing
    where existing.character_id = p_character_id
      and existing.ability_id = ability.id
  );
end;
$$;

create or replace function public.dm_set_ability_override(
  p_character_id uuid,
  p_ability_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required_level integer;
  v_feature_order integer;
  v_is_system boolean;
  v_is_eligible boolean;
begin
  if not public.is_dm() then
    raise exception 'Only the DM can change ability assignments.';
  end if;

  select ability.level_required, ability.feature_order, ability.is_system,
    exists (
      select 1
      from public.character_classes class_level
      where class_level.character_id = p_character_id
        and class_level.class_key = ability.class_key
        and ability.is_system
        and ability.level_required <= class_level.class_level
    )
  into v_required_level, v_feature_order, v_is_system, v_is_eligible
  from public.characters character
  cross join public.abilities ability
  where character.id = p_character_id
    and ability.id = p_ability_id;

  if not found then raise exception 'Character or ability not found.'; end if;

  if p_enabled then
    insert into public.character_abilities (
      character_id, ability_id, sort_order, assignment_type, is_enabled
    ) values (
      p_character_id,
      p_ability_id,
      case when v_is_system then (v_required_level * 100) + v_feature_order else 0 end,
      case when v_is_eligible then 'automatic' else 'dm_included' end,
      true
    )
    on conflict (character_id, ability_id) do update set
      sort_order = excluded.sort_order,
      assignment_type = excluded.assignment_type,
      is_enabled = true;
  elsif v_is_eligible then
    insert into public.character_abilities (
      character_id, ability_id, sort_order, assignment_type, is_enabled
    ) values (
      p_character_id,
      p_ability_id,
      (v_required_level * 100) + v_feature_order,
      'dm_excluded',
      false
    )
    on conflict (character_id, ability_id) do update set
      sort_order = excluded.sort_order,
      assignment_type = 'dm_excluded',
      is_enabled = false;
  else
    delete from public.character_abilities
    where character_id = p_character_id
      and ability_id = p_ability_id;
  end if;
end;
$$;

-- Save general character details and the entire class build in one transaction.
create or replace function public.dm_update_character_multiclass(
  p_character_id uuid,
  p_campaign_id uuid,
  p_name text,
  p_notes text,
  p_preparation_unlocked boolean,
  p_classes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary record;
  v_class_count integer;
  v_total_level integer;
begin
  if not public.is_dm() then raise exception 'Only the DM can edit characters.'; end if;
  if jsonb_typeof(p_classes) is distinct from 'array' then raise exception 'Class build must be a list.'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Enter a character name.'; end if;
  if not exists (
    select 1 from public.characters
    where id = p_character_id and created_by = auth.uid()
  ) then raise exception 'Character not found.'; end if;
  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and created_by = auth.uid()
  ) then raise exception 'Choose one of your campaigns.'; end if;

  select count(*), coalesce(sum(class_level), 0)
  into v_class_count, v_total_level
  from jsonb_to_recordset(p_classes) as entry(
    class_key text,
    class_level integer,
    subclass text,
    is_primary boolean,
    max_cantrips_override integer,
    max_prepared_override integer,
    max_spell_level_override integer
  );

  if v_class_count < 1 then raise exception 'Add at least one class.'; end if;
  if v_total_level not between 1 and 20 then raise exception 'Total character level must be between 1 and 20.'; end if;
  if (
    select count(*)
    from jsonb_to_recordset(p_classes) as entry(class_key text, class_level integer, is_primary boolean)
    where coalesce(entry.is_primary, false)
  ) <> 1 then raise exception 'Choose exactly one primary class.'; end if;
  if (
    select count(distinct entry.class_key)
    from jsonb_to_recordset(p_classes) as entry(class_key text)
  ) <> v_class_count then raise exception 'Each class can only be added once.'; end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_classes) as entry(class_key text, class_level integer)
    where entry.class_key not in (
      'artificer','barbarian','bard','cleric','druid','fighter','monk',
      'paladin','ranger','rogue','sorcerer','warlock','wizard'
    ) or entry.class_level not between 1 and 20
  ) then raise exception 'Every class needs a supported class and a level from 1 to 20.'; end if;

  delete from public.character_classes where character_id = p_character_id;

  insert into public.character_classes (
    character_id,
    class_key,
    class_level,
    subclass,
    is_primary,
    max_cantrips_override,
    max_prepared_override,
    max_spell_level_override
  )
  select
    p_character_id,
    entry.class_key,
    entry.class_level,
    nullif(trim(entry.subclass), ''),
    coalesce(entry.is_primary, false),
    entry.max_cantrips_override,
    entry.max_prepared_override,
    entry.max_spell_level_override
  from jsonb_to_recordset(p_classes) as entry(
    class_key text,
    class_level integer,
    subclass text,
    is_primary boolean,
    max_cantrips_override integer,
    max_prepared_override integer,
    max_spell_level_override integer
  );

  delete from public.character_spells assignment
  where assignment.character_id = p_character_id
    and assignment.source_class_key <> 'dm'
    and not exists (
      select 1
      from public.character_classes class_level
      where class_level.character_id = p_character_id
        and class_level.class_key = assignment.source_class_key
    );

  update public.character_spells assignment
  set is_prepared = false
  from public.spells spell,
       public.character_classes class_level
  left join public.class_progression progression
    on progression.class_key = class_level.class_key
    and progression.level = class_level.class_level
  where assignment.character_id = p_character_id
    and assignment.source_class_key = class_level.class_key
    and assignment.spell_id = spell.id
    and not assignment.always_prepared
    and spell.level > coalesce(
      class_level.max_spell_level_override,
      progression.max_spell_level,
      0
    );

  select * into v_primary
  from public.character_classes
  where character_id = p_character_id and is_primary;

  update public.characters
  set campaign_id = p_campaign_id,
      name = trim(p_name),
      notes = nullif(trim(p_notes), ''),
      preparation_unlocked = p_preparation_unlocked,
      class_key = v_primary.class_key,
      subclass = v_primary.subclass,
      level = v_total_level,
      max_cantrips_override = v_primary.max_cantrips_override,
      max_prepared_override = v_primary.max_prepared_override,
      max_spell_level_override = v_primary.max_spell_level_override
  where id = p_character_id;

  perform public.sync_class_abilities(p_character_id);
end;
$$;

-- DM assignments may be attached to a class or be a general granted spell.
create or replace function public.dm_assign_spell(
  p_character_id uuid,
  p_spell_id uuid,
  p_source_class_key text,
  p_prepared boolean,
  p_always_prepared boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dm() then raise exception 'Only the DM can assign spells.'; end if;
  if not exists (select 1 from public.characters where id = p_character_id) then raise exception 'Character not found.'; end if;
  if not exists (select 1 from public.spells where id = p_spell_id) then raise exception 'Spell not found.'; end if;
  if p_source_class_key <> 'dm' and not exists (
    select 1 from public.character_classes
    where character_id = p_character_id and class_key = p_source_class_key
  ) then raise exception 'Choose one of this character’s classes.'; end if;

  insert into public.character_spells (
    character_id,
    spell_id,
    source_class_key,
    in_collection,
    is_prepared,
    always_prepared,
    assigned_by_dm
  ) values (
    p_character_id,
    p_spell_id,
    p_source_class_key,
    true,
    p_prepared or p_always_prepared,
    p_always_prepared,
    true
  )
  on conflict (character_id, spell_id, source_class_key) do update set
    in_collection = true,
    is_prepared = excluded.is_prepared,
    always_prepared = excluded.always_prepared,
    assigned_by_dm = true;
end;
$$;

create or replace function public.player_toggle_spell(
  p_character_id uuid,
  p_spell_id uuid,
  p_source_class_key text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_character public.characters%rowtype;
  v_class public.character_classes%rowtype;
  v_spell public.spells%rowtype;
  v_assignment public.character_spells%rowtype;
  v_mode text;
  v_spell_limit integer;
  v_max_level integer;
  v_count integer;
begin
  select * into v_character
  from public.characters
  where id = p_character_id and user_id = auth.uid();
  if not found then raise exception 'Character not found.'; end if;

  select * into v_class
  from public.character_classes
  where character_id = p_character_id and class_key = p_source_class_key;
  if not found then raise exception 'That class is not part of this character.'; end if;

  select * into v_spell from public.spells where id = p_spell_id;
  if not found then raise exception 'Spell not found.'; end if;

  select * into v_assignment
  from public.character_spells
  where character_id = p_character_id
    and spell_id = p_spell_id
    and source_class_key = p_source_class_key;

  select
    coalesce(v_class.max_prepared_override, progression.prepared_spells, 0),
    coalesce(v_class.max_spell_level_override, progression.max_spell_level, 0),
    coalesce(progression.selection_mode, 'none')
  into v_spell_limit, v_max_level, v_mode
  from (select 1) base
  left join public.class_progression progression
    on progression.class_key = v_class.class_key
    and progression.level = v_class.class_level;

  if v_spell.level = 0 then
    raise exception 'Cantrips are assigned by the DM and are not part of daily preparation.';
  end if;
  if v_spell.source_type = 'custom' and v_assignment.id is null then
    raise exception 'Custom spells must first be granted by the DM for this class.';
  end if;
  if v_spell.source_type = 'srd' and not (v_class.class_key = any(v_spell.classes)) then
    raise exception 'That spell is not on this class’s spell list.';
  end if;
  if v_spell.level > v_max_level then
    raise exception 'That class cannot prepare this spell level yet.';
  end if;
  if v_mode not in ('daily', 'spellbook') then
    raise exception 'This class’s spells are assigned by the DM rather than prepared daily.';
  end if;
  if not v_character.preparation_unlocked then
    raise exception 'Spell preparation is locked by the DM.';
  end if;

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

  if v_mode = 'spellbook' and (v_assignment.id is null or not v_assignment.in_collection) then
    raise exception 'The DM must add that spell to this Wizard’s spellbook first.';
  end if;

  select count(*) into v_count
  from public.character_spells assignment
  join public.spells spell on spell.id = assignment.spell_id
  where assignment.character_id = p_character_id
    and assignment.source_class_key = p_source_class_key
    and spell.level > 0
    and assignment.is_prepared
    and not assignment.always_prepared
    and assignment.spell_id <> p_spell_id;
  if v_count >= v_spell_limit then
    raise exception 'This class has reached its prepared spell limit.';
  end if;

  insert into public.character_spells (
    character_id,
    spell_id,
    source_class_key,
    in_collection,
    is_prepared,
    always_prepared,
    assigned_by_dm
  ) values (
    p_character_id,
    p_spell_id,
    p_source_class_key,
    true,
    true,
    false,
    false
  )
  on conflict (character_id, spell_id, source_class_key) do update set
    is_prepared = true;
end;
$$;

-- Compatibility for a briefly cached pre-multiclass client during deployment.
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
  v_primary_class text;
begin
  select class_key into v_primary_class
  from public.character_classes
  where character_id = p_character_id and is_primary;
  perform public.player_toggle_spell(p_character_id, p_spell_id, v_primary_class, p_active);
end;
$$;

revoke all on function public.seed_character_primary_class() from public, anon, authenticated;
revoke all on function public.sync_class_abilities(uuid) from public, anon, authenticated;
revoke all on function public.dm_update_character_multiclass(uuid,uuid,text,text,boolean,jsonb) from public, anon;
revoke all on function public.dm_assign_spell(uuid,uuid,text,boolean,boolean) from public, anon;
revoke all on function public.player_toggle_spell(uuid,uuid,text,boolean) from public, anon;
revoke all on function public.player_toggle_spell(uuid,uuid,boolean) from public, anon;

grant execute on function public.dm_update_character_multiclass(uuid,uuid,text,text,boolean,jsonb) to authenticated;
grant execute on function public.dm_assign_spell(uuid,uuid,text,boolean,boolean) to authenticated;
grant execute on function public.player_toggle_spell(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.player_toggle_spell(uuid,uuid,boolean) to authenticated;

do $$
declare
  character_row record;
begin
  for character_row in select id from public.characters loop
    perform public.sync_class_abilities(character_row.id);
  end loop;
end;
$$;

commit;
