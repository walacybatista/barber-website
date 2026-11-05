-- Slots alinhados e períodos válidos. (close > open já existe: opening_hours_order, migração 0000.)
-- Reverter (manual, drizzle-kit não tem "down"; remova também a entrada 0002 de drizzle.__drizzle_migrations):
--   ALTER TABLE busy_periods DROP CONSTRAINT busy_periods_period_valid;
--   ALTER TABLE opening_hours DROP CONSTRAINT opening_hours_step;
ALTER TABLE "busy_periods" ADD CONSTRAINT "busy_periods_period_valid" CHECK (NOT isempty("busy_periods"."period") AND NOT lower_inf("busy_periods"."period") AND NOT upper_inf("busy_periods"."period"));--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_step" CHECK (extract(epoch from "opening_hours"."open_time")::int % 900 = 0 AND extract(epoch from "opening_hours"."close_time")::int % 900 = 0);