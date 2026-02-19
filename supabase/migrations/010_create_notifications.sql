-- ============================================
-- Migration 010: Notifications Table
-- ============================================

CREATE TYPE notification_type AS ENUM (
  'service_due',
  'service_overdue',
  'amc_expiring',
  'amc_expired',
  'complaint_assigned',
  'complaint_updated',
  'warranty_expiring',
  'payment_due',
  'general'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- deep link to related page
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID, -- ID of related entity (service, complaint, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
