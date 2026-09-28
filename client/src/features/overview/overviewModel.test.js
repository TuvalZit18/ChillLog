// "See, in one place, how every fridge is doing and where something is wrong" (Summer's email).
// Entries have the shape GET /api/overview returns for each fridge.

import { describe, expect, it } from 'vitest';
import {
  branchSummary,
  groupBranches,
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

  it('says in words what is wrong in a branch, worst first, and how many fridges it has', () => {
    expect(branchSummary(branch('gap', 'ok'))).toBe('1 gap · 2 fridges');
    expect(branchSummary(branch('ok', 'gap', 'alert'))).toBe('1 alert, 1 gap · 3 fridges');
    expect(branchSummary(branch('gap', 'gap', 'warming', 'no_file'))).toBe(
      '1 warming, 2 gaps, 1 without a file · 4 fridges',
    );
  });

  it('says "No file this week" when the whole branch sent nothing', () => {
    expect(branchSummary(branch('no_file', 'no_file'))).toBe('No file this week · 2 fridges');
  });

  it('says "All OK" when nothing is wrong', () => {
    expect(branchSummary(branch('ok', 'ok'))).toBe('All OK · 2 fridges');
    expect(branchSummary(branch('ok'))).toBe('All OK · 1 fridge');
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
