// Status wording from docs/design/ui.md, "Status system": always icon + word + value.
// Entries have the shape GET /api/overview returns for each fridge.

import { describe, expect, it } from 'vitest';
import { describeStatus, STATUS_META } from './status.js';

const entry = (overrides) => ({
  noLogger: false,
  latest: { tsUtc: '2026-09-27T20:45:00Z', tempC: 3.9 },
  alert: null,
  warming: null,
  gap: null,
  ...overrides,
});

describe('describeStatus', () => {
  it('Alert shows the peak and the time above 5°C: "Alert · 7.1°C · 2d 9h 15m"', () => {
    const fridge = entry({
      status: 'alert',
      alert: { count: 1, peakC: 7.1, totalMinutes: 3435 },
    });
    expect(describeStatus(fridge)).toBe('Alert · 7.1°C · 2d 9h 15m');
  });

  it('Warming shows the latest reading and the rise: "Warming · 4.6°C, +0.8° in 24h"', () => {
    const fridge = entry({
      status: 'warming',
      warming: { latestC: 4.6, medianC: 4.4, riseC: 0.8 },
    });
    expect(describeStatus(fridge)).toBe('Warming · 4.6°C, +0.8° in 24h');
  });

  it('Gap shows how long data is missing: "Gap · 2h 15m missing"', () => {
    const fridge = entry({ status: 'gap', gap: { count: 1, totalMinutes: 135 } });
    expect(describeStatus(fridge)).toBe('Gap · 2h 15m missing');
  });

  it('a fridge with no readings this week says "No file this week"', () => {
    expect(describeStatus(entry({ status: 'no_file', latest: null }))).toBe('No file this week');
  });

  it('a fridge that never had a logger says so instead of blaming a missing file', () => {
    const fridge = entry({ status: 'no_file', latest: null, noLogger: true });
    expect(describeStatus(fridge)).toBe('No file · no logger yet');
  });

  it('OK shows the latest reading: "OK · 3.9°C"', () => {
    expect(describeStatus(entry({ status: 'ok' }))).toBe('OK · 3.9°C');
  });

  it('OK with no valid reading to show is just "OK"', () => {
    expect(describeStatus(entry({ status: 'ok', latest: null }))).toBe('OK');
  });
});

describe('STATUS_META', () => {
  it('has a word and an icon for every status, so none is shown by color alone', () => {
    for (const status of ['alert', 'warming', 'gap', 'no_file', 'ok']) {
      expect(STATUS_META[status].label).toMatch(/\w/);
      expect(STATUS_META[status].icon).toMatch(/\w/);
    }
  });
});
