-- Allow DMs to correct generated card content without changing stable IDs,
-- automatic class/level metadata, or existing character assignments.

begin;

alter table public.spells add column if not exists dm_edited boolean not null default false;
alter table public.spells add column if not exists dm_edited_at timestamptz;
alter table public.spells add column if not exists dm_edited_by uuid references public.profiles(id) on delete set null;

alter table public.abilities add column if not exists dm_edited boolean not null default false;
alter table public.abilities add column if not exists dm_edited_at timestamptz;
alter table public.abilities add column if not exists dm_edited_by uuid references public.profiles(id) on delete set null;

create or replace function public.dm_update_generated_spell(
  p_spell_id uuid,
  p_card jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dm() then
    raise exception 'Only a DM can edit generated spell cards.' using errcode = '42501';
  end if;

  if p_card is null or jsonb_typeof(p_card) <> 'object' then
    raise exception 'Spell card data must be a JSON object.' using errcode = '22023';
  end if;

  if nullif(btrim(p_card->>'name'), '') is null
    or nullif(btrim(p_card->>'school'), '') is null
    or nullif(btrim(p_card->>'action_type'), '') is null
    or nullif(btrim(p_card->>'range'), '') is null
    or nullif(btrim(p_card->>'duration'), '') is null
    or nullif(btrim(p_card->>'description'), '') is null
    or nullif(btrim(p_card->>'source_label'), '') is null then
    raise exception 'Required spell-card fields cannot be blank.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_card->'classes') is distinct from 'array'
    or jsonb_typeof(p_card->'components') is distinct from 'array' then
    raise exception 'Spell classes and components must be arrays.' using errcode = '22023';
  end if;

  update public.spells
  set
    name = btrim(p_card->>'name'),
    level = (p_card->>'level')::integer,
    school = btrim(p_card->>'school'),
    classes = array(select jsonb_array_elements_text(p_card->'classes')),
    action_type = btrim(p_card->>'action_type'),
    casting_time = nullif(btrim(p_card->>'casting_time'), ''),
    casting_trigger = nullif(btrim(p_card->>'casting_trigger'), ''),
    range = btrim(p_card->>'range'),
    components = array(select jsonb_array_elements_text(p_card->'components')),
    material = nullif(btrim(p_card->>'material'), ''),
    duration = btrim(p_card->>'duration'),
    concentration = coalesce((p_card->>'concentration')::boolean, false),
    ritual = coalesce((p_card->>'ritual')::boolean, false),
    description = btrim(p_card->>'description'),
    higher_level = case
      when (p_card->>'level')::integer = 0 then null
      else nullif(btrim(p_card->>'higher_level'), '')
    end,
    cantrip_upgrade = case
      when (p_card->>'level')::integer = 0 then nullif(btrim(p_card->>'cantrip_upgrade'), '')
      else null
    end,
    source_label = btrim(p_card->>'source_label'),
    dm_edited = true,
    dm_edited_at = now(),
    dm_edited_by = auth.uid()
  where id = p_spell_id
    and source_type = 'srd';

  if not found then
    raise exception 'Generated spell card not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.dm_update_generated_ability(
  p_ability_id uuid,
  p_card jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dm() then
    raise exception 'Only a DM can edit generated ability cards.' using errcode = '42501';
  end if;

  if p_card is null or jsonb_typeof(p_card) <> 'object' then
    raise exception 'Ability card data must be a JSON object.' using errcode = '22023';
  end if;

  if nullif(btrim(p_card->>'name'), '') is null
    or nullif(btrim(p_card->>'category'), '') is null
    or nullif(btrim(p_card->>'description'), '') is null then
    raise exception 'Required ability-card fields cannot be blank.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_card->'tags') is distinct from 'array' then
    raise exception 'Ability tags must be an array.' using errcode = '22023';
  end if;

  update public.abilities
  set
    name = btrim(p_card->>'name'),
    category = btrim(p_card->>'category'),
    action_type = nullif(btrim(p_card->>'action_type'), ''),
    uses = nullif(btrim(p_card->>'uses'), ''),
    recharge = nullif(btrim(p_card->>'recharge'), ''),
    summary = nullif(btrim(p_card->>'summary'), ''),
    description = btrim(p_card->>'description'),
    prerequisite = nullif(btrim(p_card->>'prerequisite'), ''),
    repeatable = coalesce((p_card->>'repeatable')::boolean, false),
    source = nullif(btrim(p_card->>'source'), ''),
    tags = array(select jsonb_array_elements_text(p_card->'tags')),
    item_type = nullif(btrim(p_card->>'item_type'), ''),
    item_rarity = nullif(btrim(p_card->>'item_rarity'), ''),
    attunement = nullif(btrim(p_card->>'attunement'), ''),
    dm_edited = true,
    dm_edited_at = now(),
    dm_edited_by = auth.uid()
  where id = p_ability_id
    and is_system;

  if not found then
    raise exception 'Generated ability card not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.dm_update_generated_spell(uuid, jsonb) from public;
revoke all on function public.dm_update_generated_ability(uuid, jsonb) from public;
grant execute on function public.dm_update_generated_spell(uuid, jsonb) to authenticated;
grant execute on function public.dm_update_generated_ability(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
