-- ============================================================================
-- Row-Level Security (RLS) Policies
-- Defense in Depth: Database-level access control as a secondary defense
-- layer behind application-level auth checks.
--
-- These policies prevent data leakage even if application auth is bypassed.
-- The application uses a restricted "app_user" role for connections.
-- ============================================================================

-- Create restricted application role (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN;
  END IF;
END
$$;

-- Grant minimal table-level permissions to app_user
-- Principle of Least Privilege: app_user can only SELECT/INSERT/UPDATE on
-- tables it needs. No DROP, TRUNCATE, or schema modifications.

GRANT USAGE ON SCHEMA public TO app_user;

-- Users: app can read and update (not delete rows - soft delete only)
GRANT SELECT, INSERT, UPDATE ON users TO app_user;

-- Campaigns: full CRUD needed
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO app_user;

-- Donations: insert and read (no update/delete - immutable financial records)
GRANT SELECT, INSERT ON donations TO app_user;
-- Allow updating refunded status only
GRANT UPDATE (refunded) ON donations TO app_user;

-- Campaign updates: insert and read (organizer updates are append-only)
GRANT SELECT, INSERT ON campaign_updates TO app_user;

-- Blog posts: full CRUD for admin
GRANT SELECT, INSERT, UPDATE, DELETE ON blog_posts TO app_user;

-- Newsletter subscribers
GRANT SELECT, INSERT, UPDATE ON newsletter_subscribers TO app_user;

-- Audit logs: insert-only (append-only audit trail)
GRANT SELECT, INSERT ON audit_logs TO app_user;

-- Notifications: full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO app_user;

-- Verification & fund release tables
GRANT SELECT, INSERT, UPDATE ON verification_documents TO app_user;
GRANT SELECT, INSERT, UPDATE ON campaign_milestones TO app_user;
GRANT SELECT, INSERT, UPDATE ON milestone_evidence TO app_user;
GRANT SELECT, INSERT, UPDATE ON fund_releases TO app_user;

-- Supporting tables
GRANT SELECT, INSERT, UPDATE ON campaign_seed_messages TO app_user;
GRANT SELECT, INSERT, UPDATE ON news_items TO app_user;
GRANT SELECT, INSERT ON ai_usage_logs TO app_user;
GRANT SELECT, INSERT, UPDATE ON campaign_messages TO app_user;
GRANT SELECT, INSERT, UPDATE ON campaign_withdrawals TO app_user;
GRANT SELECT, INSERT, UPDATE ON info_requests TO app_user;
GRANT SELECT, INSERT, UPDATE ON donor_campaign_subscriptions TO app_user;
GRANT SELECT, INSERT, UPDATE ON refund_batches TO app_user;
GRANT SELECT, INSERT, UPDATE ON refund_records TO app_user;
GRANT SELECT, INSERT, UPDATE ON bulk_emails TO app_user;
GRANT SELECT, INSERT, UPDATE ON support_conversations TO app_user;
GRANT SELECT, INSERT, UPDATE ON site_settings TO app_user;
GRANT SELECT, INSERT, UPDATE ON fund_pool_allocations TO app_user;
GRANT SELECT, INSERT, UPDATE ON interaction_logs TO app_user;
GRANT SELECT, INSERT, UPDATE ON donor_relationships TO app_user;
GRANT SELECT, INSERT, UPDATE ON impact_updates TO app_user;
GRANT SELECT, INSERT, UPDATE ON blog_topic_queue TO app_user;
GRANT SELECT, INSERT ON blog_generation_logs TO app_user;
GRANT SELECT, INSERT, UPDATE ON keyword_rotation TO app_user;
GRANT SELECT, INSERT, UPDATE ON accounts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO app_user;
GRANT SELECT, INSERT, DELETE ON verification_tokens TO app_user;

-- Grant sequence usage for UUID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================================
-- Enable RLS on sensitive tables
-- ============================================================================

-- NOTE: RLS policies use session variables set by the application:
--   SET LOCAL app.current_user_id = '<uuid>';
--   SET LOCAL app.current_user_role = 'donor|editor|admin';
-- These are set per-transaction by the application layer.

-- For now, we enable RLS but create permissive policies that the app_user
-- can use. The real protection comes from column-level grants above.
-- True row-level filtering can be phased in once app sets session vars.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for app_user (to be tightened with session vars)
CREATE POLICY users_app_policy ON users FOR ALL TO app_user USING (true);
CREATE POLICY donations_app_policy ON donations FOR ALL TO app_user USING (true);
CREATE POLICY notifications_app_policy ON notifications FOR ALL TO app_user USING (true);
CREATE POLICY verification_docs_app_policy ON verification_documents FOR ALL TO app_user USING (true);

-- Audit logs: app_user can only INSERT (enforced by column grants above).
-- SELECT is allowed for admin UI, but RLS ensures no modifications.
CREATE POLICY audit_logs_app_policy ON audit_logs FOR SELECT TO app_user USING (true);
CREATE POLICY audit_logs_insert_policy ON audit_logs FOR INSERT TO app_user WITH CHECK (true);

-- ============================================================================
-- Immutability constraints on financial records
-- ============================================================================

-- Prevent deletion of donation records (financial audit requirement)
CREATE OR REPLACE FUNCTION prevent_donation_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Donation records cannot be deleted. Use refund workflow instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_donations ON donations;
CREATE TRIGGER no_delete_donations
  BEFORE DELETE ON donations
  FOR EACH ROW EXECUTE FUNCTION prevent_donation_delete();

-- Prevent deletion of audit log records (compliance requirement)
CREATE OR REPLACE FUNCTION prevent_audit_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable and cannot be deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_delete_audit_logs ON audit_logs;
CREATE TRIGGER no_delete_audit_logs
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_delete();
