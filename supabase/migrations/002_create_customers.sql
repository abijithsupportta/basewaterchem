-- ============================================
-- Migration 002: Customers Table
-- ============================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code TEXT UNIQUE, -- e.g., BWC-0001
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  email TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL DEFAULT 'Kottayam',
  district TEXT NOT NULL DEFAULT 'Kottayam',
  state TEXT NOT NULL DEFAULT 'Kerala',
  pincode TEXT,
  location_landmark TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(full_name);
CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_city ON customers(city);

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate customer code
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(customer_code FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM customers
    WHERE customer_code IS NOT NULL;
  NEW.customer_code = 'BWC-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW
  WHEN (NEW.customer_code IS NULL)
  EXECUTE FUNCTION generate_customer_code();
