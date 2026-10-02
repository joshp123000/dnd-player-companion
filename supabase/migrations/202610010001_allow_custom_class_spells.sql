-- Let class-tagged custom spells behave like built-in class-list spells.
-- Prepared casters may choose them automatically, while Wizards still need the
-- DM to add leveled spells to their spellbook first.

begin;

drop policy if exists spells_select on public.spells;
create policy spells_select on public.spells for select to authenticated
using (
  source_type = 'srd'
  or public.is_dm()
  or exists (
    select 1
    from public.character_spells assignment
    join public.characters character on character.id = assignment.character_id
    where assignment.spell_id = spells.id
      and character.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.character_classes class_level
    join public.characters character on character.id = class_level.character_id
    where character.user_id = auth.uid()
      and class_level.class_key = any(spells.classes)
  )
);

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
  if not (v_class.class_key = any(v_spell.classes))
    and not (
      v_spell.source_type = 'custom'
      and v_assignment.id is not null
      and v_assignment.assigned_by_dm
    ) then
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

revoke all on function public.player_toggle_spell(uuid,uuid,text,boolean) from public, anon;
grant execute on function public.player_toggle_spell(uuid,uuid,text,boolean) to authenticated;

commit;
