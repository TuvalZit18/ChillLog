// The inspector report's filters and answer (docs/design/ui.md, "Inspector report").
// "The Ministry of Health inspector asks me 'when did this fridge go above five degrees, and
// for how long?'" (Summer's email).

import { describe, expect, it } from 'vitest';
import { answer, filtersQuery, filtersSearch, readFilters, scopeOf } from './inspectorModel.js';

const TODAY = '2026-09-28';
const params = (text) => new URLSearchParams(text);
const BRANCHES = [
  {
    id: 4,
    name: 'Rishon LeZion',
    fridges: [
      { id: 8, name: 'Cream cakes' },
      { id: 9, name: 'Dairy' },
    ],
  },
  { id: 6, name: 'Ashdod', fridges: [{ id: 13, name: 'Dairy' }] },
];

describe('readFilters', () => {
  it('covers all fridges over the last 30 days when the URL says nothing', () => {
    expect(readFilters(params(''), TODAY)).toEqual({
      branchId: null,
      fridgeId: null,
      from: '2026-08-30',
      to: '2026-09-28',
    });
  });

  it('reads the filters from the URL, e.g. the fridge page\'s "Inspector report for this fridge"', () => {
    expect(readFilters(params('fridgeId=8'), TODAY)).toMatchObject({ branchId: null, fridgeId: 8 });
    expect(readFilters(params('branchId=4&from=2026-09-01&to=2026-09-21'), TODAY)).toEqual({
      branchId: 4,
      fridgeId: null,
      from: '2026-09-01',
      to: '2026-09-21',
    });
  });

  it('ignores ids that are not numbers', () => {
    expect(readFilters(params('branchId=abc'), TODAY).branchId).toBeNull();
  });
});

describe('filtersSearch', () => {
  it('keeps the URL short: the default dates are left out', () => {
    const filters = readFilters(params(''), TODAY);
    expect(filtersSearch({ ...filters, fridgeId: 8 }, TODAY)).toBe('?fridgeId=8');
    expect(filtersSearch({ ...filters, from: '2026-09-01' }, TODAY)).toBe(
      '?from=2026-09-01&to=2026-09-28',
    );
  });
});

describe('filtersQuery', () => {
  it('sends only the filters that are set', () => {
    expect(
      filtersQuery({ branchId: null, fridgeId: 8, from: '2026-09-01', to: '2026-09-21' }),
    ).toEqual({ query: { fridgeId: 8, from: '2026-09-01', to: '2026-09-21' } });
  });

  it('asks for both dates, in order, before asking the server', () => {
    const base = { branchId: null, fridgeId: null };
    expect(filtersQuery({ ...base, from: '', to: '2026-09-21' })).toEqual({
      error: 'Pick a start and an end date.',
    });
    expect(filtersQuery({ ...base, from: '2026-09-21', to: '2026-09-01' })).toEqual({
      error: 'The start date must be on or before the end date.',
    });
  });
});

describe('scopeOf', () => {
  it('names one fridge, one branch, or all branches', () => {
    expect(scopeOf({ branchId: null, fridgeId: 8 }, BRANCHES)).toEqual({
      kind: 'fridge',
      branchId: 4,
      branchName: 'Rishon LeZion',
      fridgeName: 'Cream cakes',
    });
    expect(scopeOf({ branchId: 6, fridgeId: null }, BRANCHES)).toEqual({
      kind: 'branch',
      branchId: 6,
      branchName: 'Ashdod',
    });
    expect(scopeOf({ branchId: null, fridgeId: null }, BRANCHES)).toEqual({
      kind: 'all',
      branchCount: 2,
    });
  });
});

describe('answer', () => {
  const text = (segments) => segments.map((s) => s.text).join('');
  const bold = (segments) => segments.filter((s) => s.bold).map((s) => s.text);
  const filters = { from: '2026-09-01', to: '2026-09-21' };
  const fridge = { kind: 'fridge', branchName: 'Rishon LeZion', fridgeName: 'Cream cakes' };
  const report = (count, totalMinutes, fridgesWithoutData = []) => ({
    summary: { count, totalMinutes },
    fridgesWithoutData,
  });

  it('"when did this fridge go above five degrees, and for how long?" in one sentence', () => {
    const segments = answer({ scope: fridge, report: report(1, 3435), filters });
    expect(text(segments)).toBe(
      'Rishon LeZion · Cream cakes was above 5°C 1 time between 1 Sep and 21 Sep, for a total of 2 days 9 h 15 min.',
    );
    expect(bold(segments)).toEqual(['Rishon LeZion · Cream cakes', '1 time', '2 days 9 h 15 min']);
  });

  it('answers for a branch and for all branches, counting every time', () => {
    const branch = { kind: 'branch', branchName: 'Rishon LeZion' };
    expect(text(answer({ scope: branch, report: report(3, 2100), filters }))).toBe(
      'Fridges in Rishon LeZion were above 5°C 3 times between 1 Sep and 21 Sep, for a total of 1 day 11 h.',
    );
    const all = { kind: 'all', branchCount: 12 };
    expect(text(answer({ scope: all, report: report(2, 2070), filters }))).toBe(
      'Fridges across all 12 branches were above 5°C 2 times between 1 Sep and 21 Sep, for a total of 1 day 10 h 30 min.',
    );
  });

  it('says plainly when a fridge was never above 5°C', () => {
    expect(text(answer({ scope: fridge, report: report(0, 0), filters }))).toBe(
      'Rishon LeZion · Cream cakes was not above 5°C between 1 Sep and 21 Sep.',
    );
  });

  it('never calls a fridge with no readings "not above 5°C": it says there are no readings', () => {
    const noData = report(0, 0, [
      { fridgeId: 8, branchName: 'Rishon LeZion', fridgeName: 'Cream cakes' },
    ]);
    expect(text(answer({ scope: fridge, report: noData, filters }))).toBe(
      "There are no readings for Rishon LeZion · Cream cakes between 1 Sep and 21 Sep, so this report can't say.",
    );
  });

  it('shows a single day as one date', () => {
    const oneDay = { from: '2026-09-14', to: '2026-09-14' };
    expect(text(answer({ scope: fridge, report: report(0, 0), filters: oneDay }))).toBe(
      'Rishon LeZion · Cream cakes was not above 5°C on 14 Sep.',
    );
  });
});
