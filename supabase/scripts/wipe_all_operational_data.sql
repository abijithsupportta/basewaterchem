-- Full wipe of operational data (services, invoices, customers, inventory, expenses, etc.).
-- Run in Supabase SQL Editor on the correct project.
--
-- This script keeps auth.users and staff by default.
-- If you also want to delete all staff/auth except superadmin, see the optional block at the bottom.

BEGIN;

-- Disable RLS for this session
SELECT set_config('row_security', 'off', true);

-- Break cross-table reference cycles
UPDATE amc_contracts SET invoice_id = NULL WHERE invoice_id IS NOT NULL;
UPDATE services SET complaint_id = NULL WHERE complaint_id IS NOT NULL;

-- Truncate all business tables (order does not matter with CASCADE)
TRUNCATE TABLE
  notifications,
  stock_transactions,
  invoice_items,
  quotation_items,
  invoices,
  quotations,
  services,
  complaints,
  amc_contracts,
  expenses,
  customer_products,
  customers,
  inventory_products,
  inventory_categories,
  products
RESTART IDENTITY CASCADE;

COMMIT;

-- Optional: remove all non-superadmin staff + auth users
-- WARNING: This is destructive and will remove logins.
-- Uncomment to use.
--
-- DO $$
-- DECLARE
--   keep_auth_user_ids UUID[];
-- BEGIN
--   SELECT COALESCE(array_agg(auth_user_id), ARRAY[]::UUID[])
--   INTO keep_auth_user_ids
--   FROM staff
--   WHERE role = 'superadmin'
--     AND auth_user_id IS NOT NULL;
--
--   IF COALESCE(array_length(keep_auth_user_ids, 1), 0) = 0 THEN
--     RAISE EXCEPTION 'No superadmin auth user found. Aborting auth cleanup.';
--   END IF;
--
--   DELETE FROM staff WHERE role <> 'superadmin';
--   DELETE FROM branches b
--   WHERE NOT EXISTS (
--     SELECT 1 FROM staff s
--     WHERE s.role = 'superadmin'
--       AND s.branch_id = b.id
--   );
--
--   DELETE FROM auth.users WHERE id <> ALL (keep_auth_user_ids);
-- END $$;
