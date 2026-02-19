-- ============================================
-- Migration 007: Complaints Table
-- ============================================

CREATE TYPE complaint_status AS ENUM (
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
  'escalated'
);

CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_number TEXT UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_product_id UUID REFERENCES customer_products(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority complaint_priority NOT NULL DEFAULT 'medium',
  status complaint_status NOT NULL DEFAULT 'open',
  is_under_warranty BOOLEAN NOT NULL DEFAULT false,
  assigned_to UUID REFERENCES staff(id),
  resolved_date TIMESTAMPTZ,
  resolution_notes TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complaints_customer ON complaints(customer_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_assigned ON complaints(assigned_to);

CREATE TRIGGER set_complaints_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add FK from services to complaints
ALTER TABLE services
  ADD CONSTRAINT fk_services_complaint
  FOREIGN KEY (complaint_id) REFERENCES complaints(id);

-- Auto-generate complaint number
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(complaint_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM complaints
    WHERE complaint_number IS NOT NULL;
  NEW.complaint_number = 'CMP-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_complaint_number
  BEFORE INSERT ON complaints
  FOR EACH ROW
  WHEN (NEW.complaint_number IS NULL)
  EXECUTE FUNCTION generate_complaint_number();
