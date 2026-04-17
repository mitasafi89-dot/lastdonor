-- Migration: Replace Veriff identity verification with Stripe Identity
-- Renames veriff_session_id/url columns to stripe_verification_id/url on campaigns table.
-- Existing data is preserved (column rename, not drop+add).

-- Step 1: Drop the old unique index
DROP INDEX IF EXISTS "idx_campaigns_veriff_session_id";

-- Step 2: Rename columns
ALTER TABLE "campaigns" RENAME COLUMN "veriff_session_id" TO "stripe_verification_id";
ALTER TABLE "campaigns" RENAME COLUMN "veriff_session_url" TO "stripe_verification_url";

-- Step 3: Create new unique index on the renamed column
CREATE UNIQUE INDEX "idx_campaigns_stripe_verification_id" ON "campaigns" ("stripe_verification_id");
