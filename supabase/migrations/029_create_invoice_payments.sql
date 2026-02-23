-- ============================================
-- Migration 029: Invoice Payments History
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_at ON invoice_payments(paid_at);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice payments" ON invoice_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage invoice payments" ON invoice_payments
  FOR ALL USING (auth.uid() IS NOT NULL);
