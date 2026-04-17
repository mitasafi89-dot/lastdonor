'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getCampaignFallback } from '@/lib/campaign-fallback-pool';

/**
 * All 23 campaign categories have a matching hero.webp in public/images/categories/.
 * This is the last-resort fallback (tier 2) -- local, guaranteed to load.
 */
const CATEGORIES_WITH_HERO_WEBP = new Set([
  'medical', 'disaster', 'military', 'veterans', 'memorial', 'first-responders',
  'community', 'essential-needs', 'emergency', 'charity', 'education', 'animal',
  'environment', 'business', 'competition', 'creative', 'event', 'faith',
  'family', 'sports', 'travel', 'volunteer', 'wishes',
]);

function getHeroWebpPath(category: string): string {
  const safe = CATEGORIES_WITH_HERO_WEBP.has(category) ? category : 'community';
  return `/images/categories/${safe}-hero.webp`;
}

interface CampaignHeroImageProps {
  src: string;
  alt: string;
  category?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Campaign hero image with a three-tier fallback chain:
 *
 *   Tier 0 -> Original external URL (happy path)
 *   Tier 1 -> Unsplash/Pexels stock photo from curated pool
 *             (deterministic per campaign title, emotionally matched to category)
 *   Tier 2 -> Local /images/categories/{cat}-hero.webp
 *             (guaranteed to load, zero network dependency)
 */
export function CampaignHeroImage({
  src,
  alt,
  category = 'community',
  fill,
  sizes,
  priority,
  className,
}: CampaignHeroImageProps) {
  const [tier, setTier] = useState(0);
  const [imgSrc, setImgSrc] = useState(src);

  const handleError = () => {
    if (tier === 0) {
      // Tier 0 failed -> try Unsplash/Pexels from curated pool
      const fallback = getCampaignFallback(category, alt);
      if (fallback) {
        setTier(1);
        setImgSrc(fallback.url);
      } else {
        // Pool empty for this category -> skip to local webp
        setTier(2);
        setImgSrc(getHeroWebpPath(category));
      }
    } else if (tier === 1) {
      // Tier 1 (stock photo) also failed -> use local webp
      setTier(2);
      setImgSrc(getHeroWebpPath(category));
    }
    // Tier 2 is a local static asset; if it fails there is nothing else to try
  };

  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={handleError}
    />
  );
}
