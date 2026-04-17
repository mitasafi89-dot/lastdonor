-- Migration 0020: Add 'reached' status to milestone_status enum
-- A milestone becomes 'reached' when cumulative donations cross its funding threshold.
-- No auto-release - identity verification + admin review required before funds move.

ALTER TYPE milestone_status ADD VALUE IF NOT EXISTS 'reached' AFTER 'pending';
