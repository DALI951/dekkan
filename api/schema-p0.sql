-- DEKKAN own-server schema — P0 deltas (P0-6 RBAC light, SEC-001).
-- Run once on the host (phpMyAdmin / mysql CLI) BEFORE first deploy of the
-- P0-6 build. idempotent guard: MySQL ignores the statement when the column
-- already exists (re-run safe after the first successful run).

ALTER TABLE dekkan_users
    ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'owner' AFTER shop_name;

-- existing accounts are owners by default (correct: they predate cashiers).
-- Example — add a cashier account:
--   UPDATE dekkan_users SET role = 'cashier' WHERE email = 'sami@example.com';