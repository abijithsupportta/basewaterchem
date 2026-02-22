-- ============================================
-- Migration 017: Add Free Service Type (365-day validity)
-- ============================================

ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'free_service';

ALTER TABLE services
ADD COLUMN IF NOT EXISTS free_service_valid_until DATE;

CREATE INDEX IF NOT EXISTS idx_services_free_valid_until
  ON services(free_service_valid_until)
  WHERE free_service_valid_until IS NOT NULL;
