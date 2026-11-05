-- Suporta a limpeza oportunista por attempted_at. Reverter (manual; remova também a entrada 0003 de drizzle.__drizzle_migrations):
--   DROP INDEX login_attempts_attempted_at_idx;
CREATE INDEX "login_attempts_attempted_at_idx" ON "login_attempts" USING btree ("attempted_at");