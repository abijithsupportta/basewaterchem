-- ============================================
-- Migration 018: Expense Management
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT,
  reference_no TEXT,
  description TEXT,
  created_by_staff_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by_staff_id);

DROP TRIGGER IF EXISTS set_expenses_updated_at ON expenses;
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
CREATE POLICY "Authenticated users can view expenses"
  ON expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can create expenses" ON expenses;
CREATE POLICY "Staff can create expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can update expenses" ON expenses;
CREATE POLICY "Staff can update expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can delete expenses" ON expenses;
CREATE POLICY "Staff can delete expenses"
  ON expenses FOR DELETE
  USING (auth.uid() IS NOT NULL);
