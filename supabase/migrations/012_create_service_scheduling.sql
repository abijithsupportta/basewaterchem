-- ============================================
-- Migration 012: Service Scheduling Function
-- This is the CORE business logic:
-- Automatically generates upcoming service schedules
-- based on AMC contracts and service intervals
-- ============================================

-- Function to generate next service for an AMC contract
CREATE OR REPLACE FUNCTION generate_next_amc_service(
  p_amc_contract_id UUID
) RETURNS UUID AS $$
DECLARE
  v_contract RECORD;
  v_last_service_date DATE;
  v_next_service_date DATE;
  v_service_id UUID;
BEGIN
  -- Get contract details
  SELECT ac.*, c.id as cust_id, cp.id as cp_id
    INTO v_contract
    FROM amc_contracts ac
    JOIN customers c ON c.id = ac.customer_id
    JOIN customer_products cp ON cp.id = ac.customer_product_id
    WHERE ac.id = p_amc_contract_id
    AND ac.status = 'active';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Find most recent completed service for this contract
  SELECT MAX(completed_date)
    INTO v_last_service_date
    FROM services
    WHERE amc_contract_id = p_amc_contract_id
    AND status = 'completed';

  -- Calculate next service date
  IF v_last_service_date IS NULL THEN
    -- No services yet, schedule from start date + interval
    v_next_service_date := v_contract.start_date + (v_contract.service_interval_months || ' months')::INTERVAL;
  ELSE
    v_next_service_date := v_last_service_date + (v_contract.service_interval_months || ' months')::INTERVAL;
  END IF;

  -- Don't schedule beyond contract end date
  IF v_next_service_date > v_contract.end_date THEN
    RETURN NULL;
  END IF;

  -- Check if service already exists for this date range (within 15 days)
  IF EXISTS (
    SELECT 1 FROM services
    WHERE amc_contract_id = p_amc_contract_id
    AND status IN ('scheduled', 'assigned')
    AND ABS(scheduled_date - v_next_service_date) < 15
  ) THEN
    RETURN NULL;
  END IF;

  -- Create the scheduled service
  INSERT INTO services (
    customer_id, customer_product_id, amc_contract_id,
    service_type, status, scheduled_date,
    is_under_amc, payment_status, description
  ) VALUES (
    v_contract.customer_id, v_contract.cp_id, p_amc_contract_id,
    'amc_service', 'scheduled', v_next_service_date,
    true, 'not_applicable',
    'Scheduled AMC service - Contract ' || v_contract.contract_number
  ) RETURNING id INTO v_service_id;

  RETURN v_service_id;
END;
$$ LANGUAGE plpgsql;

-- Function to batch-generate all upcoming services
CREATE OR REPLACE FUNCTION generate_all_upcoming_services()
RETURNS INTEGER AS $$
DECLARE
  v_contract RECORD;
  v_count INTEGER := 0;
  v_result UUID;
BEGIN
  FOR v_contract IN
    SELECT id FROM amc_contracts WHERE status = 'active'
  LOOP
    v_result := generate_next_amc_service(v_contract.id);
    IF v_result IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- View: Upcoming services with customer/product details
CREATE OR REPLACE VIEW upcoming_services_view AS
SELECT
  s.id,
  s.service_number,
  s.scheduled_date,
  s.scheduled_time_slot,
  s.service_type,
  s.status,
  s.is_under_warranty,
  s.is_under_amc,
  c.id as customer_id,
  c.customer_code,
  c.full_name as customer_name,
  c.phone as customer_phone,
  c.address_line1 as customer_address,
  c.city as customer_city,
  p.name as product_name,
  p.brand as product_brand,
  p.model as product_model,
  st.full_name as technician_name,
  st.phone as technician_phone,
  ac.contract_number as amc_contract_number,
  s.payment_status
FROM services s
JOIN customers c ON c.id = s.customer_id
LEFT JOIN customer_products cp ON cp.id = s.customer_product_id
LEFT JOIN products p ON p.id = cp.product_id
LEFT JOIN staff st ON st.id = s.assigned_technician_id
LEFT JOIN amc_contracts ac ON ac.id = s.amc_contract_id
WHERE s.status IN ('scheduled', 'assigned', 'rescheduled')
ORDER BY s.scheduled_date ASC;

-- View: Overdue services
CREATE OR REPLACE VIEW overdue_services_view AS
SELECT * FROM upcoming_services_view
WHERE scheduled_date < CURRENT_DATE
AND status IN ('scheduled', 'assigned', 'rescheduled');

-- View: Dashboard statistics
CREATE OR REPLACE VIEW dashboard_stats_view AS
SELECT
  (SELECT COUNT(*) FROM customers WHERE is_active = true) as total_customers,
  (SELECT COUNT(*) FROM customer_products WHERE status = 'active') as active_installations,
  (SELECT COUNT(*) FROM amc_contracts WHERE status = 'active') as active_amc_contracts,
  (SELECT COUNT(*) FROM services WHERE status IN ('scheduled', 'assigned') AND scheduled_date = CURRENT_DATE) as todays_services,
  (SELECT COUNT(*) FROM services WHERE status IN ('scheduled', 'assigned', 'rescheduled') AND scheduled_date < CURRENT_DATE) as overdue_services,
  (SELECT COUNT(*) FROM services WHERE status IN ('scheduled', 'assigned') AND scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as this_week_services,
  (SELECT COUNT(*) FROM complaints WHERE status IN ('open', 'acknowledged', 'in_progress')) as open_complaints,
  (SELECT COUNT(*) FROM amc_contracts WHERE status = 'active' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') as amc_expiring_soon,
  (SELECT COUNT(*) FROM invoices WHERE status IN ('sent', 'overdue')) as pending_payments;
