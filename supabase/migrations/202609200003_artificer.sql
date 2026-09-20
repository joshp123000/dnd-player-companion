-- Add the 2025 Artificer class, its level progression, and its SRD-overlapping spell list.
-- Tinker's Magic grants Mending without using one of the Artificer's normal cantrip choices.

begin;

alter table public.characters
  drop constraint if exists characters_class_key_check;

alter table public.characters
  add constraint characters_class_key_check check (
    class_key in (
      'artificer','barbarian','bard','cleric','druid','fighter','monk',
      'paladin','ranger','rogue','sorcerer','warlock','wizard'
    )
  );

with artificer_data(cantrips, prepared, max_levels) as (
  values (
    array[2,2,2,2,2,2,2,2,2,3,3,3,3,4,4,4,4,4,4,4],
    array[2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15],
    array[1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5]
  )
), expanded as (
  select
    'artificer'::text as class_key,
    level,
    cantrips[level] as cantrips,
    prepared[level] as prepared_spells,
    max_levels[level] as max_spell_level,
    'daily'::text as selection_mode
  from artificer_data
  cross join generate_series(1, 20) as level
)
insert into public.class_progression (
  class_key,
  level,
  cantrips,
  prepared_spells,
  max_spell_level,
  selection_mode
)
select
  class_key,
  level,
  cantrips,
  prepared_spells,
  max_spell_level,
  selection_mode
from expanded
on conflict (class_key, level) do update set
  cantrips = excluded.cantrips,
  prepared_spells = excluded.prepared_spells,
  max_spell_level = excluded.max_spell_level,
  selection_mode = excluded.selection_mode;

update public.spells
set classes = array_append(classes, 'artificer'), updated_at = now()
where slug = any(array[
  'srd-acid-splash',
  'srd-aid',
  'srd-alarm',
  'srd-alter-self',
  'srd-animate-objects',
  'srd-arcane-eye',
  'srd-arcane-hand',
  'srd-arcane-lock',
  'srd-blink',
  'srd-blur',
  'srd-continual-flame',
  'srd-create-food-and-water',
  'srd-creation',
  'srd-cure-wounds',
  'srd-dancing-lights',
  'srd-darkvision',
  'srd-detect-magic',
  'srd-disguise-self',
  'srd-dispel-magic',
  'srd-dragon-s-breath',
  'srd-elementalism',
  'srd-enhance-ability',
  'srd-enlarge-reduce',
  'srd-expeditious-retreat',
  'srd-fabricate',
  'srd-faerie-fire',
  'srd-faithful-hound',
  'srd-false-life',
  'srd-feather-fall',
  'srd-fire-bolt',
  'srd-fly',
  'srd-freedom-of-movement',
  'srd-glyph-of-warding',
  'srd-grease',
  'srd-greater-restoration',
  'srd-guidance',
  'srd-haste',
  'srd-heat-metal',
  'srd-identify',
  'srd-invisibility',
  'srd-jump',
  'srd-lesser-restoration',
  'srd-levitate',
  'srd-light',
  'srd-longstrider',
  'srd-mage-hand',
  'srd-magic-mouth',
  'srd-magic-weapon',
  'srd-mending',
  'srd-message',
  'srd-poison-spray',
  'srd-prestidigitation',
  'srd-private-sanctum',
  'srd-protection-from-energy',
  'srd-protection-from-poison',
  'srd-purify-food-and-drink',
  'srd-ray-of-frost',
  'srd-resilient-sphere',
  'srd-resistance',
  'srd-revivify',
  'srd-rope-trick',
  'srd-sanctuary',
  'srd-secret-chest',
  'srd-see-invisibility',
  'srd-shocking-grasp',
  'srd-spare-the-dying',
  'srd-spider-climb',
  'srd-stone-shape',
  'srd-stoneskin',
  'srd-true-strike',
  'srd-wall-of-stone',
  'srd-water-breathing',
  'srd-water-walk',
  'srd-web'
]::text[])
  and not ('artificer' = any(classes));

create or replace function public.sync_artificer_mending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mending_id uuid;
begin
  if new.class_key = 'artificer' then
    select id into v_mending_id
    from public.spells
    where slug = 'srd-mending';

    if v_mending_id is not null then
      insert into public.character_spells (
        character_id,
        spell_id,
        in_collection,
        is_prepared,
        always_prepared,
        assigned_by_dm
      )
      values (new.id, v_mending_id, true, true, true, false)
      on conflict (character_id, spell_id) do update set
        in_collection = true,
        is_prepared = true,
        always_prepared = true;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.class_key = 'artificer' then
      delete from public.character_spells assignment
      using public.spells spell
      where assignment.character_id = new.id
        and assignment.spell_id = spell.id
        and spell.slug = 'srd-mending'
        and assignment.always_prepared
        and not assignment.assigned_by_dm;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists characters_sync_artificer_mending on public.characters;
create trigger characters_sync_artificer_mending
after insert or update of class_key on public.characters
for each row execute function public.sync_artificer_mending();

revoke all on function public.sync_artificer_mending() from public, anon, authenticated;

-- Covers a staged deployment where a character was changed to Artificer before
-- this trigger existed.
insert into public.character_spells (
  character_id,
  spell_id,
  in_collection,
  is_prepared,
  always_prepared,
  assigned_by_dm
)
select character.id, spell.id, true, true, true, false
from public.characters character
cross join public.spells spell
where character.class_key = 'artificer'
  and spell.slug = 'srd-mending'
on conflict (character_id, spell_id) do update set
  in_collection = true,
  is_prepared = true,
  always_prepared = true;

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
  if p_class_key not in ('artificer','barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard') then raise exception 'Unsupported class.'; end if;
  if p_level not between 1 and 20 then raise exception 'Level must be between 1 and 20.'; end if;
  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and created_by = auth.uid()
  ) then
    raise exception 'Choose one of your campaigns.';
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
    crypt(p_activation_code, gen_salt('bf')),
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

grant execute on function public.dm_create_character(text,text,text,text,integer,uuid) to authenticated;
revoke execute on function public.dm_create_character(text,text,text,text,integer,uuid) from public, anon;

commit;
