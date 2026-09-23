CREATE TABLE "command_events_default" PARTITION OF "command_events" DEFAULT;
--> statement-breakpoint
CREATE FUNCTION create_command_events_partition(month_start date) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  first_day date := date_trunc('month', month_start)::date;
  range_start timestamptz := first_day::timestamp AT TIME ZONE 'UTC';
  range_end timestamptz := (first_day + interval '1 month')::timestamp AT TIME ZONE 'UTC';
  partition_name text := format('command_events_y%sm%s', to_char(first_day, 'YYYY'), to_char(first_day, 'MM'));
BEGIN
  IF to_regclass(partition_name) IS NOT NULL THEN
    RETURN partition_name;
  END IF;

  EXECUTE format(
    'CREATE TABLE %I (LIKE command_events INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
    partition_name
  );
  EXECUTE format(
    'WITH moved AS (DELETE FROM command_events_default WHERE created_at >= %L AND created_at < %L RETURNING *) INSERT INTO %I SELECT * FROM moved',
    range_start, range_end, partition_name
  );
  EXECUTE format(
    'ALTER TABLE command_events ATTACH PARTITION %I FOR VALUES FROM (%L) TO (%L)',
    partition_name, range_start, range_end
  );
  RETURN partition_name;
END;
$$;
--> statement-breakpoint
SELECT create_command_events_partition((now() AT TIME ZONE 'UTC')::date);
--> statement-breakpoint
SELECT create_command_events_partition(((now() AT TIME ZONE 'UTC')::date + interval '1 month')::date);
--> statement-breakpoint
SELECT create_command_events_partition(((now() AT TIME ZONE 'UTC')::date + interval '2 months')::date);
