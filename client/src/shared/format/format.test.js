// Display formats from docs/design/ui.md, "Copy and formats". Times are always Israel time.

import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDay,
  formatDurationShort,
  formatTemp,
  formatTempChange,
} from './format.js';

describe('formatDateTime', () => {
  it('shows "Mon 14 Sep, 06:45" in Israel time, not UTC', () => {
    // Summer time: Israel is UTC+3.
    expect(formatDateTime('2026-09-14T03:45:00Z')).toBe('Mon 14 Sep, 06:45');
  });

  it('follows Israel winter time (UTC+2) after the clocks go back', () => {
    expect(formatDateTime('2026-12-01T10:00:00Z')).toBe('Tue 1 Dec, 12:00');
  });

  it('rolls into the next Israel day at midnight and writes 00, not 24', () => {
    expect(formatDateTime('2026-09-20T21:00:00Z')).toBe('Mon 21 Sep, 00:00');
  });
});

describe('formatDate and formatDay', () => {
  it('writes a date as "14 Sep" and a day as "Mon 14 Sep"', () => {
    expect(formatDate('2026-09-14T03:45:00Z')).toBe('14 Sep');
    expect(formatDay('2026-09-14T03:45:00Z')).toBe('Mon 14 Sep');
  });

  it('reads a plain Israel date (the week\'s "firstDay") as that same day', () => {
    expect(formatDay('2026-09-14')).toBe('Mon 14 Sep');
    expect(formatDay('2026-09-20')).toBe('Sun 20 Sep');
  });
});

describe('formatTemp and formatTempChange', () => {
  it('writes temperatures as "7.1°C", always one decimal', () => {
    expect(formatTemp(7.1)).toBe('7.1°C');
    expect(formatTemp(4)).toBe('4.0°C');
    expect(formatTemp(3.85)).toBe('3.9°C');
    expect(formatTemp(-0.04)).toBe('0.0°C');
  });

  it('writes a change as "+0.8°" with its sign', () => {
    expect(formatTempChange(0.75)).toBe('+0.8°');
    expect(formatTempChange(-1.2)).toBe('-1.2°');
  });
});

describe('formatDurationShort', () => {
  it('writes "2d 9h 15m", "2h 15m" and "45 min"', () => {
    expect(formatDurationShort(3435)).toBe('2d 9h 15m');
    expect(formatDurationShort(135)).toBe('2h 15m');
    expect(formatDurationShort(45)).toBe('45 min');
  });

  it('leaves out zero parts', () => {
    expect(formatDurationShort(2040)).toBe('1d 10h');
    expect(formatDurationShort(1440)).toBe('1d');
    expect(formatDurationShort(1455)).toBe('1d 15m');
    expect(formatDurationShort(60)).toBe('1h');
    expect(formatDurationShort(0)).toBe('0 min');
  });
});
