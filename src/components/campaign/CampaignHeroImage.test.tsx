import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CampaignHeroImage } from './CampaignHeroImage';

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Mock next/image so we can test onError without real image loading
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, onError, ...rest } = props;
    return (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img
        {...rest}
        data-fill={fill ? 'true' : undefined}
        onError={onError as React.ReactEventHandler<HTMLImageElement>}
      />
    );
  },
}));

// Mock the fallback pool with deterministic data
vi.mock('@/lib/campaign-fallback-pool', () => ({
  getCampaignFallback: (category: string, _seed: string) => {
    if (category === 'empty-category') return null;
    return {
      url: `https://images.unsplash.com/mock-${category}?w=800`,
      attribution: `Photo by Mock on Unsplash`,
    };
  },
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('CampaignHeroImage', () => {
  const defaultProps = {
    src: 'https://example.com/hero.jpg',
    alt: 'Test Campaign Title',
    category: 'medical',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the original image source on initial load', () => {
    render(<CampaignHeroImage {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/hero.jpg');
  });

  it('passes alt, fill, sizes, priority, and className to Image', () => {
    render(
      <CampaignHeroImage
        {...defaultProps}
        fill
        sizes="100vw"
        priority
        className="object-cover"
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Test Campaign Title');
    expect(img).toHaveAttribute('data-fill', 'true');
    expect(img).toHaveAttribute('sizes', '100vw');
    expect(img).toHaveAttribute('class', 'object-cover');
  });

  // ─── Tier 1: Unsplash/Pexels fallback ──────────────────────────────────

  it('switches to Unsplash fallback (tier 1) on first error', () => {
    render(<CampaignHeroImage {...defaultProps} />);
    const img = screen.getByRole('img');

    fireEvent.error(img);

    expect(img).toHaveAttribute(
      'src',
      'https://images.unsplash.com/mock-medical?w=800',
    );
  });

  it('uses the category to select the correct pool', () => {
    render(<CampaignHeroImage {...defaultProps} category="memorial" />);
    const img = screen.getByRole('img');

    fireEvent.error(img);

    expect(img).toHaveAttribute(
      'src',
      'https://images.unsplash.com/mock-memorial?w=800',
    );
  });

  // ─── Tier 2: Local hero.webp fallback ──────────────────────────────────

  it('switches to local hero.webp (tier 2) on double error', () => {
    render(<CampaignHeroImage {...defaultProps} />);
    const img = screen.getByRole('img');

    // First error -> tier 1 (Unsplash)
    fireEvent.error(img);
    expect(img.getAttribute('src')).toContain('unsplash.com');

    // Second error -> tier 2 (local webp)
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', '/images/categories/medical-hero.webp');
  });

  it('does not change src after tier 2 (no infinite loop)', () => {
    render(<CampaignHeroImage {...defaultProps} />);
    const img = screen.getByRole('img');

    fireEvent.error(img); // -> tier 1
    fireEvent.error(img); // -> tier 2
    const tier2Src = img.getAttribute('src');

    fireEvent.error(img); // -> no change
    expect(img).toHaveAttribute('src', tier2Src!);
  });

  // ─── Empty pool → skip to tier 2 ──────────────────────────────────────

  it('skips to local hero.webp when pool returns null', () => {
    render(
      <CampaignHeroImage
        {...defaultProps}
        category={'empty-category' as string}
      />,
    );
    const img = screen.getByRole('img');

    fireEvent.error(img);

    // Should skip tier 1 and go straight to tier 2
    expect(img).toHaveAttribute('src', '/images/categories/community-hero.webp');
  });

  // ─── Unknown category defaults ─────────────────────────────────────────

  it('defaults to community category when no category is provided', () => {
    render(<CampaignHeroImage src="https://example.com/hero.jpg" alt="No Cat" />);
    const img = screen.getByRole('img');

    fireEvent.error(img);

    expect(img.getAttribute('src')).toContain('mock-community');
  });

  it('uses community hero.webp for unknown categories at tier 2', () => {
    render(
      <CampaignHeroImage
        {...defaultProps}
        category={'empty-category' as string}
      />,
    );
    const img = screen.getByRole('img');

    // empty-category -> pool null -> straight to webp
    fireEvent.error(img);

    // Unknown category falls back to community
    expect(img).toHaveAttribute('src', '/images/categories/community-hero.webp');
  });

  // ─── All 23 categories resolve to valid hero.webp paths ───────────────

  const ALL_CATEGORIES = [
    'medical', 'disaster', 'military', 'veterans', 'memorial',
    'first-responders', 'community', 'essential-needs', 'emergency',
    'charity', 'education', 'animal', 'environment', 'business',
    'competition', 'creative', 'event', 'faith', 'family',
    'sports', 'travel', 'volunteer', 'wishes',
  ];

  it.each(ALL_CATEGORIES)(
    'category "%s" falls back to correct hero.webp path at tier 2',
    (category) => {
      render(
        <CampaignHeroImage
          src="https://broken.example.com/img.jpg"
          alt="Test"
          category={category}
        />,
      );
      const img = screen.getByRole('img');

      fireEvent.error(img); // tier 0 -> tier 1
      fireEvent.error(img); // tier 1 -> tier 2

      expect(img).toHaveAttribute(
        'src',
        `/images/categories/${category}-hero.webp`,
      );
    },
  );
});
