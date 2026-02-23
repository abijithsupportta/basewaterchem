-- Run this manually in Supabase SQL Editor on the SAME project used by the app.

-- 1) Before counts
SELECT
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM services) AS services,
  (SELECT COUNT(*) FROM invoices) AS invoices,
  (SELECT COUNT(*) FROM expenses) AS expenses,
  (SELECT COUNT(*) FROM stock_transactions) AS stock_transactions,
  (SELECT COUNT(*) FROM inventory_products) AS inventory_products,
  (SELECT COUNT(*) FROM inventory_categories) AS inventory_categories,
  (SELECT COUNT(*) FROM products) AS products,
  (SELECT COUNT(*) FROM auth.users) AS auth_users,
  (SELECT COUNT(*) FROM staff) AS staff;

-- 2) Execute cleanup
SELECT * FROM cleanup_non_superadmin_data();

-- 3) After counts
SELECT
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM services) AS services,
  (SELECT COUNT(*) FROM invoices) AS invoices,
  (SELECT COUNT(*) FROM expenses) AS expenses,
  (SELECT COUNT(*) FROM stock_transactions) AS stock_transactions,
  (SELECT COUNT(*) FROM inventory_products) AS inventory_products,
  (SELECT COUNT(*) FROM inventory_categories) AS inventory_categories,
  (SELECT COUNT(*) FROM products) AS products,
  (SELECT COUNT(*) FROM auth.users) AS auth_users,
  (SELECT COUNT(*) FROM staff) AS staff;
