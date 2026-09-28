// Sentences on the fridge page. Shapes are what GET /api/fridges/:id returns.

import { describe, expect, it } from 'vitest';
import { doorNote, excursionNote, filesDueNote, gapLine, loggerHistory } from './fridgeText.js';

describe('doorNote', () => {
  it('"someone opens the door for a delivery and you see a jump for one reading, which is fine"', () => {
    expect(doorNote([{ tsUtc: '2026-09-22T06:15:00Z', tempC: 7.8 }])).toBe(
      'One single reading above 5°C ignored as a door opening: Tue 22 Sep, 09:15 · 7.8°C.',
    );
  });

  it('lists several door openings in one sentence', () => {
    expect(
      doorNote([
        { tsUtc: '2026-09-22T06:15:00Z', tempC: 7.8 },
        { tsUtc: '2026-09-24T12:00:00Z', tempC: 6.2 },
      ]),
    ).toBe(
      '2 single readings above 5°C ignored as door openings: Tue 22 Sep, 09:15 · 7.8°C; Thu 24 Sep, 15:00 · 6.2°C.',
    );
  });

  it('says nothing when there were none', () => {
    expect(doorNote([])).toBeNull();
  });
});

describe('gapLine', () => {
  it('"a gap of a couple of hours" on one day shows the end as a time only', () => {
    const gap = { fromUtc: '2026-09-13T23:30:00Z', toUtc: '2026-09-14T01:45:00Z', minutes: 135 };
    expect(gapLine(gap)).toBe('Mon 14 Sep, 02:30 to 04:45');
  });

  it('a gap across days shows both dates', () => {
    const gap = { fromUtc: '2026-09-24T10:45:00Z', toUtc: '2026-09-27T21:00:00Z', minutes: 4695 };
    expect(gapLine(gap)).toBe('Thu 24 Sep, 13:45 to Mon 28 Sep, 00:00');
  });
});

describe('excursionNote', () => {
  it('says when the fridge was still above 5°C at the last reading', () => {
    expect(excursionNote({ endReason: 'data_ends' })).toBe(
      'Still above 5°C at the last reading in the file.',
    );
  });

  it('says it may have lasted longer when the readings stopped during it', () => {
    expect(excursionNote({ endReason: 'gap' })).toBe(
      'The readings stop here, so it may have lasted longer.',
    );
  });

  it('adds nothing when the fridge came back to 5°C or below', () => {
    expect(excursionNote({ endReason: 'back_in_range' })).toBeNull();
  });
});

describe('filesDueNote', () => {
  const DUE = '2026-09-27T21:00:00Z'; // Mon 28 Sep, 00:00 Israel time
  const page = (toUtc, latestUtc) => ({
    range: { fromUtc: '2026-09-21T09:30:00Z', toUtc },
    latest: latestUtc ? { tsUtc: latestUtc, tempC: 3.5 } : null,
    filesDueUntilUtc: DUE,
  });

  it('"Once a week each branch manager downloads the logger\'s file": says when the next readings arrive', () => {
    expect(filesDueNote(page('2026-09-28T09:30:00Z', '2026-09-27T20:45:00Z'))).toBe(
      "Readings after Sun 27 Sep arrive with next Monday's files.",
    );
  });

  it('says nothing for a range that ends before the files are due', () => {
    expect(filesDueNote(page('2026-09-27T21:00:00Z', '2026-09-27T20:45:00Z'))).toBeNull();
  });

  it("says nothing once this week's readings are already in", () => {
    expect(filesDueNote(page('2026-09-28T09:30:00Z', '2026-09-28T08:00:00Z'))).toBeNull();
  });
});

describe('loggerHistory', () => {
  it('"We moved one of the Tel Aviv loggers into the new display fridge last week"', () => {
    expect(
      loggerHistory([
        { loggerCode: 'TL-0417', fromUtc: '2026-09-16T21:00:00Z', toUtc: null },
        { loggerCode: 'TL-0390', fromUtc: '2026-08-30T21:00:00Z', toUtc: '2026-09-16T21:00:00Z' },
      ]),
    ).toBe('TL-0390 was here from 31 Aug to 17 Sep. TL-0417 has been here since 17 Sep.');
  });

  it('says nothing for a fridge that has never had a logger', () => {
    expect(loggerHistory([])).toBeNull();
  });
});
