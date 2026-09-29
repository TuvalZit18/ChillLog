// "See, in one place, how every fridge is doing and where something is wrong" (Summer's email).
// Entries have the shape GET /api/overview returns for each fridge.

import { describe, expect, it } from 'vitest';
import {
  branchSummary,
  countByStatus,
  filterFridges,
  fridgeType,
  groupBranches,
  placeFilterOptions,
  readPlaceFilter,
  needsAttention,
  readStatusFilter,
  sortWorstFirst,
} from './overviewModel.js';

let nextId = 1;
const branchIds = new Map();
const branchId = (name) => {
  if (!branchIds.has(name)) branchIds.set(name, branchIds.size + 1);
  return branchIds.get(name);
};
const fridge = (branchName, fridgeName, status) => ({
  fridgeId: nextId++,
  fridgeName,
  branchId: branchId(branchName),
  branchName,
  noLogger: false,
  latest: null,
  alert: null,
  warming: null,
  gap: null,
  sparkline: [],
  status,
});

describe('sortWorstFirst', () => {
  it('puts the worst status first, then branch and fridge by name', () => {
    const sorted = sortWorstFirst([
      fridge('Haifa', 'Dairy', 'ok'),
      fridge('Eilat', 'Display 1', 'gap'),
      fridge('Rishon LeZion', 'Cream cakes', 'alert'),
      fridge('Ashdod', 'Dairy', 'gap'),
      fridge('Holon', 'Main', 'warming'),
    ]);
    expect(sorted.map((f) => `${f.status} ${f.branchName}`)).toEqual([
      'alert Rishon LeZion',
      'warming Holon',
      'gap Ashdod',
      'gap Eilat',
      'ok Haifa',
    ]);
  });
});

describe('needsAttention', () => {
  it('lists every fridge that is not OK, worst first, and leaves OK fridges out', () => {
    const items = needsAttention([
      fridge('Haifa', 'Dairy', 'ok'),
      fridge('Ashdod', 'Dairy', 'gap'),
      fridge('Rishon LeZion', 'Cream cakes', 'alert'),
    ]);
    expect(items.map((i) => i.kind === 'fridge' && i.fridge.fridgeName)).toEqual([
      'Cream cakes',
      'Dairy',
    ]);
  });

  it('shows a branch that sent no file this week as one card, not one per fridge', () => {
    const items = needsAttention([
      fridge('Netanya', 'Display 1', 'no_file'),
      fridge('Netanya', 'Display 2', 'no_file'),
      fridge('Netanya', 'Dairy', 'no_file'),
      fridge('Ashdod', 'Dairy', 'gap'),
    ]);
    expect(items).toEqual([
      expect.objectContaining({ kind: 'fridge' }),
      { kind: 'branch', branchId: branchId('Netanya'), branchName: 'Netanya', fridgeCount: 3 },
    ]);
  });

  it('keeps a separate card for one missing fridge when the rest of its branch reported', () => {
    const items = needsAttention([
      fridge('Holon', 'Main', 'no_file'),
      fridge('Holon', 'Dairy', 'ok'),
    ]);
    expect(items).toEqual([expect.objectContaining({ kind: 'fridge' })]);
  });
});

describe('groupBranches', () => {
  it('groups fridges by branch in name order, each with its worst fridge', () => {
    const branches = groupBranches([
      fridge('Rishon LeZion', 'Display', 'ok'),
      fridge('Rishon LeZion', 'Cream cakes', 'alert'),
      fridge('Ashdod', 'Dairy', 'ok'),
    ]);
    expect(branches.map((b) => b.branchName)).toEqual(['Ashdod', 'Rishon LeZion']);
    expect(branches[1].fridges.map((f) => f.fridgeName)).toEqual(['Cream cakes', 'Display']);
    expect(branches[1].worst.fridgeName).toBe('Cream cakes');
    expect(branches[0].worst.status).toBe('ok');
  });
});

describe('branchSummary', () => {
  const branch = (...statuses) => ({
    fridges: statuses.map((status, i) => fridge('Haifa', `Fridge ${i}`, status)),
  });

  // The fridge count sits in the card's corner, so the summary is only the branch's state and
  // fits on one line.
  it('says in words what is wrong in a branch, worst first', () => {
    expect(branchSummary(branch('gap', 'ok'))).toBe('1 gap');
    expect(branchSummary(branch('ok', 'gap', 'alert'))).toBe('1 alert, 1 gap');
    expect(branchSummary(branch('gap', 'gap', 'warming', 'no_file'))).toBe(
      '1 warming, 2 gaps, 1 without a file',
    );
  });

  it('says "No file this week" when the whole branch sent nothing', () => {
    expect(branchSummary(branch('no_file', 'no_file'))).toBe('No file this week');
  });

  it('says "All OK" when nothing is wrong', () => {
    expect(branchSummary(branch('ok', 'ok'))).toBe('All OK');
  });
});

