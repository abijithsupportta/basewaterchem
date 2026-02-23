-- ============================================
-- Migration 024: Fix Branch Coverage + Full Cleanup Utility
-- ============================================
-- This migration addresses:
-- 1) Branch module stability issues from overlapping migrations
-- 2) Missing branch_id on core business tables
-- 3) Utility function to clean all non-superadmin data (including auth)

-- Ensure at least one branch exists so branch_id can be enforced safely
INSERT INTO branches (
  branch_code,
  branch_name,
  city,
  state,
  is_active
)
SELECT
  'HO',
  'Head Office',
  'Kottayam',
  'Kerala',
  true
WHERE NOT EXISTS (SELECT 1 FROM branches);

-- Re-create branches updated_at trigger safely (previous migrations can conflict)
DROP TRIGGER IF EXISTS set_branches_updated_at ON branches;
CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure branches RLS/policies exist in a stable idempotent way
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view branches" ON branches;
CREATE POLICY "Authenticated users can view branches"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins and managers can manage branches" ON branches;
CREATE POLICY "Only admins and managers can manage branches"
  ON branches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.role IN ('superadmin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.role IN ('superadmin', 'admin', 'manager')
    )
  );

-- Helper: default branch resolver
CREATE OR REPLACE FUNCTION get_default_branch_id()
RETURNS UUID AS $$
  SELECT id
  FROM branches
  ORDER BY is_active DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Add branch_id to all core/related operational tables
ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE amc_contracts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Backfill branch_id from best available source
WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE staff s
SET branch_id = COALESCE(s.branch_id, fallback.branch_id)
FROM fallback
WHERE s.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE customers c
SET branch_id = COALESCE(c.branch_id, s.branch_id, fallback.branch_id)
FROM staff s, fallback
WHERE c.created_by = s.id
  AND c.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE customers c
SET branch_id = COALESCE(c.branch_id, fallback.branch_id)
FROM fallback
WHERE c.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE services srv
SET branch_id = COALESCE(
  srv.branch_id,
  (SELECT branch_id FROM staff WHERE id = srv.created_by_staff_id),
  (SELECT branch_id FROM staff WHERE id = srv.created_by),
  (SELECT branch_id FROM staff WHERE id = srv.assigned_technician_id),
  c.branch_id,
  fallback.branch_id
)
FROM customers c, fallback
WHERE srv.customer_id = c.id
  AND srv.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE invoices inv
SET branch_id = COALESCE(
  inv.branch_id,
  (SELECT branch_id FROM staff WHERE id = inv.created_by_staff_id),
  (SELECT branch_id FROM staff WHERE id = inv.created_by),
  c.branch_id,
  fallback.branch_id
)
FROM customers c, fallback
WHERE inv.customer_id = c.id
  AND inv.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE expenses e
SET branch_id = COALESCE(e.branch_id, s.branch_id, fallback.branch_id)
FROM staff s, fallback
WHERE e.created_by_staff_id = s.id
  AND e.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE expenses e
SET branch_id = COALESCE(e.branch_id, fallback.branch_id)
FROM fallback
WHERE e.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE complaints cpt
SET branch_id = COALESCE(
  cpt.branch_id,
  (SELECT branch_id FROM staff WHERE id = cpt.created_by),
  (SELECT branch_id FROM staff WHERE id = cpt.assigned_to),
  c.branch_id,
  fallback.branch_id
)
FROM customers c, fallback
WHERE cpt.customer_id = c.id
  AND cpt.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE quotations q
SET branch_id = COALESCE(
  q.branch_id,
  (SELECT branch_id FROM staff WHERE id = q.created_by),
  c.branch_id,
  fallback.branch_id
)
FROM customers c, fallback
WHERE q.customer_id = c.id
  AND q.branch_id IS NULL;

WITH fallback AS (
  SELECT get_default_branch_id() AS branch_id
)
UPDATE amc_contracts ac
SET branch_id = COALESCE(
  ac.branch_id,
  (SELECT branch_id FROM staff WHERE id = ac.created_by),
  c.branch_id,
  fallback.branch_id
)
FROM customers c, fallback
WHERE ac.customer_id = c.id
  AND ac.branch_id IS NULL;

-- Enforce branch on write for core tables
ALTER TABLE staff
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE customers
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE services
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE invoices
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE expenses
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE complaints
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE quotations
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE amc_contracts
  ALTER COLUMN branch_id SET DEFAULT get_default_branch_id(),
  ALTER COLUMN branch_id SET NOT NULL;

-- Performance indexes for branch filters
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_services_branch ON services(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_complaints_branch ON complaints(branch_id);
CREATE INDEX IF NOT EXISTS idx_quotations_branch ON quotations(branch_id);
CREATE INDEX IF NOT EXISTS idx_amc_contracts_branch ON amc_contracts(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_branch ON staff(branch_id);

-- ============================================
-- Full cleanup utility (manual execution)
-- ============================================
-- Usage:
--   SELECT cleanup_non_superadmin_data();
--
-- This keeps ONLY superadmin staff + their auth users.
-- It removes all other operational data and other auth users.
CREATE OR REPLACE FUNCTION cleanup_non_superadmin_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  keep_auth_user_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(auth_user_id), ARRAY[]::UUID[])
  INTO keep_auth_user_ids
  FROM staff
  WHERE role = 'superadmin'
    AND auth_user_id IS NOT NULL;

  IF COALESCE(array_length(keep_auth_user_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Cleanup aborted: no superadmin auth user found in staff table.';
  END IF;

  -- Remove business data (dependency-safe order)
  DELETE FROM notifications;
  DELETE FROM stock_transactions;
  DELETE FROM invoice_items;
  DELETE FROM quotation_items;

  DELETE FROM invoices;
  DELETE FROM quotations;
  DELETE FROM services;
  DELETE FROM complaints;
  DELETE FROM amc_contracts;
  DELETE FROM expenses;

  DELETE FROM customer_products;
  DELETE FROM customers;

  DELETE FROM inventory_products;
  DELETE FROM inventory_categories;

  -- Keep only superadmin staff
  DELETE FROM staff
  WHERE role <> 'superadmin';

  -- Keep only branches linked to remaining superadmin staff
  DELETE FROM branches b
  WHERE NOT EXISTS (
    SELECT 1 FROM staff s
    WHERE s.role = 'superadmin'
      AND s.branch_id = b.id
  );

  -- Remove auth users not linked to superadmin staff
  DELETE FROM auth.users
  WHERE id <> ALL (keep_auth_user_ids);
END;
$$;

COMMENT ON FUNCTION cleanup_non_superadmin_data IS
'Deletes all non-superadmin operational data/users and removes non-superadmin auth.users. Keep at least one superadmin staff row.';
