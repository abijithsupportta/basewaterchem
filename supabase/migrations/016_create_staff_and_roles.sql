-- ============================================
-- Migration 016: Create staff, roles, and permissions
-- ============================================

-- 1. Create roles enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
    CREATE TYPE staff_role AS ENUM ('admin', 'manager', 'staff', 'technician');
  END IF;
END $$;

-- 2. Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role staff_role NOT NULL DEFAULT 'staff',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add assigned_technician_id to services (if not exists)
ALTER TABLE services ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES staff(id);

-- 4. Add created_by_staff_id to services and invoices (if not exists)
ALTER TABLE services ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES staff(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES staff(id);

-- 5. Add triggers to update updated_at
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_updated_at ON staff;
CREATE TRIGGER staff_updated_at
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION update_staff_updated_at();

-- 6. (Optional) Insert initial admin user (replace password hash as needed)
-- INSERT INTO staff (full_name, email, role, password_hash) VALUES ('Admin', 'admin@example.com', 'admin', '<bcrypt_hash>');

-- 7. (Optional) Add indexes
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
