-- Add optional gallery images array to campaigns (up to 5 extra images beyond hero)
ALTER TABLE campaigns ADD COLUMN gallery_images jsonb DEFAULT '[]'::jsonb;
