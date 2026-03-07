-- ============================================
-- Migration 042: Make invoice auto-numbering safe with custom values
-- ============================================

-- Keep auto-generation for blank invoice_number and make numbering concurrency-safe.
-- A sequence prevents duplicate auto-generated values when multiple inserts happen at once.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

SELECT setval(
  'invoice_number_seq',
  COALESCE(
    (
      SELECT MAX((regexp_match(invoice_number, '^INV-([0-9]+)$'))[1]::INTEGER)
      FROM invoices
      WHERE invoice_number ~ '^INV-([0-9]+)$'
    ),
    0
  ),
  true
);

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('invoice_number_seq');

  NEW.invoice_number = 'INV-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
