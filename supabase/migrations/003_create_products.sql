-- ============================================
-- Migration 003: Products Table
-- ============================================

CREATE TYPE product_category AS ENUM (
  'water_purifier',
  'water_filter',
  'water_softener',
  'spare_part',
  'consumable',
  'accessory',
  'other'
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT UNIQUE,
  name TEXT NOT NULL,
  category product_category NOT NULL DEFAULT 'water_purifier',
  brand TEXT,
  model TEXT,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  amc_interval_months INTEGER NOT NULL DEFAULT 3, -- default service interval
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products(name);

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
