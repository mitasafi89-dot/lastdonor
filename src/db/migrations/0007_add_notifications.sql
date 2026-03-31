-- Notification type enum
CREATE TYPE "public"."notification_type" AS ENUM(
  'donation_refunded',
  'donation_refund_reversed',
  'campaign_completed',
  'campaign_archived',
  'campaign_status_changed',
  'role_changed',
  'account_deleted'
);

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "link" text,
  "read" boolean NOT NULL DEFAULT false,
  "email_sent" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications" ("user_id", "read");
CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications" ("created_at");
