-- Migration 0017: Add campaign_submitted notification type
-- Allows admins to receive in-app notifications when users submit campaigns for review.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_submitted';
