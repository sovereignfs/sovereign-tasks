import { describe, expect, it } from 'vitest';
import { digestSummary, isDigestDue } from '../notify';

describe('digestSummary', () => {
  it('is null when there is nothing due or overdue', () => {
    expect(digestSummary(0, 0)).toBeNull();
  });

  it('phrases due-only mornings', () => {
    expect(digestSummary(1, 0)).toBe('1 task due today');
    expect(digestSummary(3, 0)).toBe('3 tasks due today');
  });

  it('phrases overdue-only mornings', () => {
    expect(digestSummary(0, 1)).toBe('1 task overdue');
    expect(digestSummary(0, 4)).toBe('4 tasks overdue');
  });

  it('joins both counts', () => {
    expect(digestSummary(3, 2)).toBe('3 tasks due today · 2 overdue');
    expect(digestSummary(1, 1)).toBe('1 task due today · 1 overdue');
  });
});

describe('isDigestDue', () => {
  it('waits until the chosen morning time', () => {
    expect(isDigestDue('07:59', '08:00', null, '2026-07-11')).toBe(false);
    expect(isDigestDue('08:00', '08:00', null, '2026-07-11')).toBe(true);
    expect(isDigestDue('14:30', '08:00', null, '2026-07-11')).toBe(true);
  });

  it('runs at most once per local day', () => {
    expect(isDigestDue('08:30', '08:00', '2026-07-11', '2026-07-11')).toBe(false);
    expect(isDigestDue('08:30', '08:00', '2026-07-10', '2026-07-11')).toBe(true);
  });

  it('treats a never-evaluated user as due', () => {
    expect(isDigestDue('09:00', '08:00', null, '2026-07-11')).toBe(true);
  });
});
