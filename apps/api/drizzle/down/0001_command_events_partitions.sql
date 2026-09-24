DO $$
DECLARE
  partition regclass;
BEGIN
  FOR partition IN SELECT inhrelid::regclass FROM pg_inherits WHERE inhparent = 'command_events'::regclass LOOP
    EXECUTE format('DROP TABLE %s', partition);
  END LOOP;
END;
$$;

DROP FUNCTION create_command_events_partition(date);