describe('fridgeType', () => {
  it('groups numbered fridges: "Display 1" and "Display 2" are both "Display"', () => {
    expect(fridgeType('Display 1')).toBe('Display');
    expect(fridgeType('Display 12')).toBe('Display');
  });

  it('keeps every other name as its own type', () => {
    expect(fridgeType('Walk-in')).toBe('Walk-in');
    expect(fridgeType('Cream cakes')).toBe('Cream cakes');
    expect(fridgeType('  Dairy ')).toBe('Dairy');
  });
});

describe('filterFridges and countByStatus', () => {
  const all = [
    fridge('Rishon LeZion', 'Cream cakes', 'alert'),
    fridge('Rishon LeZion', 'Dairy', 'ok'),
    fridge('Petah Tikva', 'Display 1', 'warming'),
    fridge('Tel Aviv', 'Display 2', 'ok'),
  ];

  it('narrows to one branch, one type, or both', () => {
    const names = (list) => list.map((f) => f.fridgeName);
    expect(names(filterFridges(all, { branchId: branchId('Rishon LeZion'), type: null }))).toEqual([
      'Cream cakes',
      'Dairy',
    ]);
    expect(names(filterFridges(all, { branchId: null, type: 'Display' }))).toEqual([
      'Display 1',
      'Display 2',
    ]);
    expect(
      filterFridges(all, { branchId: branchId('Petah Tikva'), type: 'Display' }).map(
        (f) => f.fridgeName,
      ),
    ).toEqual(['Display 1']);
    expect(filterFridges(all, { branchId: null, type: null })).toHaveLength(4);
  });

  it('narrows by status too, alone or with branch and type', () => {
    const names = (list) => list.map((f) => f.fridgeName);
    expect(names(filterFridges(all, { branchId: null, type: null, status: 'ok' }))).toEqual([
      'Dairy',
      'Display 2',
    ]);
    expect(
      names(filterFridges(all, { branchId: branchId('Rishon LeZion'), type: null, status: 'ok' })),
    ).toEqual(['Dairy']);
    expect(filterFridges(all, { branchId: null, type: 'Display', status: 'alert' })).toEqual([]);
  });

  it('counts every status, so the chips follow the filters', () => {
    expect(countByStatus(filterFridges(all, { branchId: null, type: 'Display' }))).toEqual({
      alert: 0,
      warming: 1,
      gap: 0,
      no_file: 0,
      ok: 1,
    });
  });
});

describe('placeFilterOptions', () => {
  // The branches as GET /api/branches returns them (from the database), each with its fridges:
  // Yoqneam Illit was just added in Setup and has no fridges yet.
  const branches = [
    { id: 3, name: 'Tel Aviv', fridges: [{ name: 'Display 1' }, { name: 'Walk-in' }] },
    { id: 1, name: 'Beersheba', fridges: [{ name: 'Dairy' }, { name: 'Walk-in' }] },
    { id: 9, name: 'Yoqneam Illit', fridges: [] },
  ];
  const names = (list) => list.map((b) => b.name);

  it('lists every branch in the database, A–Z, even one with no fridges yet', () => {
    const options = placeFilterOptions(branches, { branchId: null, type: null });
    expect(names(options.branches)).toEqual(['Beersheba', 'Tel Aviv', 'Yoqneam Illit']);
    expect(options.branches[1]).toEqual({ id: 3, name: 'Tel Aviv' });
    expect(options.types).toEqual(['Dairy', 'Display', 'Walk-in']);
  });

  it('only offers what the other filter allows, so no choice leads to nothing', () => {
    const forBeersheba = placeFilterOptions(branches, { branchId: 1, type: null });
    expect(forBeersheba.types).toEqual(['Dairy', 'Walk-in']);
    const forDisplays = placeFilterOptions(branches, { branchId: null, type: 'Display' });
    expect(names(forDisplays.branches)).toEqual(['Tel Aviv']);
  });

  it('always keeps the chosen values, even an impossible pair from a bookmarked URL', () => {
    const options = placeFilterOptions(branches, { branchId: 1, type: 'Display' });
    // Tel Aviv has displays; Beersheba doesn't, but stays because it's the one chosen.
    expect(names(options.branches)).toEqual(['Beersheba', 'Tel Aviv']);
    expect(options.types).toEqual(['Dairy', 'Display', 'Walk-in']);
  });
});

describe('readPlaceFilter', () => {
  it('reads ?branch= and ?type= from the URL', () => {
    expect(readPlaceFilter(new URLSearchParams('branch=4&type=Display'))).toEqual({
      branchId: 4,
      type: 'Display',
    });
    expect(readPlaceFilter(new URLSearchParams(''))).toEqual({ branchId: null, type: null });
  });

  it('ignores a branch that is not a number', () => {
    expect(readPlaceFilter(new URLSearchParams('branch=abc')).branchId).toBeNull();
  });
});

describe('readStatusFilter', () => {
  it('accepts a real status from the URL and ignores anything else', () => {
    expect(readStatusFilter('alert')).toBe('alert');
    expect(readStatusFilter('no_file')).toBe('no_file');
    expect(readStatusFilter('broken')).toBeNull();
    expect(readStatusFilter(null)).toBeNull();
  });
});
