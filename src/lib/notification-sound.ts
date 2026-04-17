'use client';

const STORAGE_KEY = 'lastdonor:notification-sound';

/** Whether notification sounds are enabled (persisted in localStorage). */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'muted';
}

/** Toggle notification sounds and persist the preference. */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, 'muted');
  }
}

/**
 * Play a short two-tone chime using the Web Audio API.
 * Respects the mute preference. Fails silently if audio is blocked.
 */
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new AudioContext();

    // First tone - 880 Hz (A5) for 80ms
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880;
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.08);

    // Second tone - 1320 Hz (E6) for 120ms, slight delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1320;
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.2);

    // Clean up after sound finishes
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    // Web Audio not available - fail silently
  }
}
