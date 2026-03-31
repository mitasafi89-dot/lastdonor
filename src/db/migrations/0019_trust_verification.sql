-- Migration 0019: Trust & Verification System (Phase 1)
-- Adds new enums, tables, and columns for campaign verification,
-- milestone-based fund release, and trust infrastructure.

-- ─── New Enums ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM (
    'pending',
    'evidence_submitted',
    'approved',
    'rejected',
    'overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fund_release_status AS ENUM (
    'held',
    'approved',
    'processing',
    'released',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE info_request_status AS ENUM (
    'pending',
    'responded',
    'expired',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE support_channel AS ENUM (
    'site_chat',
    'whatsapp',
    'email',
    'phone',
    'social_media'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_batch_status AS ENUM (
    'processing',
    'completed',
    'partial_failure'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_record_status AS ENUM (
    'pending',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bulk_email_status AS ENUM (
    'draft',
    'sending',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE support_conversation_status AS ENUM (
    'open',
    'assigned',
    'pending_user',
    'resolved',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE support_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Expand Existing Enums ──────────────────────────────────────────────────

-- Campaign status: add paused, under_review, suspended, cancelled
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Verification status: expand from 3-value to 10-value
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'submitted_for_review';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'documents_uploaded';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'identity_verified';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'fully_verified';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'info_requested';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'suspended';

-- Notification types: add trust & verification related types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_paused';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_resumed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_suspended';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_cancelled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'info_request';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'info_request_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'milestone_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'milestone_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'fund_released';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bulk_refund_processed';

-- ─── Campaigns Table: New Columns ──────────────────────────────────────────

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS paused_reason TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS verification_reviewer_id UUID REFERENCES users(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS milestone_fund_release BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_released_amount INTEGER NOT NULL DEFAULT 0;

-- ─── Donations Table: New Columns ──────────────────────────────────────────

ALTER TABLE donations ADD COLUMN IF NOT EXISTS subscribed_to_updates BOOLEAN NOT NULL DEFAULT false;

-- ─── New Tables ─────────────────────────────────────────────────────────────

-- Verification documents uploaded by campaigner
CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  description TEXT,
  status document_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verification_docs_campaign ON verification_documents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_status ON verification_documents(status);

-- Campaign milestones (3 per campaign)
CREATE TABLE IF NOT EXISTS campaign_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  phase INTEGER NOT NULL CHECK (phase >= 1 AND phase <= 3),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  fund_percentage INTEGER NOT NULL CHECK (fund_percentage >= 10 AND fund_percentage <= 60),
  estimated_completion TIMESTAMPTZ,
  status milestone_status NOT NULL DEFAULT 'pending',
  fund_amount INTEGER,
  released_amount INTEGER DEFAULT 0 NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, phase)
);
CREATE INDEX IF NOT EXISTS idx_milestones_campaign ON campaign_milestones(campaign_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON campaign_milestones(status);

-- Milestone evidence submissions
CREATE TABLE IF NOT EXISTS milestone_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES campaign_milestones(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  submitted_by UUID NOT NULL REFERENCES users(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  description TEXT,
  status document_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_milestone_evidence_milestone ON milestone_evidence(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_evidence_campaign ON milestone_evidence(campaign_id);

-- Fund release records
CREATE TABLE IF NOT EXISTS fund_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  milestone_id UUID NOT NULL REFERENCES campaign_milestones(id),
  amount INTEGER NOT NULL,
  status fund_release_status NOT NULL DEFAULT 'held',
  stripe_transfer_id TEXT,
  stripe_connect_account TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fund_releases_campaign ON fund_releases(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fund_releases_status ON fund_releases(status);

-- Admin information requests
CREATE TABLE IF NOT EXISTS info_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  target_user UUID NOT NULL REFERENCES users(id),
  request_type TEXT NOT NULL,
  details TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status info_request_status NOT NULL DEFAULT 'pending',
  pause_campaign BOOLEAN NOT NULL DEFAULT false,
  response_text TEXT,
  response_files JSONB DEFAULT '[]'::jsonb,
  responded_at TIMESTAMPTZ,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  escalated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_info_requests_campaign ON info_requests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_status ON info_requests(status);
CREATE INDEX IF NOT EXISTS idx_info_requests_deadline ON info_requests(deadline);

-- Donor campaign subscriptions (for email lifecycle updates)
CREATE TABLE IF NOT EXISTS donor_campaign_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_email TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  subscribed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(donor_email, campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_donor_subs_campaign ON donor_campaign_subscriptions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donor_subs_email ON donor_campaign_subscriptions(donor_email);

-- Refund batches (for mass refund tracking)
CREATE TABLE IF NOT EXISTS refund_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  initiated_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  total_donations INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  refunded_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status refund_batch_status NOT NULL DEFAULT 'processing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refund_batches_campaign ON refund_batches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_refund_batches_status ON refund_batches(status);

-- Individual refund records within a batch
CREATE TABLE IF NOT EXISTS refund_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES refund_batches(id),
  donation_id UUID NOT NULL REFERENCES donations(id),
  amount INTEGER NOT NULL,
  stripe_refund_id TEXT,
  status refund_record_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refund_records_batch ON refund_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_refund_records_donation ON refund_records(donation_id);

-- Bulk email sends
CREATE TABLE IF NOT EXISTS bulk_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID NOT NULL REFERENCES users(id),
  template_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status bulk_email_status NOT NULL DEFAULT 'draft',
  campaign_id UUID REFERENCES campaigns(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bulk_emails_status ON bulk_emails(status);

-- Support conversations (unified across channels)
CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  user_name TEXT,
  channel support_channel NOT NULL,
  subject TEXT,
  status support_conversation_status NOT NULL DEFAULT 'open',
  priority support_priority NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES users(id),
  tier INTEGER NOT NULL DEFAULT 1,
  campaign_id UUID REFERENCES campaigns(id),
  external_conversation_id TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_conversations_status ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_conversations_user ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_channel ON support_conversations(channel);
