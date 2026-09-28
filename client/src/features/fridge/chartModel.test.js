// The fridge chart's numbers and words (docs/design/ui.md, "Temperature chart"). All times on
// the axis are Israel time, so a reviewer abroad sees the same days as the files.

import { describe, expect, it } from 'vitest';
import { chartSummary, noLoggerUntil, readout, timeTicks, yDomain, yTicks } from './chartModel.js';

const ms = (iso) => Date.parse(iso);

describe('timeTicks', () => {
  it('marks every 6 hours over a day, with the day name at midnight', () => {
    // Sun 27 Sep, 12:30 to Mon 28 Sep, 12:30 in Israel.
    const ticks = timeTicks('2026-09-27T09:30:00Z', '2026-09-28T09:30:00Z');
    expect(ticks.map((t) => t.label)).toEqual(['18:00', 'Mon 28', '06:00', '12:00']);
    expect(ticks[0].ms).toBe(ms('2026-09-27T15:00:00Z'));
  });

  it('marks each Israel midnight over a week, also across the October clock change', () => {
    // Fri 23 Oct to Fri 30 Oct 2026; clocks go back on Sun 25 Oct.
    const ticks = timeTicks('2026-10-22T21:00:00Z', '2026-10-29T22:00:00Z');
    expect(ticks.map((t) => t.label)).toEqual([
      'Fri 23',
      'Sat 24',
      'Sun 25',
      'Mon 26',
      'Tue 27',
      'Wed 28',
      'Thu 29',
      'Fri 30',
    ]);
    expect(ticks[2].ms).toBe(ms('2026-10-24T21:00:00Z')); // summer time, UTC+3
    expect(ticks[3].ms).toBe(ms('2026-10-25T22:00:00Z')); // winter time, UTC+2
  });

  it('marks Mondays over 30 days', () => {
    const ticks = timeTicks('2026-08-29T09:30:00Z', '2026-09-28T09:30:00Z');
    expect(ticks.map((t) => t.label)).toEqual(['31 Aug', '7 Sep', '14 Sep', '21 Sep', '28 Sep']);
  });

  it('marks the first of each month over longer ranges', () => {
    const ticks = timeTicks('2026-01-01T00:00:00Z', '2026-06-30T00:00:00Z');
    expect(ticks.map((t) => t.label)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun']);
  });
});

describe('yDomain and yTicks', () => {
  const points = (...pairs) => pairs.map(([minC, maxC]) => ({ tsUtc: '', minC, maxC }));

  it('always shows the 5°C line, with room above it', () => {
    expect(yDomain(points([3.1, 3.3], [null, null]), [])).toEqual([2, 6]);
  });

  it('stretches to fit a warm fridge and a door opening', () => {
    expect(yDomain(points([3, 6.1]), [])).toEqual([2, 8]);
    expect(yDomain(points([3, 4]), [{ tsUtc: '', tempC: 9.4 }])).toEqual([2, 11]);
  });

  it('has a sensible scale with no readings at all', () => {
    expect(yDomain([], [])).toEqual([2, 6]);
  });

  it('labels every degree, or every second degree on a tall scale', () => {
    expect(yTicks([2, 6])).toEqual([2, 3, 4, 5, 6]);
    expect(yTicks([2, 11])).toEqual([2, 4, 6, 8, 10]);
  });
});

describe('readout', () => {
  it('reads "Thu 17 Sep, 10:45 · 3.8°C" for the touched point', () => {
    expect(readout({ tsUtc: '2026-09-17T07:45:00Z', minC: 3.8, maxC: 3.8 })).toBe(
      'Thu 17 Sep, 10:45 · 3.8°C',
    );
  });

  it('shows a bucket that holds several readings as its lowest to highest', () => {
    expect(readout({ tsUtc: '2026-09-17T07:00:00Z', minC: 3.6, maxC: 3.9 })).toBe(
      'Thu 17 Sep, 10:00 · 3.6–3.9°C',
    );
  });

  it('says when a point is above 5°C', () => {
    expect(readout({ tsUtc: '2026-09-26T10:45:00Z', minC: 5.8, maxC: 5.8 })).toBe(
      'Sat 26 Sep, 13:45 · 5.8°C · above 5°C',
    );
  });

  it('says when there was no reading there', () => {
    expect(readout({ tsUtc: '2026-09-17T07:45:00Z', minC: null, maxC: null })).toBe(
      'Thu 17 Sep, 10:45 · no reading',
    );
  });
});

describe('chartSummary', () => {
  const fridge = {
    fridge: { branchName: 'Rishon LeZion', name: 'Cream cakes' },
    range: { fromUtc: '2026-09-20T21:00:00Z', toUtc: '2026-09-27T21:00:00Z' },
    series: {
      points: [
        { tsUtc: '2026-09-20T21:00:00Z', minC: 3.1, maxC: 3.3 },
        { tsUtc: '2026-09-20T22:00:00Z', minC: null, maxC: null },
        { tsUtc: '2026-09-20T23:00:00Z', minC: 5.2, maxC: 6.1 },
      ],
    },
    excursions: [{}],
  };

  it('says in words what the chart shows, for screen readers', () => {
    expect(chartSummary(fridge)).toBe(
      'Temperature of Rishon LeZion · Cream cakes from Mon 21 Sep, 00:00 to Mon 28 Sep, 00:00. ' +
        'Readings between 3.1°C and 6.1°C. 1 period above 5°C.',
    );
  });

  it('says when there are no readings in the range', () => {
    const empty = { ...fridge, series: { points: [] }, excursions: [] };
    expect(chartSummary(empty)).toBe(
      'Temperature of Rishon LeZion · Cream cakes from Mon 21 Sep, 00:00 to Mon 28 Sep, 00:00. ' +
        'No readings in this range.',
    );
  });
});

describe('noLoggerUntil', () => {
  const range = { fromUtc: '2026-08-29T09:30:00Z', toUtc: '2026-09-28T09:30:00Z' };

  it('shades the time before the logger was put in this fridge', () => {
    const placements = [{ fromUtc: '2026-09-22T21:00:00Z', toUtc: null }];
    expect(noLoggerUntil(placements, range)).toBe('2026-09-22T21:00:00Z');
  });

  it('shades nothing when a logger was there for the whole range', () => {
    const placements = [{ fromUtc: '2026-08-01T00:00:00Z', toUtc: null }];
    expect(noLoggerUntil(placements, range)).toBeNull();
  });

  it('shades the whole range for a fridge that never had a logger', () => {
    expect(noLoggerUntil([], range)).toBe(range.toUtc);
  });
});
