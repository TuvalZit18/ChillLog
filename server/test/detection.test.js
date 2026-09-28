import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeFile } from '../src/normalize/normalize.js';
import { findExcursions, findGaps, warmingAt } from '../src/detection/detection.js';

const fixtureReadings = (name) =>
  normalizeFile(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8')).readings;

/** Readings every `stepMinutes` from `startUtc`; a value of 'ERR' is an ERR reading. */
function series(startUtc, stepMinutes, values) {
  const start = Date.parse(startUtc);
  return values.map((value, i) => ({
    tsUtc: new Date(start + i * stepMinutes * 60_000).toISOString().replace('.000Z', 'Z'),
    tempC: value === 'ERR' ? null : value,
    isErr: value === 'ERR',
  }));
}

/** One reading per [time, value] pair, for series with holes in them. */
const at = (pairs) => pairs.map(([tsUtc, tempC]) => ({ tsUtc, tempC, isErr: false }));

describe('excursions above 5°C', () => {
  it('"when did this fridge go above five degrees, and for how long?": start, end, duration and peak', () => {
    const readings = series('2026-09-14T03:00:00Z', 15, [4.6, 5.4, 6.3, 7.1, 4.8]);
    expect(findExcursions(readings).excursions).toEqual([
      {
        startUtc: '2026-09-14T03:15:00Z',
        endUtc: '2026-09-14T04:00:00Z', // the first reading back at or below 5°C
        durationMinutes: 45,
        peakC: 7.1,
        readings: 3,
        endReason: 'back_in_range',
      },
    ]);
  });

  it('"someone opens the door for a delivery and you see a jump for one reading, which is fine": one reading above 5°C is not an excursion', () => {
    const result = findExcursions(fixtureReadings('door-spike-single-reading.csv'));
    expect(result.excursions).toEqual([]);
    expect(result.doorSpikes).toEqual([{ tsUtc: '2026-09-14T03:15:00Z', tempC: 9.4 }]);
  });

  it('two readings in a row above 5°C are an excursion', () => {
    const readings = series('2026-09-14T03:00:00Z', 15, [4.0, 5.4, 5.6, 4.0]);
    expect(findExcursions(readings).excursions).toMatchObject([
      { startUtc: '2026-09-14T03:15:00Z', durationMinutes: 30, readings: 2 },
    ]);
  });

  it('exactly 5.0°C is not above five degrees', () => {
    const result = findExcursions(series('2026-09-14T03:00:00Z', 15, [4.0, 5.0, 5.0, 4.0]));
    expect(result).toEqual({ excursions: [], doorSpikes: [] });
  });

  it('an ERR reading inside an excursion does not end it', () => {
    const readings = series('2026-09-14T03:00:00Z', 15, [4.0, 5.4, 'ERR', 6.0, 4.0]);
    expect(findExcursions(readings).excursions).toMatchObject([
      {
        startUtc: '2026-09-14T03:15:00Z',
        endUtc: '2026-09-14T04:00:00Z',
        readings: 2,
        peakC: 6,
        endReason: 'back_in_range',
      },
    ]);
  });

  it('a gap in the data ends an excursion at its last reading above 5°C', () => {
    const readings = at([
      ['2026-09-14T03:00:00Z', 5.4],
      ['2026-09-14T03:15:00Z', 5.6],
      ['2026-09-14T05:00:00Z', 5.8],
      ['2026-09-14T05:15:00Z', 5.9],
      ['2026-09-14T05:30:00Z', 4.0],
    ]);
    expect(findExcursions(readings).excursions).toMatchObject([
      { startUtc: '2026-09-14T03:00:00Z', endUtc: '2026-09-14T03:15:00Z', endReason: 'gap' },
      {
        startUtc: '2026-09-14T05:00:00Z',
        endUtc: '2026-09-14T05:30:00Z',
        endReason: 'back_in_range',
      },
    ]);
  });

  it('an excursion still going at the last reading ends there, marked as still above', () => {
    const readings = series('2026-09-14T03:00:00Z', 15, [4.0, 5.5, 6.0]);
    expect(findExcursions(readings).excursions).toMatchObject([
      { endUtc: '2026-09-14T03:30:00Z', durationMinutes: 15, endReason: 'data_ends' },
    ]);
  });
});

describe('gaps', () => {
  it('"Sometimes there\'s a gap of a couple of hours in a file": more than an hour without a valid reading is a gap', () => {
    expect(findGaps(fixtureReadings('gap-two-hours.csv'))).toEqual([
      {
        fromUtc: '2026-09-14T03:15:00Z', // 06:15 Israel time, the last reading before
        toUtc: '2026-09-14T05:30:00Z', // 08:30, the first reading after
        minutes: 135,
        errReadings: 1, // the ERR at 07:00 counts as missing
      },
    ]);
  });

  it('exactly an hour between readings is not a gap; 75 minutes is', () => {
    const readings = at([
      ['2026-09-14T03:00:00Z', 4.0],
      ['2026-09-14T04:00:00Z', 4.0],
      ['2026-09-14T05:15:00Z', 4.0],
    ]);
    expect(findGaps(readings)).toEqual([
      {
        fromUtc: '2026-09-14T04:00:00Z',
        toUtc: '2026-09-14T05:15:00Z',
        minutes: 75,
        errReadings: 0,
      },
    ]);
  });
});

describe('slow warming', () => {
  const rishon = fixtureReadings('rishon-slow-warming.csv');

  it('"Last month we threw out a full fridge of dairy in Rishon because nobody noticed it had been slowly dying for two days": warming is flagged while it is still below 5°C', () => {
    // 13 Sep 18:00 Israel time: about 20 hours before it first goes above 5°C.
    const atUtc = '2026-09-13T15:00:00Z';
    const latest = rishon.findLast((r) => r.tsUtc <= atUtc);
    expect(latest.tempC).toBeLessThan(5);
    expect(warmingAt(rishon, atUtc)).toEqual({
      atUtc,
      medianC: 4.1, // middle of the last 24 h: 06:00 on 13 Sep, 3.5 + 0.75 × 0.75 days
      previousMedianC: 3.5,
      riseC: 0.6,
      isWarming: true,
    });
  });

  it('"A fridge that\'s slowly warming up is not fine": the Rishon fridge becomes an excursion once it passes 5°C', () => {
    expect(findExcursions(rishon).excursions).toEqual([
      {
        startUtc: '2026-09-14T10:45:00Z', // 13:45 Israel time, the first reading above 5.0
        endUtc: '2026-09-15T20:45:00Z',
        durationMinutes: 2040,
        peakC: 6.1,
        readings: 137,
        endReason: 'data_ends',
      },
    ]);
  });

  it('a steady fridge is not warming', () => {
    // 12 Sep 14:00 Israel time: the rise started only two hours earlier.
    expect(warmingAt(rishon, '2026-09-12T11:00:00Z')).toMatchObject({
      riseC: 0,
      isWarming: false,
    });
  });

  it('door openings do not make a fridge look warming', () => {
    const values = Array.from({ length: 192 }, (_, i) => ([100, 130, 160].includes(i) ? 9 : 3.8));
    const readings = series('2026-09-12T00:00:00Z', 15, values);
    expect(warmingAt(readings, readings.at(-1).tsUtc)).toMatchObject({ isWarming: false });
  });

  it('gives no verdict without at least 12 hours of data in each day compared', () => {
    const readings = series('2026-09-12T00:00:00Z', 15, Array(80).fill(3.8)); // 20 hours
    expect(warmingAt(readings, readings.at(-1).tsUtc)).toBeNull();
  });
});
