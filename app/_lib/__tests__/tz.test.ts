import { describe, expect, it } from 'vitest';
import { isValidTimeZone, localNowParts } from '../tz';

describe('isValidTimeZone', () => {
  it('accepts real IANA zones', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Pacific/Kiritimati')).toBe(true);
  });

  it('rejects junk', () => {
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});

describe('localNowParts', () => {
  it('converts an instant into a zone-local date and time', () => {
    // 2026-07-11T22:30:00Z
    const epoch = Date.UTC(2026, 6, 11, 22, 30);
    expect(localNowParts('UTC', epoch)).toEqual({ date: '2026-07-11', time: '22:30' });
    // Berlin is UTC+2 in July (CEST) — already the next calendar day.
    expect(localNowParts('Europe/Berlin', epoch)).toEqual({ date: '2026-07-12', time: '00:30' });
    // New York is UTC-4 in July (EDT) — still the same day, evening.
    expect(localNowParts('America/New_York', epoch)).toEqual({ date: '2026-07-11', time: '18:30' });
  });

  it('zero-pads so lexicographic comparison stays chronological', () => {
    // 2026-01-05T08:05:00Z
    const epoch = Date.UTC(2026, 0, 5, 8, 5);
    const utc = localNowParts('UTC', epoch);
    expect(utc).toEqual({ date: '2026-01-05', time: '08:05' });
    expect(utc.time < '10:00').toBe(true);
  });

  it('renders midnight as 00:MM, never 24:MM', () => {
    // Exactly midnight in Berlin (22:00Z the previous evening in July).
    const epoch = Date.UTC(2026, 6, 10, 22, 0);
    expect(localNowParts('Europe/Berlin', epoch)).toEqual({ date: '2026-07-11', time: '00:00' });
  });

  it('handles the spring-forward DST gap (America/New_York, 2026-03-08)', () => {
    // 06:59Z = 01:59 EST (UTC-5), one minute before the jump…
    expect(localNowParts('America/New_York', Date.UTC(2026, 2, 8, 6, 59))).toEqual({
      date: '2026-03-08',
      time: '01:59',
    });
    // …07:00Z = 03:00 EDT (UTC-4): 02:xx never exists on this day.
    expect(localNowParts('America/New_York', Date.UTC(2026, 2, 8, 7, 0))).toEqual({
      date: '2026-03-08',
      time: '03:00',
    });
  });

  it('handles the fall-back DST repeat (America/New_York, 2026-11-01)', () => {
    // 05:30Z = 01:30 EDT (first pass through 01:30)…
    expect(localNowParts('America/New_York', Date.UTC(2026, 10, 1, 5, 30)).time).toBe('01:30');
    // …06:30Z = 01:30 EST (second pass) — same wall-clock, later instant.
    expect(localNowParts('America/New_York', Date.UTC(2026, 10, 1, 6, 30)).time).toBe('01:30');
  });

  it('falls back to UTC for an invalid stored timezone', () => {
    const epoch = Date.UTC(2026, 6, 11, 9, 15);
    expect(localNowParts('Not/AZone', epoch)).toEqual({ date: '2026-07-11', time: '09:15' });
  });
});
