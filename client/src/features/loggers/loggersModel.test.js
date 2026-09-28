// The Loggers screen's wording (docs/design/ui.md, "Loggers"): which logger sits in which
// fridge, and anything unusual about how its files are written.

import { describe, expect, it } from 'vitest';
import { loggerRow, retriedNote, sortByCode } from './loggersModel.js';

const logger = (overrides) => ({
  id: 1,
  code: 'TL-0417',
  unit: 'C',
  dateFormat: 'DD/MM',
  current: {
    fridgeId: 3,
    fridgeName: 'Display 2',
    branchName: 'Tel Aviv',
    fromUtc: '2026-09-16T21:00:00Z',
  },
  ...overrides,
});

describe('loggerRow', () => {
  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": shows where it is now, and since when', () => {
    expect(loggerRow(logger())).toEqual({
      where: 'Tel Aviv · Display 2',
      since: 'since 17 Sep',
      tags: [],
    });
  });

  it('"The old logger in Haifa shows the numbers differently": tags a logger whose files are °F or month-first', () => {
    expect(loggerRow(logger({ unit: 'F', dateFormat: 'MM/DD' })).tags).toEqual([
      '°F',
      'Dates MM/DD',
    ]);
  });

  it('calls a logger that is in no fridge a spare', () => {
    expect(loggerRow(logger({ current: null }))).toEqual({
      where: 'Not in a fridge',
      since: 'Spare logger',
      tags: [],
    });
  });
});

describe('sortByCode', () => {
  it('lists loggers by the ID printed on them', () => {
    const sorted = sortByCode([logger({ code: 'TL-0512' }), logger({ code: 'TL-0231' })]);
    expect(sorted.map((l) => l.code)).toEqual(['TL-0231', 'TL-0512']);
  });
});

describe('retriedNote', () => {
  const report = (status, added) => ({ status, readings: { added } });

  it('says when files that were waiting for this logger were processed', () => {
    expect(retriedNote([report('processed', 672)])).toBe(
      '1 waiting file was processed: 672 readings added.',
    );
    expect(retriedNote([report('processed', 672), report('processed', 1330)])).toBe(
      '2 waiting files were processed: 2,002 readings added.',
    );
  });

  it('says when a waiting file still could not be processed', () => {
    expect(retriedNote([report('processed', 672), report('failed', 0)])).toBe(
      '1 waiting file was processed: 672 readings added. 1 is still held back; see Upload.',
    );
  });

  it('says nothing when no files were waiting', () => {
    expect(retriedNote([])).toBeNull();
    expect(retriedNote(undefined)).toBeNull();
  });
});
