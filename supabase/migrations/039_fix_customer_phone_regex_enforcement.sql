-- Fix regex escaping for customer phone normalization and constraints (post-037 repair)

CREATE OR REPLACE FUNCTION normalize_customer_phone_fields()
RETURNS TRIGGER AS $$
DECLARE
  phone_digits TEXT;
  alt_phone_digits TEXT;
BEGIN
  phone_digits := regexp_replace(coalesce(NEW.phone, ''), '[^0-9]', '', 'g');
  IF length(phone_digits) >= 10 THEN
    NEW.phone := right(phone_digits, 10);
  ELSE
    NEW.phone := phone_digits;
  END IF;

  IF NEW.alt_phone IS NOT NULL THEN
    alt_phone_digits := regexp_replace(NEW.alt_phone, '[^0-9]', '', 'g');
    IF length(alt_phone_digits) >= 10 THEN
      NEW.alt_phone := right(alt_phone_digits, 10);
    ELSE
      NEW.alt_phone := nullif(alt_phone_digits, '');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE customers
SET
  phone = right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10),
  alt_phone = nullif(right(regexp_replace(coalesce(alt_phone, ''), '[^0-9]', '', 'g'), 10), '');

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_phone_10_digits_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_phone_10_digits_check
  CHECK (phone ~ '^[0-9]{10}$') NOT VALID;

DROP INDEX IF EXISTS ux_customers_phone_normalized;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone_normalized
  ON customers ((right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)))
  WHERE regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$';
