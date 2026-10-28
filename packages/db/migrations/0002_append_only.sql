-- price_observations is append-only: the database itself refuses UPDATE and DELETE (FR-HIS-01).
CREATE OR REPLACE FUNCTION reject_price_observation_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'price_observations is append-only (% not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER price_observations_append_only
  BEFORE UPDATE OR DELETE ON price_observations
  FOR EACH ROW EXECUTE FUNCTION reject_price_observation_change();
