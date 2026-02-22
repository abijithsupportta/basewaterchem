-- ============================================
-- Migration 020: Company Settings RLS Policies
-- ============================================

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view company settings" ON company_settings;
CREATE POLICY "Authenticated users can view company settings"
  ON company_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
CREATE POLICY "Authenticated users can insert company settings"
  ON company_settings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;
CREATE POLICY "Authenticated users can update company settings"
  ON company_settings FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
