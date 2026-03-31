-- Milestone 4: Last Donor Execution & Campaign Completion
-- Adds last_donor_name (for seed donors without user accounts),
-- last_donor_amount (the donation amount that completed the campaign).

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS last_donor_name TEXT,
  ADD COLUMN IF NOT EXISTS last_donor_amount INTEGER;
