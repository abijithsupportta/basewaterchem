-- ============================================
-- Migration 004: Customer Products (installations)
-- ============================================

CREATE TYPE installation_status AS ENUM ('active', 'inactive', 'removed');

CREATE TABLE customer_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  serial_number TEXT,
  installation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warranty_end_date DATE,
  purchase_price DECIMAL(10, 2),
  status installation_status NOT NULL DEFAULT 'active',
  location_in_premises TEXT, -- e.g., 'Kitchen', 'Bathroom'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cp_customer ON customer_products(customer_id);
CREATE INDEX idx_cp_product ON customer_products(product_id);
CREATE INDEX idx_cp_warranty_end ON customer_products(warranty_end_date);
CREATE INDEX idx_cp_status ON customer_products(status);

CREATE TRIGGER set_cp_updated_at
  BEFORE UPDATE ON customer_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-set warranty end date based on product warranty_months
CREATE OR REPLACE FUNCTION set_warranty_end()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.warranty_end_date IS NULL THEN
    SELECT NEW.installation_date + (p.warranty_months || ' months')::INTERVAL
      INTO NEW.warranty_end_date
      FROM products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_warranty_end
  BEFORE INSERT ON customer_products
  FOR EACH ROW EXECUTE FUNCTION set_warranty_end();
