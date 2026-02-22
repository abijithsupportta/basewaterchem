-- ============================================
-- Migration 021: Add Superadmin Role
-- ============================================
-- This must be a separate migration because PostgreSQL requires
-- new enum values to be committed before they can be used.

-- Add superadmin role to user_role enum
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

COMMENT ON TYPE user_role IS 'User roles: superadmin (full access), admin (full access), manager (no delete), staff (operations only), technician (service-focused)';
