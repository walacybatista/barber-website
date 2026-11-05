-- ADR-006: conflito de horário impedido pelo banco (RN01).
-- Custom porque o Drizzle não modela EXCLUDE constraints.
-- Reverter (manual, drizzle-kit não tem "down"):
--   ALTER TABLE busy_periods DROP CONSTRAINT busy_periods_no_overlap;
--   (a extensão btree_gist pode ficar instalada)
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "busy_periods"
  ADD CONSTRAINT "busy_periods_no_overlap"
  EXCLUDE USING gist ("barber_id" WITH =, "period" WITH &&);
