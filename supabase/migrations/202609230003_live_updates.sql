-- Publish Campaign Compendium tables to Supabase Realtime.
-- Existing Row Level Security policies still decide which rows each signed-in
-- player or DM is allowed to receive.

do $live_updates$
declare
  table_name text;
begin
  foreach table_name in array array[
    'campaigns',
    'characters',
    'character_classes',
    'character_spells',
    'character_abilities',
    'spells',
    'abilities',
    'class_progression'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$live_updates$;
