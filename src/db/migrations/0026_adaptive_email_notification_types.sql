-- Migration: Add new notification types for adaptive behavioral email system
-- New types: abandoned_donation, donor_reengagement, creator_inactivity

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'abandoned_donation';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'donor_reengagement';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'creator_inactivity';
