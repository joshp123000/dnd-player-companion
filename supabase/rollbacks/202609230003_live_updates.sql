-- Optional rollback for 202609230003_live_updates.sql.
-- The website also works normally without Realtime; players will need to
-- refresh manually again after this rollback.

do $live_updates_rollback$
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
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime drop table public.%I',
        table_name
      );
    end if;
  end loop;
end
$live_updates_rollback$;
