-- ============================================
-- Migration 006: Services Table
-- ============================================

CREATE TYPE service_type AS ENUM (
  'amc_service',      -- Scheduled AMC service (free during contract)
  'paid_service',     -- After warranty / AMC expired
  'installation',     -- New product installation
  'complaint_service',-- Service arising from complaint
  'warranty_service'  -- Free service under warranty
);

CREATE TYPE service_status AS ENUM (
  'scheduled',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'rescheduled'
);

CREATE TYPE payment_status AS ENUM (
  'not_applicable', -- free service
  'pending',
  'partial',
  'paid'
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_number TEXT UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_product_id UUID REFERENCES customer_products(id),
  amc_contract_id UUID REFERENCES amc_contracts(id),
  complaint_id UUID, -- will add FK after complaints table is created
  service_type service_type NOT NULL,
  status service_status NOT NULL DEFAULT 'scheduled',
  scheduled_date DATE NOT NULL,
  scheduled_time_slot TEXT, -- e.g., 'Morning', 'Afternoon', 'Evening'
  completed_date DATE,
  assigned_technician_id UUID REFERENCES staff(id),
  description TEXT,
  work_done TEXT,
  parts_used JSONB DEFAULT '[]'::JSONB, -- [{part_id, part_name, qty, cost}]
  parts_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_under_warranty BOOLEAN NOT NULL DEFAULT false,
  is_under_amc BOOLEAN NOT NULL DEFAULT false,
  payment_status payment_status NOT NULL DEFAULT 'not_applicable',
  customer_feedback TEXT,
  customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
  technician_notes TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_customer ON services(customer_id);
CREATE INDEX idx_services_cp ON services(customer_product_id);
CREATE INDEX idx_services_amc ON services(amc_contract_id);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_type ON services(service_type);
CREATE INDEX idx_services_scheduled ON services(scheduled_date);
CREATE INDEX idx_services_technician ON services(assigned_technician_id);
CREATE INDEX idx_services_payment ON services(payment_status);

CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate service number
CREATE OR REPLACE FUNCTION generate_service_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(service_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM services
    WHERE service_number IS NOT NULL;
  NEW.service_number = 'SRV-' || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_service_number
  BEFORE INSERT ON services
  FOR EACH ROW
  WHEN (NEW.service_number IS NULL)
  EXECUTE FUNCTION generate_service_number();
