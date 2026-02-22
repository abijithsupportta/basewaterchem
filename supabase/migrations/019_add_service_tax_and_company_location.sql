-- ============================================
-- Migration 019: Service Tax + Company Location
-- ============================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
