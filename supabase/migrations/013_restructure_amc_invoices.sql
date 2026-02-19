-- ============================================
-- Migration 013: Restructure for AMC-Invoice Flow
-- 1. Add payment_date to invoices (fixes missing column error)
-- 2. Add item_name to invoice_items
-- 3. Add AMC fields to invoices
-- 4. Add invoice_id to amc_contracts
-- 5. Make customer_product_id nullable in amc_contracts
-- ============================================

-- Fix: Add payment_date column (was referenced in code but never created)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;

-- Add item_name to invoice_items for direct item naming without products
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_name TEXT;

-- Make product_id nullable in invoice_items (no longer required)
ALTER TABLE invoice_items ALTER COLUMN product_id DROP NOT NULL;

-- Add AMC fields to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amc_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amc_period_months INTEGER;

-- Add invoice_id to amc_contracts for invoice-driven AMC
ALTER TABLE amc_contracts ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

-- Make customer_product_id nullable (AMC no longer requires a product)
ALTER TABLE amc_contracts ALTER COLUMN customer_product_id DROP NOT NULL;

-- Create index for invoice-based AMC lookups
CREATE INDEX IF NOT EXISTS idx_amc_invoice ON amc_contracts(invoice_id);

-- ============================================
-- Dashboard stats view (replaces missing view)
-- ============================================
DROP VIEW IF EXISTS dashboard_stats_view;
CREATE VIEW dashboard_stats_view AS
SELECT
  (SELECT COUNT(*) FROM customers WHERE is_active = true) AS total_customers,
  (SELECT COUNT(*) FROM amc_contracts WHERE status = 'active') AS active_amc_contracts,
  (SELECT COUNT(*) FROM services WHERE scheduled_date = CURRENT_DATE AND status IN ('scheduled', 'assigned', 'in_progress')) AS todays_services,
  (SELECT COUNT(*) FROM services WHERE scheduled_date < CURRENT_DATE AND status IN ('scheduled', 'assigned', 'rescheduled')) AS overdue_services,
  (SELECT COUNT(*) FROM services WHERE scheduled_date >= date_trunc('week', CURRENT_DATE) AND scheduled_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' AND status IN ('scheduled', 'assigned')) AS this_week_services,
  (SELECT COUNT(*) FROM amc_contracts WHERE status = 'active' AND end_date <= CURRENT_DATE + INTERVAL '30 days') AS amc_expiring_soon,
  (SELECT COUNT(*) FROM invoices WHERE status IN ('draft', 'sent', 'partial', 'overdue')) AS pending_payments,
  (SELECT COUNT(*) FROM services WHERE service_type = 'amc_service' AND scheduled_date >= date_trunc('month', CURRENT_DATE) AND scheduled_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month') AS amc_services_this_month,
  (SELECT COUNT(*) FROM services WHERE service_type = 'amc_service' AND scheduled_date >= date_trunc('week', CURRENT_DATE) AND scheduled_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days') AS amc_services_this_week,
  (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'paid' AND payment_date >= date_trunc('month', CURRENT_DATE)) AS revenue_this_month;
