-- ============================================
-- Migration 025: Cleanup Function Hardening
-- ============================================
-- This migration improves cleanup reliability and visibility.
-- It keeps only superadmin auth/staff and returns delete counts.

-- Previous migration 024 created cleanup_non_superadmin_data() with RETURNS void.
-- PostgreSQL cannot change a function return type via CREATE OR REPLACE,
-- so drop the old signature first.
DROP FUNCTION IF EXISTS cleanup_non_superadmin_data();

CREATE OR REPLACE FUNCTION cleanup_non_superadmin_data()
RETURNS TABLE (
  deleted_notifications BIGINT,
  deleted_stock_transactions BIGINT,
  deleted_invoice_items BIGINT,
  deleted_quotation_items BIGINT,
  deleted_invoices BIGINT,
  deleted_quotations BIGINT,
  deleted_services BIGINT,
  deleted_complaints BIGINT,
  deleted_amc_contracts BIGINT,
  deleted_expenses BIGINT,
  deleted_customer_products BIGINT,
  deleted_customers BIGINT,
  deleted_inventory_products BIGINT,
  deleted_inventory_categories BIGINT,
  deleted_products BIGINT,
  deleted_non_superadmin_staff BIGINT,
  deleted_branches BIGINT,
  deleted_auth_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  keep_auth_user_ids UUID[];
  v_deleted BIGINT;
  v_stock_tables TEXT;
BEGIN
  -- Ensure cleanup is not blocked by RLS policies
  PERFORM set_config('row_security', 'off', true);

  SELECT COALESCE(array_agg(auth_user_id), ARRAY[]::UUID[])
  INTO keep_auth_user_ids
  FROM staff
  WHERE role = 'superadmin'
    AND auth_user_id IS NOT NULL;

  IF COALESCE(array_length(keep_auth_user_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Cleanup aborted: no superadmin auth user found in staff table.';
  END IF;

  SELECT COUNT(*) INTO deleted_notifications FROM notifications;
  SELECT COUNT(*) INTO deleted_stock_transactions FROM stock_transactions;
  SELECT COUNT(*) INTO deleted_invoice_items FROM invoice_items;
  SELECT COUNT(*) INTO deleted_quotation_items FROM quotation_items;
  SELECT COUNT(*) INTO deleted_invoices FROM invoices;
  SELECT COUNT(*) INTO deleted_quotations FROM quotations;
  SELECT COUNT(*) INTO deleted_services FROM services;
  SELECT COUNT(*) INTO deleted_complaints FROM complaints;
  SELECT COUNT(*) INTO deleted_amc_contracts FROM amc_contracts;
  SELECT COUNT(*) INTO deleted_expenses FROM expenses;
  SELECT COUNT(*) INTO deleted_customer_products FROM customer_products;
  SELECT COUNT(*) INTO deleted_customers FROM customers;
  SELECT COUNT(*) INTO deleted_inventory_products FROM inventory_products;
  SELECT COUNT(*) INTO deleted_inventory_categories FROM inventory_categories;
  SELECT COUNT(*) INTO deleted_products FROM products;

  -- Truncate every stock/inventory table in public schema (future-proof)
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
  INTO v_stock_tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND (tablename LIKE 'inventory\_%' ESCAPE '\\' OR tablename LIKE 'stock\_%' ESCAPE '\\');

  IF v_stock_tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || v_stock_tables || ' RESTART IDENTITY CASCADE';
  END IF;

  -- Guaranteed full wipe of business tables
  TRUNCATE TABLE
    notifications,
    invoice_items,
    quotation_items,
    invoices,
    quotations,
    services,
    complaints,
    amc_contracts,
    expenses,
    customer_products,
    customers,
    products
  RESTART IDENTITY CASCADE;

  DELETE FROM staff
  WHERE role <> 'superadmin';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  deleted_non_superadmin_staff := v_deleted;

  DELETE FROM branches b
  WHERE NOT EXISTS (
    SELECT 1 FROM staff s
    WHERE s.role = 'superadmin'
      AND s.branch_id = b.id
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  deleted_branches := v_deleted;

  DELETE FROM auth.users
  WHERE id <> ALL (keep_auth_user_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  deleted_auth_users := v_deleted;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_non_superadmin_data() TO authenticated;

COMMENT ON FUNCTION cleanup_non_superadmin_data IS
'Deletes all non-superadmin operational data/users and removes non-superadmin auth.users; returns delete counts for verification.';
