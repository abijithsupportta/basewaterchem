-- ============================================
-- Migration 023: Complete Branches and Enhanced Role System
-- ============================================
-- This migration combines superadmin role addition with branches and tracking

-- Step 1: Add superadmin role to user_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'superadmin' 
    AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'superadmin';
  END IF;
END $$;

-- Step 2: Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_code TEXT NOT NULL UNIQUE,
  branch_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'Kerala',
  pincode TEXT,
  phone TEXT,
  email TEXT,
  manager_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(branch_code);
CREATE INDEX IF NOT EXISTS idx_branches_manager ON branches(manager_id);

-- Step 3: Add branch_id to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_staff_branch ON staff(branch_id);

-- Step 4: Add tracking fields to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_staff_name TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by_staff_id);

-- Step 5: Add tracking fields to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS created_by_staff_name TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS completed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS completed_by_staff_name TEXT;
CREATE INDEX IF NOT EXISTS idx_services_created_by ON services(created_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_services_completed_by ON services(completed_by_staff_id);

-- Step 6: Add update trigger for branches
CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Enable RLS for branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Step 8: RLS Policies for branches
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

-- Step 9: Create view for technician performance
CREATE OR REPLACE VIEW technician_performance AS
SELECT 
  s.id as staff_id,
  s.full_name as technician_name,
  s.email,
  s.phone,
  b.branch_name,
  COUNT(DISTINCT CASE WHEN srv.status = 'completed' THEN srv.id END) as services_completed,
  COUNT(DISTINCT inv.id) as invoices_created,
  COALESCE(SUM(CASE WHEN srv.status = 'completed' THEN srv.total_amount ELSE 0 END), 0) as total_service_revenue,
  COALESCE(SUM(inv.total_amount), 0) as total_invoice_amount,
  AVG(CASE WHEN srv.status = 'completed' AND srv.scheduled_date IS NOT NULL AND srv.completed_date IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (srv.completed_date::timestamp - srv.scheduled_date::timestamp))/86400 
    END) as avg_completion_days,
  COUNT(DISTINCT CASE WHEN srv.status = 'completed' AND srv.completed_date >= CURRENT_DATE - INTERVAL '30 days' THEN srv.id END) as services_last_30_days
FROM staff s
LEFT JOIN branches b ON s.branch_id = b.id
LEFT JOIN services srv ON s.id = srv.completed_by_staff_id OR s.id = srv.created_by_staff_id
LEFT JOIN invoices inv ON s.id = inv.created_by_staff_id
WHERE s.role = 'technician' AND s.is_active = true
GROUP BY s.id, s.full_name, s.email, s.phone, b.branch_name;

-- Step 10: Grant access to view
GRANT SELECT ON technician_performance TO authenticated;

-- Comments
COMMENT ON TYPE user_role IS 'User roles: superadmin (full access), admin (full access), manager (no delete), staff (operations only), technician (service-focused)';
COMMENT ON TABLE branches IS 'Organization branches/locations';
COMMENT ON VIEW technician_performance IS 'Aggregated performance metrics for technicians';
