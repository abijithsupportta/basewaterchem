-- ============================================
-- Migration 005: AMC Contracts
-- ============================================

CREATE TYPE amc_status AS ENUM ('active', 'expired', 'cancelled', 'pending_renewal');

CREATE TABLE amc_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number TEXT UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_product_id UUID NOT NULL REFERENCES customer_products(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  service_interval_months INTEGER NOT NULL DEFAULT 3, -- 3 or 4 month intervals
  total_services_included INTEGER NOT NULL DEFAULT 4, -- services per year
  services_completed INTEGER NOT NULL DEFAULT 0,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  status amc_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_amc_customer ON amc_contracts(customer_id);
CREATE INDEX idx_amc_cp ON amc_contracts(customer_product_id);
CREATE INDEX idx_amc_status ON amc_contracts(status);
CREATE INDEX idx_amc_end_date ON amc_contracts(end_date);

CREATE TRIGGER set_amc_updated_at
  BEFORE UPDATE ON amc_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate contract number
CREATE OR REPLACE FUNCTION generate_amc_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM amc_contracts
    WHERE contract_number IS NOT NULL;
  NEW.contract_number = 'AMC-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_amc_number
  BEFORE INSERT ON amc_contracts
  FOR EACH ROW
  WHEN (NEW.contract_number IS NULL)
  EXECUTE FUNCTION generate_amc_number();
