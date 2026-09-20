-- Add multiple campaign groups while keeping the spell and ability libraries shared.
-- Existing characters are moved into a default "Main Campaign" owned by their DM.

begin;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists campaigns_created_by_name_unique
  on public.campaigns (created_by, lower(name));

drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

alter table public.characters
  add column if not exists campaign_id uuid references public.campaigns(id) on delete restrict;

insert into public.campaigns (name, created_by)
select 'Main Campaign', profile.id
from public.profiles profile
where profile.role = 'dm'
on conflict do nothing;

update public.characters character
set campaign_id = campaign.id
from public.campaigns campaign
where character.campaign_id is null
  and campaign.created_by = character.created_by
  and campaign.name = 'Main Campaign';

do $$
begin
  if exists (select 1 from public.characters where campaign_id is null) then
    raise exception 'Could not assign every existing character to its DM campaign. Confirm each character has a valid created_by DM, then run this migration again.';
  end if;
end;
$$;

alter table public.characters alter column campaign_id set not null;
create index if not exists characters_campaign_id_idx on public.characters(campaign_id);

alter table public.campaigns enable row level security;

drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select to authenticated
using (
  (public.is_dm() and created_by = auth.uid())
  or exists (
    select 1
    from public.characters character
    where character.campaign_id = campaigns.id
      and character.user_id = auth.uid()
  )
);

drop policy if exists campaigns_dm_insert on public.campaigns;
create policy campaigns_dm_insert on public.campaigns for insert to authenticated
with check (public.is_dm() and created_by = auth.uid());

drop policy if exists campaigns_dm_update on public.campaigns;
create policy campaigns_dm_update on public.campaigns for update to authenticated
using (public.is_dm() and created_by = auth.uid())
with check (public.is_dm() and created_by = auth.uid());

drop policy if exists campaigns_dm_delete on public.campaigns;
create policy campaigns_dm_delete on public.campaigns for delete to authenticated
using (public.is_dm() and created_by = auth.uid());

grant select on public.campaigns to authenticated;
grant insert, update, delete on public.campaigns to authenticated;

-- Keep characters and campaigns under the same DM, including direct table updates.
create or replace function public.ensure_character_campaign_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_campaign_owner uuid;
begin
  select created_by into v_campaign_owner
  from public.campaigns
  where id = new.campaign_id;

  if not found or new.created_by is distinct from v_campaign_owner then
    raise exception 'Character and campaign must belong to the same DM.';
  end if;

  return new;
end;
$$;

drop trigger if exists characters_campaign_owner on public.characters;
create trigger characters_campaign_owner
before insert or update of campaign_id, created_by on public.characters
for each row execute function public.ensure_character_campaign_owner();
revoke all on function public.ensure_character_campaign_owner() from public, anon, authenticated;

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
  if p_class_key not in ('barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard') then raise exception 'Unsupported class.'; end if;
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

-- Keep the original five-argument function working during a staged deployment.
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
  v_campaign_id uuid;
begin
  if not public.is_dm() then raise exception 'Only the DM can create players.'; end if;

  select id into v_campaign_id
  from public.campaigns
  where created_by = auth.uid()
  order by created_at, id
  limit 1;

  if v_campaign_id is null then
    insert into public.campaigns (name, created_by)
    values ('Main Campaign', auth.uid())
    returning id into v_campaign_id;
  end if;

  return public.dm_create_character(
    p_username,
    p_activation_code,
    p_character_name,
    p_class_key,
    p_level,
    v_campaign_id
  );
end;
$$;

grant execute on function public.dm_create_character(text,text,text,text,integer,uuid) to authenticated;
revoke execute on function public.dm_create_character(text,text,text,text,integer,uuid) from public, anon;

commit;
