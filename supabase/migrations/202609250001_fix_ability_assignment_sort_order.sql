-- Keep every DM-assigned card's display order non-null.
--
-- The multiclass migration replaced dm_set_ability_override with a version that
-- treated every built-in card like a class feature. Built-in feats and magic
-- items can have no required level, so that calculation produced NULL and the
-- character_abilities insert failed its sort_order NOT NULL constraint.

begin;

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
  v_ability_class text;
  v_ability_kind text;
  v_required_level integer;
  v_feature_order integer;
  v_is_eligible boolean;
  v_class_group_order integer;
  v_sort_order integer;
begin
  if not public.is_dm() then
    raise exception 'Only the DM can change ability assignments.';
  end if;

  select
    ability.class_key,
    ability.ability_kind,
    ability.level_required,
    ability.feature_order,
    exists (
      select 1
      from public.character_classes class_level
      where class_level.character_id = p_character_id
        and class_level.class_key = ability.class_key
        and ability.is_system
        and ability.ability_kind = 'class_feature'
        and ability.level_required <= class_level.class_level
    )
  into
    v_ability_class,
    v_ability_kind,
    v_required_level,
    v_feature_order,
    v_is_eligible
  from public.characters character
  cross join public.abilities ability
  where character.id = p_character_id
    and ability.id = p_ability_id;

  if not found then
    raise exception 'Character or ability not found.';
  end if;

  if v_ability_kind = 'class_feature' then
    select class_order.group_order
    into v_class_group_order
    from (
      select
        class_level.class_key,
        (row_number() over (
          order by class_level.is_primary desc, class_level.class_key
        ) - 1)::integer as group_order
      from public.character_classes class_level
      where class_level.character_id = p_character_id
    ) class_order
    where class_order.class_key = v_ability_class;
  end if;

  v_sort_order := case
    when v_ability_kind = 'class_feature' and v_class_group_order is not null then
      (v_class_group_order * 100000)
        + (coalesce(v_required_level, 0) * 100)
        + coalesce(v_feature_order, 0)
    when v_ability_kind = 'class_feature' then
      1900000
        + (coalesce(v_required_level, 0) * 100)
        + coalesce(v_feature_order, 0)
    when v_ability_kind = 'feat' then
      2000000
        + (coalesce(v_required_level, 0) * 1000)
        + coalesce(v_feature_order, 0)
    when v_ability_kind = 'magic_item' then
      3000000 + coalesce(v_feature_order, 0)
    else
      4000000 + coalesce(v_feature_order, 0)
  end;

  -- This final guard keeps future card kinds safe even if their optional
  -- ordering metadata is absent.
  v_sort_order := coalesce(v_sort_order, 4000000);

  if p_enabled then
    insert into public.character_abilities (
      character_id,
      ability_id,
      sort_order,
      assignment_type,
      is_enabled
    ) values (
      p_character_id,
      p_ability_id,
      v_sort_order,
      case when v_is_eligible then 'automatic' else 'dm_included' end,
      true
    )
    on conflict (character_id, ability_id) do update set
      sort_order = excluded.sort_order,
      assignment_type = excluded.assignment_type,
      is_enabled = true;
  elsif v_is_eligible then
    insert into public.character_abilities (
      character_id,
      ability_id,
      sort_order,
      assignment_type,
      is_enabled
    ) values (
      p_character_id,
      p_ability_id,
      v_sort_order,
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

revoke all on function public.dm_set_ability_override(uuid, uuid, boolean) from public, anon;
grant execute on function public.dm_set_ability_override(uuid, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
