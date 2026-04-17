-- Row Level Security (RLS) Policies
-- Defense-in-depth: enforces access rules at the database level
-- even if application-layer auth is bypassed.
--
-- These policies assume the app connects as a dedicated role 'app_user'
-- and sets session variable 'app.current_user_id' on each request.
-- For Supabase, the built-in auth.uid() can be used instead.
--
-- IMPORTANT: This migration is a template. Enable RLS only after
-- configuring the app to set session context on every DB connection.
-- Deploying RLS without session context will lock out the application.

-- Step 1: Enable RLS on sensitive tables (does NOT block until policies exist)
-- Uncomment when ready to enforce:

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE milestone_evidence ENABLE ROW LEVEL SECURITY;

-- Step 2: Policies for 'users' table
-- Users can only read/update their own row
-- CREATE POLICY users_self_read ON users
--   FOR SELECT USING (id = current_setting('app.current_user_id', true));
-- CREATE POLICY users_self_update ON users
--   FOR UPDATE USING (id = current_setting('app.current_user_id', true));

-- Step 3: Policies for 'campaigns' table
-- Public read for published campaigns, owner-only write
-- CREATE POLICY campaigns_public_read ON campaigns
--   FOR SELECT USING (status IN ('active', 'completed'));
-- CREATE POLICY campaigns_owner_write ON campaigns
--   FOR ALL USING (organizer_id = current_setting('app.current_user_id', true));

-- Step 4: Policies for 'donations' table
-- Donors can read their own donations, campaign owners can read theirs
-- CREATE POLICY donations_donor_read ON donations
--   FOR SELECT USING (donor_id = current_setting('app.current_user_id', true));
-- CREATE POLICY donations_campaign_owner_read ON donations
--   FOR SELECT USING (
--     campaign_id IN (
--       SELECT id FROM campaigns
--       WHERE organizer_id = current_setting('app.current_user_id', true)
--     )
--   );

-- Step 5: Policies for 'verification_documents' table
-- Only the document owner and admins can access
-- CREATE POLICY verification_docs_owner ON verification_documents
--   FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

-- Step 6: Policies for 'milestone_evidence' table
-- Only campaign owner can insert, admins can review
-- CREATE POLICY milestone_evidence_owner ON milestone_evidence
--   FOR ALL USING (
--     campaign_id IN (
--       SELECT id FROM campaigns
--       WHERE organizer_id = current_setting('app.current_user_id', true)
--     )
--   );

-- Step 7: Admin bypass policy (applies to all tables above)
-- Requires an 'admin' role or session variable
-- CREATE POLICY admin_bypass_users ON users FOR ALL USING (
--   current_setting('app.current_user_role', true) = 'admin'
-- );
-- CREATE POLICY admin_bypass_campaigns ON campaigns FOR ALL USING (
--   current_setting('app.current_user_role', true) = 'admin'
-- );
-- CREATE POLICY admin_bypass_donations ON donations FOR ALL USING (
--   current_setting('app.current_user_role', true) = 'admin'
-- );
-- CREATE POLICY admin_bypass_verification_documents ON verification_documents FOR ALL USING (
--   current_setting('app.current_user_role', true) = 'admin'
-- );
-- CREATE POLICY admin_bypass_milestone_evidence ON milestone_evidence FOR ALL USING (
--   current_setting('app.current_user_role', true) = 'admin'
-- );
