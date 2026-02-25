ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS reminder_days_ahead INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS reminder_send_time TEXT NOT NULL DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS last_whatsapp_reminder_run_on DATE;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS whatsapp_scheduled_status TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_scheduled_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_scheduled_error TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_status TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_error TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_for_date DATE;