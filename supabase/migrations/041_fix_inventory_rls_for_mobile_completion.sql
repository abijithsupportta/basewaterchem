-- Ensure mobile app can complete service with stock sync under RLS
-- Adds missing policies/privileges for inventory_products update and stock_transactions insert.

ALTER TABLE IF EXISTS inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_products'
      AND policyname = 'Allow authenticated users to view products'
  ) THEN
    CREATE POLICY "Allow authenticated users to view products"
      ON inventory_products FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_products'
      AND policyname = 'Allow authenticated users to update products'
  ) THEN
    CREATE POLICY "Allow authenticated users to update products"
      ON inventory_products FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stock_transactions'
      AND policyname = 'Allow authenticated users to create transactions'
  ) THEN
    CREATE POLICY "Allow authenticated users to create transactions"
      ON stock_transactions FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stock_transactions'
      AND policyname = 'Allow authenticated users to view transactions'
  ) THEN
    CREATE POLICY "Allow authenticated users to view transactions"
      ON stock_transactions FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT, UPDATE ON TABLE inventory_products TO authenticated;
GRANT SELECT, INSERT ON TABLE stock_transactions TO authenticated;
