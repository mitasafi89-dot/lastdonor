import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { vi } from 'vitest';

describe('Footer', () => {
  it('renders the brand name', () => {
    render(<Footer />);
    expect(screen.getByText('Last')).toBeInTheDocument();
    expect(screen.getByText('Donor')).toBeInTheDocument();
  });

  it('renders the 501(c)(3) notice', () => {
    render(<Footer />);
    expect(screen.getByText(/501\(c\)\(3\) Nonprofit/i)).toBeInTheDocument();
  });

  it('renders Campaigns link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Campaigns' });
    expect(link).toHaveAttribute('href', '/campaigns');
  });

  it('renders Privacy Policy link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('renders Terms of Service link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Terms of Service' });
    expect(link).toHaveAttribute('href', '/terms');
  });

  it('renders Transparency link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Transparency' });
    expect(link).toHaveAttribute('href', '/transparency');
  });

  it('renders Editorial Standards link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Editorial Standards' });
    expect(link).toHaveAttribute('href', '/editorial-standards');
  });

  it('renders Last Donor Wall link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Last Donor Wall' });
    expect(link).toHaveAttribute('href', '/last-donor-wall');
  });

  it('renders How It Works link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'How It Works' });
    expect(link).toHaveAttribute('href', '/about');
  });

  it('renders Share Your Story link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Share Your Story' });
    expect(link).toHaveAttribute('href', '/share-your-story');
  });

  it('renders copyright with current year', () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument();
  });

  it('renders section headings', () => {
    render(<Footer />);
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Trust')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
  });
});
