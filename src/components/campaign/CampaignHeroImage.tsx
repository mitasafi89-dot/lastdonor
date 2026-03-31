'use client';

import { useState } from 'react';
import Image from 'next/image';

const CATEGORY_FALLBACK_MAP: Record<string, string> = {
  emergency: 'disaster',
  charity: 'community',
  education: 'community',
  animal: 'community',
  environment: 'community',
  business: 'community',
  competition: 'community',
  creative: 'community',
  event: 'community',
  faith: 'community',
  family: 'essential-needs',
  sports: 'community',
  travel: 'community',
  volunteer: 'community',
  wishes: 'memorial',
};

function getCategoryFallback(category: string): string {
  const mapped = CATEGORY_FALLBACK_MAP[category] ?? category;
  return `/images/categories/${mapped}-default.svg`;
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

export function CampaignHeroImage({
  src,
  alt,
  category = 'community',
  fill,
  sizes,
  priority,
  className,
}: CampaignHeroImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (!failed) {
      setFailed(true);
      setImgSrc(getCategoryFallback(category));
    }
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
