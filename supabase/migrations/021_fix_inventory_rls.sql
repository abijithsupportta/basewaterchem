-- ============================================
-- Fix: Add RLS Policies to Inventory Tables
-- Run this if you already ran migration 021
-- ============================================

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
