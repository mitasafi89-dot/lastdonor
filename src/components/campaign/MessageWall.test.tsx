import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageWall, type MessageItem } from './MessageWall';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

function buildMessage(overrides: Partial<MessageItem> = {}): MessageItem {
  return {
    id: crypto.randomUUID(),
    donorName: 'Jane Doe',
    donorLocation: 'Portland, OR',
    message: 'Wishing you a speedy recovery!',
    isAnonymous: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MessageWall', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('renders empty state when no messages', () => {
    render(<MessageWall campaignSlug="test-campaign" initialMessages={[]} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('renders messages with donor name and text', () => {
    const msgs = [
      buildMessage({ donorName: 'Alice', message: 'Stay strong!' }),
      buildMessage({ donorName: 'Bob', message: 'Praying for you.' }),
    ];
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Stay strong!')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Praying for you.')).toBeInTheDocument();
  });

  it('renders "Anonymous" for anonymous messages', () => {
    const msgs = [buildMessage({ isAnonymous: true, donorName: 'Anonymous' })];
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);

    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    // Avatar should show '?'
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('does not show location for anonymous messages', () => {
    const msgs = [
      buildMessage({ isAnonymous: true, donorName: 'Anonymous', donorLocation: 'Secret' }),
    ];
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('shows avatar initial from donor name', () => {
    const msgs = [buildMessage({ donorName: 'Zara' })];
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('truncates long messages and shows Read more', () => {
    const longText = 'A'.repeat(300);
    const msgs = [buildMessage({ message: longText })];
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);

    expect(screen.getByText('Read more')).toBeInTheDocument();
    // Expanded text should not be fully shown
    expect(screen.queryByText(longText)).not.toBeInTheDocument();
  });

  it('expands long message when Read more is clicked', () => {
    const longText = 'B'.repeat(300);
    const msgs = [buildMessage({ message: longText })];
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);

    fireEvent.click(screen.getByText('Read more'));
    expect(screen.getByText(longText)).toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('shows load more button when there are enough initial messages', () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      buildMessage({ id: `id-${i}`, donorName: `Donor ${i}` }),
    );
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);
    expect(screen.getByText('Load more messages')).toBeInTheDocument();
  });

  it('does not show load more when fewer than page size messages', () => {
    const msgs = [buildMessage()];
    render(<MessageWall campaignSlug="test-campaign" initialMessages={msgs} />);
    expect(screen.queryByText('Load more messages')).not.toBeInTheDocument();
  });

  it('has aria-live region for accessibility', () => {
    render(<MessageWall campaignSlug="test-campaign" initialMessages={[]} />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});
