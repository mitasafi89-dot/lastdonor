import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignCard } from '@/components/campaign/CampaignCard';

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img {...rest} data-fill={fill ? 'true' : undefined} />;
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { vi } from 'vitest';

const defaultProps = {
  slug: 'help-johnson-family',
  title: 'Help the Johnson Family Rebuild',
  heroImageUrl: 'https://example.com/hero.webp',
  subjectName: 'The Johnson Family',
  raisedAmount: 125000, // $1,250.00
  goalAmount: 500000,   // $5,000.00
};

describe('CampaignCard', () => {
  it('renders the campaign title', () => {
    render(<CampaignCard {...defaultProps} />);
    expect(screen.getByText('Help the Johnson Family Rebuild')).toBeInTheDocument();
  });

  it('renders the progress bar', () => {
    render(<CampaignCard {...defaultProps} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays raised amount as whole dollars', () => {
    render(<CampaignCard {...defaultProps} />);
    expect(screen.getByText(/\$1,250 raised/)).toBeInTheDocument();
  });

  it('renders location badge when location is provided', () => {
    render(<CampaignCard {...defaultProps} location="London, United Kingdom" />);
    expect(screen.getByText('London, United Kingdom')).toBeInTheDocument();
  });

  it('does not render location badge when location is null', () => {
    render(<CampaignCard {...defaultProps} location={null} />);
    expect(screen.queryByText(/United Kingdom/)).not.toBeInTheDocument();
  });

  it('does not display goal amount or percentage', () => {
    render(<CampaignCard {...defaultProps} />);
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
    expect(screen.queryByText('25%')).not.toBeInTheDocument();
  });

  it('does not display donor count', () => {
    render(<CampaignCard {...defaultProps} />);
    expect(screen.queryByText(/donors?$/)).not.toBeInTheDocument();
  });

  it('links to the correct campaign slug', () => {
    render(<CampaignCard {...defaultProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/campaigns/help-johnson-family');
  });
});
