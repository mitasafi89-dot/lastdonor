import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatRelativeTime } from '@/lib/utils/dates';

describe('formatDate', () => {
  it('formats a Date object', () => {
    // Use noon UTC to avoid timezone boundary issues
    const result = formatDate(new Date('2026-03-15T12:00:00Z'));
    expect(result).toBe('March 15, 2026');
  });

  it('formats a date string', () => {
    const result = formatDate('2026-01-01T12:00:00Z');
    expect(result).toBe('January 1, 2026');
  });

  it('formats a date with US locale format (month day, year)', () => {
    const result = formatDate('2026-07-04T12:00:00Z');
    expect(result).toMatch(/July\s+4,\s+2026/);
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than 1 minute ago', () => {
    const thirtySecondsAgo = new Date('2026-03-20T11:59:31Z');
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date('2026-03-20T11:55:00Z');
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date('2026-03-20T09:00:00Z');
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date('2026-03-18T12:00:00Z');
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });

  it('returns formatted date for 7+ days ago', () => {
    const twoWeeksAgo = new Date('2026-03-06T12:00:00Z');
    const result = formatRelativeTime(twoWeeksAgo);
    expect(result).toBe('March 6, 2026');
  });

  it('returns "1m ago" for exactly 1 minute ago', () => {
    const oneMinAgo = new Date('2026-03-20T11:59:00Z');
    expect(formatRelativeTime(oneMinAgo)).toBe('1m ago');
  });

  it('returns "1h ago" for exactly 60 minutes', () => {
    const oneHourAgo = new Date('2026-03-20T11:00:00Z');
    expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');
  });

  it('returns "1d ago" for exactly 24 hours', () => {
    const oneDayAgo = new Date('2026-03-19T12:00:00Z');
    expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');
  });

  it('returns "6d ago" for 6 days (still within week)', () => {
    const sixDaysAgo = new Date('2026-03-14T12:00:00Z');
    expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago');
  });
});
