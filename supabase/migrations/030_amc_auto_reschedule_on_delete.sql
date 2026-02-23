-- ============================================
-- Migration 030: AMC Auto-Reschedule on Service Deletion
-- ============================================
-- When a scheduled AMC service is deleted:
-- 1. Find the last completed service for that contract
-- 2. Calculate next service date: last_completed_date + interval_months
-- 3. Create new scheduled service with inherited details
-- 4. Only proceed if AMC is active and has available periods

CREATE OR REPLACE FUNCTION handle_amc_service_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_amc_contract RECORD;
  v_last_service_date DATE;
  v_next_service_date DATE;
BEGIN
  -- Only process if deleting a scheduled AMC service
  IF NOT (OLD.is_under_amc AND OLD.service_type = 'amc_service' AND OLD.status = 'scheduled') THEN
    RETURN OLD;
  END IF;

  -- Fetch AMC contract details
  SELECT * INTO v_amc_contract
  FROM amc_contracts
  WHERE id = OLD.amc_contract_id;

  IF v_amc_contract IS NULL THEN
    RETURN OLD;
  END IF;

  -- Check if AMC contract is still active
  IF v_amc_contract.status != 'active' THEN
    RETURN OLD;
  END IF;

  -- Find the last completed service for this contract
  SELECT scheduled_date INTO v_last_service_date
  FROM services
  WHERE amc_contract_id = OLD.amc_contract_id
    AND is_under_amc = TRUE
    AND service_type = 'amc_service'
    AND status IN ('completed', 'in_progress')
  ORDER BY scheduled_date DESC
  LIMIT 1;

  -- If no completed service, use contract start date
  IF v_last_service_date IS NULL THEN
    v_last_service_date := v_amc_contract.start_date;
  END IF;

  -- Calculate next service date
  v_next_service_date := v_last_service_date + (v_amc_contract.service_interval_months || ' months')::INTERVAL;

  -- Create new scheduled service, inheriting technician/branch/notes
  INSERT INTO services (
    customer_id,
    amc_contract_id,
    service_type,
    status,
    scheduled_date,
    description,
    is_under_amc,
    payment_status,
    free_service_valid_until,
    technician_staff_id,
    branch_id,
    notes
  ) VALUES (
    OLD.customer_id,
    OLD.amc_contract_id,
    'amc_service',
    'scheduled',
    v_next_service_date,
    'Rescheduled after deletion: ' || COALESCE(OLD.description, 'AMC Service'),
    TRUE,
    'not_applicable',
    OLD.free_service_valid_until,
    OLD.technician_staff_id,
    OLD.branch_id,
    COALESCE(OLD.notes, '') || ' [Auto-rescheduled from deleted service]'
  );

  -- Update next_service_date on the contract
  UPDATE amc_contracts
  SET next_service_date = v_next_service_date
  WHERE id = OLD.amc_contract_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_amc_auto_reschedule_on_delete ON services;

-- Create trigger: Before deleting a service, check if auto-reschedule applies
CREATE TRIGGER trigger_amc_auto_reschedule_on_delete
BEFORE DELETE ON services
FOR EACH ROW
EXECUTE FUNCTION handle_amc_service_deletion();
