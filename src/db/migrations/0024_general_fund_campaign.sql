-- Activate the General Fund campaign so it accepts donations
UPDATE campaigns
SET status = 'active',
    verification_status = 'fully_verified',
    published_at = COALESCE(published_at, NOW())
WHERE slug = 'general-fund'
  AND status = 'draft';
