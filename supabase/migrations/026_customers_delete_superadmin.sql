-- ============================================
-- Migration 026: Customer Delete Superadmin Only
-- ============================================

-- Helper: check if current user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE auth_user_id = auth.uid()
      AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace delete policy for customers (superadmin only)
DROP POLICY IF EXISTS "Admin can delete customers" ON customers;
DROP POLICY IF EXISTS "Admin or superadmin can delete customers" ON customers;
DROP POLICY IF EXISTS "Superadmin can delete customers" ON customers;

CREATE POLICY "Superadmin can delete customers" ON customers
  FOR DELETE USING (is_superadmin());
