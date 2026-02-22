-- ============================================
-- Migration 021: Inventory Management System
-- ============================================

-- Categories for inventory products
CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventory products (stock items)
CREATE TABLE inventory_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE, -- Stock Keeping Unit
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0, -- Alert threshold
  unit_of_measure TEXT DEFAULT 'piece', -- piece, box, liter, etc.
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock transactions log for tracking stock movements
CREATE TYPE stock_transaction_type AS ENUM (
  'purchase',      -- Stock added (purchase)
  'sale',          -- Stock reduced (invoice)
  'service',       -- Stock reduced (service parts)
  'adjustment',    -- Manual adjustment
  'return',        -- Stock returned
  'damage'         -- Stock damaged/written off
);

CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  transaction_type stock_transaction_type NOT NULL,
  quantity INTEGER NOT NULL, -- positive for addition, negative for reduction
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reference_type TEXT, -- 'invoice', 'service', 'manual'
  reference_id UUID, -- ID of invoice, service, etc.
  notes TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add inventory product reference to invoice_items
ALTER TABLE invoice_items 
  ADD COLUMN inventory_product_id UUID REFERENCES inventory_products(id) ON DELETE SET NULL;

-- Add inventory product reference to service parts (modify parts_used structure)
-- Note: parts_used is JSONB, no schema change needed, but we'll store inventory_product_id in the JSON

-- Indexes
CREATE INDEX idx_inventory_products_category ON inventory_products(category_id);
CREATE INDEX idx_inventory_products_active ON inventory_products(is_active);
CREATE INDEX idx_inventory_products_sku ON inventory_products(sku);
CREATE INDEX idx_stock_transactions_product ON stock_transactions(product_id);
CREATE INDEX idx_stock_transactions_type ON stock_transactions(transaction_type);
CREATE INDEX idx_stock_transactions_reference ON stock_transactions(reference_type, reference_id);

-- Triggers
CREATE TRIGGER set_inventory_categories_updated_at
  BEFORE UPDATE ON inventory_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_inventory_products_updated_at
  BEFORE UPDATE ON inventory_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate SKU if not provided
CREATE OR REPLACE FUNCTION generate_product_sku()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.sku IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)), 0) + 1
      INTO next_num
      FROM inventory_products
      WHERE sku LIKE 'SKU-%';
    NEW.sku = 'SKU-' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_product_sku
  BEFORE INSERT ON inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_sku();

-- Function to log stock transactions and update stock quantity
CREATE OR REPLACE FUNCTION log_stock_transaction(
  p_product_id UUID,
  p_transaction_type stock_transaction_type,
  p_quantity INTEGER,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  -- Get current stock
  SELECT stock_quantity INTO v_current_stock
  FROM inventory_products
  WHERE id = p_product_id;

  -- Calculate new stock
  v_new_stock = v_current_stock + p_quantity;

  -- Prevent negative stock
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', v_current_stock, ABS(p_quantity);
  END IF;

  -- Update product stock
  UPDATE inventory_products
  SET stock_quantity = v_new_stock
  WHERE id = p_product_id;

  -- Log transaction
  INSERT INTO stock_transactions (
    product_id,
    transaction_type,
    quantity,
    previous_quantity,
    new_quantity,
    reference_type,
    reference_id,
    notes,
    created_by
  ) VALUES (
    p_product_id,
    p_transaction_type,
    p_quantity,
    v_current_stock,
    v_new_stock,
    p_reference_type,
    p_reference_id,
    p_notes,
    p_created_by
  );
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_categories
CREATE POLICY "Allow authenticated users to view categories"
  ON inventory_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create categories"
  ON inventory_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update categories"
  ON inventory_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete categories"
  ON inventory_categories FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for inventory_products
CREATE POLICY "Allow authenticated users to view products"
  ON inventory_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create products"
  ON inventory_products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update products"
  ON inventory_products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete products"
  ON inventory_products FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for stock_transactions
CREATE POLICY "Allow authenticated users to view transactions"
  ON stock_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create transactions"
  ON stock_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON inventory_categories TO authenticated;
GRANT ALL ON inventory_products TO authenticated;
GRANT ALL ON stock_transactions TO authenticated;
