-- ============================================
-- Migration 031: Email Delivery Logs
-- ============================================

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_delivery_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_delivery_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_delivery_logs(created_at DESC);

ALTER TABLE email_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view email logs" ON email_delivery_logs;
CREATE POLICY "Admins can view email logs"
  ON email_delivery_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.role IN ('superadmin', 'admin', 'manager')
    )
  );
