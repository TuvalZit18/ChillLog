// The Loggers screen's wording (docs/design/ui.md, "Loggers"): which logger sits in which
// fridge, and anything unusual about how its files are written.

import { describe, expect, it } from 'vitest';
import {
  checkMove,
  DATE_FORMAT_LABELS,
  historyItems,
  retriedNote,
  UNIT_LABELS,
} from './loggersModel.js';

// TL-0417's detail as GET /api/loggers/1 returns it: history newest first.
const moved = {
  id: 1,
  code: 'TL-0417',
  unit: 'C',
  dateFormat: 'DD/MM',
  current: {
    fridgeId: 3,
    fridgeName: 'Display 2',
    branchName: 'Tel Aviv',
    fromUtc: '2026-09-23T15:00:00Z',
  },
  history: [
    {
      id: 2,
      fridgeId: 3,
      fridgeName: 'Display 2',
      branchName: 'Tel Aviv',
      fromUtc: '2026-09-23T15:00:00Z',
    },
    {
      id: 1,
      fridgeId: 1,
      fridgeName: 'Walk-in',
      branchName: 'Tel Aviv',
      fromUtc: '2026-08-30T21:00:00Z',
    },
  ],
};

describe('historyItems', () => {
  it('"We moved one of the Tel Aviv loggers into the new display fridge": each place, newest first, until the next move', () => {
    expect(historyItems(moved)).toEqual([
      { key: 2, where: 'Tel Aviv · Display 2', when: 'From Wed 23 Sep · now', current: true },
      { key: 1, where: 'Tel Aviv · Walk-in', when: '31 Aug to 23 Sep', current: false },
    ]);
  });

  it('is empty for a logger that was never placed', () => {
    expect(historyItems({ ...moved, current: null, history: [] })).toEqual([]);
  });
});

describe('checkMove', () => {
  it('lets a move to another fridge, after the current placement, through', () => {
    expect(checkMove({ fridgeId: 1, from: '2026-09-24' }, moved)).toBeNull();
  });

  it('asks for a date after the current placement, in Israel time rather than UTC', () => {
    expect(checkMove({ fridgeId: 1, from: '2026-09-23' }, moved)).toEqual({
      field: 'from',
      message: 'Pick a date after 23 Sep, when TL-0417 went into Tel Aviv · Display 2.',
    });
  });

  it('says so when the logger is already in the chosen fridge', () => {
    expect(checkMove({ fridgeId: 3, from: '2026-09-24' }, moved)).toEqual({
      field: 'fridgeId',
      message: 'TL-0417 is already in Tel Aviv · Display 2. Choose another fridge.',
    });
  });

  it('places a spare logger from any date', () => {
    expect(checkMove({ fridgeId: 1, from: '2026-01-01' }, { ...moved, current: null })).toBeNull();
  });
});

describe('UNIT_LABELS and DATE_FORMAT_LABELS', () => {
  it('say how the files are written in plain words', () => {
    expect(UNIT_LABELS).toEqual({ C: '°C', F: '°F' });
    expect(DATE_FORMAT_LABELS).toEqual({
      'DD/MM': 'Day first (21/09)',
      'MM/DD': 'Month first (09/21)',
    });
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
