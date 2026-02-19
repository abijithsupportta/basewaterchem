-- ============================================
-- Migration 011: Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM staff WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE auth_user_id = auth.uid()
    AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ======== STAFF POLICIES ========
CREATE POLICY "Staff can view all staff" ON staff
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage staff" ON staff
  FOR ALL USING (is_admin_or_manager());

-- ======== CUSTOMERS POLICIES ========
CREATE POLICY "Authenticated users can view customers" ON customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can insert customers" ON customers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update customers" ON customers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can delete customers" ON customers
  FOR DELETE USING (is_admin_or_manager());

-- ======== PRODUCTS POLICIES ========
CREATE POLICY "Anyone can view products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage products" ON products
  FOR ALL USING (is_admin_or_manager());

-- ======== CUSTOMER PRODUCTS POLICIES ========
CREATE POLICY "Authenticated users can view customer products" ON customer_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage customer products" ON customer_products
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ======== AMC CONTRACTS POLICIES ========
CREATE POLICY "Authenticated users can view AMC contracts" ON amc_contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage AMC contracts" ON amc_contracts
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ======== SERVICES POLICIES ========
CREATE POLICY "Authenticated users can view services" ON services
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage services" ON services
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ======== COMPLAINTS POLICIES ========
CREATE POLICY "Authenticated users can view complaints" ON complaints
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage complaints" ON complaints
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ======== QUOTATIONS POLICIES ========
CREATE POLICY "Authenticated users can view quotations" ON quotations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage quotations" ON quotations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view quotation items" ON quotation_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage quotation items" ON quotation_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ======== INVOICES POLICIES ========
CREATE POLICY "Authenticated users can view invoices" ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage invoices" ON invoices
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view invoice items" ON invoice_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage invoice items" ON invoice_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ======== NOTIFICATIONS POLICIES ========
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    recipient_id IN (
      SELECT id FROM staff WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (
    recipient_id IN (
      SELECT id FROM staff WHERE auth_user_id = auth.uid()
    )
  );
