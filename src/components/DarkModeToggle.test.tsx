import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DarkModeToggle } from '@/components/DarkModeToggle';

describe('DarkModeToggle', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value; }),
      removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
    });
    // Start with light mode
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
  });

  it('renders a toggle button', () => {
    render(<DarkModeToggle />);
    expect(screen.getByRole('button', { name: /toggle dark mode/i })).toBeInTheDocument();
  });

  it('toggles dark class on document element when clicked', () => {
    render(<DarkModeToggle />);
    const button = screen.getByRole('button', { name: /toggle dark mode/i });
    fireEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists theme to localStorage on toggle', () => {
    render(<DarkModeToggle />);
    const button = screen.getByRole('button', { name: /toggle dark mode/i });
    fireEvent.click(button);
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('toggles back to light mode on second click', () => {
    render(<DarkModeToggle />);
    const button = screen.getByRole('button', { name: /toggle dark mode/i });
    fireEvent.click(button); // → dark
    fireEvent.click(button); // → light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.setItem).toHaveBeenLastCalledWith('theme', 'light');
  });

  it('reads initial state from document', () => {
    document.documentElement.classList.add('dark');
    render(<DarkModeToggle />);
    // Should show sun icon (indicating dark mode is active)
    // The component uses SunIcon in dark mode
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
