-- ============================================
-- Migration 014: Add discount column to services
-- ============================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) NOT NULL DEFAULT 0;
