-- ============================================
-- Migration 037: Enforce unique customer phone
-- ============================================

-- Normalize phone fields to digits-only canonical values.
-- `phone`: keep last 10 digits (India format handling, e.g. +91XXXXXXXXXX).
-- `alt_phone`: same normalization when present.
CREATE OR REPLACE FUNCTION normalize_customer_phone_fields()
RETURNS TRIGGER AS $$
DECLARE
  phone_digits TEXT;
  alt_phone_digits TEXT;
BEGIN
  phone_digits := regexp_replace(coalesce(NEW.phone, ''), '\\D', '', 'g');
  IF length(phone_digits) >= 10 THEN
    NEW.phone := right(phone_digits, 10);
  ELSE
    NEW.phone := phone_digits;
  END IF;

  IF NEW.alt_phone IS NOT NULL THEN
    alt_phone_digits := regexp_replace(NEW.alt_phone, '\\D', '', 'g');
    IF length(alt_phone_digits) >= 10 THEN
      NEW.alt_phone := right(alt_phone_digits, 10);
    ELSE
      NEW.alt_phone := nullif(alt_phone_digits, '');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_customers_phone_fields ON customers;
CREATE TRIGGER normalize_customers_phone_fields
  BEFORE INSERT OR UPDATE OF phone, alt_phone
  ON customers
  FOR EACH ROW
  EXECUTE FUNCTION normalize_customer_phone_fields();

-- Backfill existing records to canonical format.
UPDATE customers
SET
  phone = right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10),
  alt_phone = nullif(right(regexp_replace(coalesce(alt_phone, ''), '\\D', '', 'g'), 10), '');

-- Enforce exactly 10 digits for primary phone.
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_phone_10_digits_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_phone_10_digits_check
  CHECK (phone ~ '^\\d{10}$');

-- Guarantee uniqueness at DB level using normalized phone value.
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone_normalized
  ON customers ((right(regexp_replace(phone, '\\D', '', 'g'), 10)));
