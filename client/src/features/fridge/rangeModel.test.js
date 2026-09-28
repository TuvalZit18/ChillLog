// The fridge page's range: Last 24h · 7 days · 30 days · Custom, kept in the URL so a view can
// be bookmarked or shared (architecture §8).

import { describe, expect, it } from 'vitest';
import { rangeQuery, rangeSearch, readRange } from './rangeModel.js';

const params = (text) => new URLSearchParams(text);
const NOW = new Date('2026-09-28T09:30:00Z'); // Mon 28 Sep, 12:30 in Israel

describe('readRange', () => {
  it('shows the last 7 days when the URL says nothing', () => {
    expect(readRange(params(''))).toEqual({ kind: 'preset', key: '7d' });
  });

  it('reads a preset from ?range=', () => {
    expect(readRange(params('range=24h'))).toEqual({ kind: 'preset', key: '24h' });
    expect(readRange(params('range=30d'))).toEqual({ kind: 'preset', key: '30d' });
  });

  it('falls back to 7 days for a preset it does not know', () => {
    expect(readRange(params('range=5y'))).toEqual({ kind: 'preset', key: '7d' });
  });

  it('reads a custom range from ?from=&to=, even half filled in', () => {
    expect(readRange(params('from=2026-09-14&to=2026-09-20'))).toEqual({
      kind: 'custom',
      from: '2026-09-14',
      to: '2026-09-20',
    });
    expect(readRange(params('from=2026-09-14'))).toEqual({
      kind: 'custom',
      from: '2026-09-14',
      to: '',
    });
  });
});

describe('rangeSearch', () => {
  it('writes presets as ?range= and a custom range as ?from=&to=', () => {
    expect(rangeSearch({ kind: 'preset', key: '24h' })).toBe('?range=24h');
    expect(rangeSearch({ kind: 'preset', key: '7d' })).toBe('');
    expect(rangeSearch({ kind: 'custom', from: '2026-09-14', to: '2026-09-20' })).toBe(
      '?from=2026-09-14&to=2026-09-20',
    );
  });
});

describe('rangeQuery', () => {
  it('asks for the last 24 hours, 7 days or 30 days up to now, in Israel time', () => {
    expect(rangeQuery({ kind: 'preset', key: '24h' }, NOW)).toEqual({
      query: { from: '2026-09-27T12:30' },
    });
    expect(rangeQuery({ kind: 'preset', key: '7d' }, NOW)).toEqual({
      query: { from: '2026-09-21T12:30' },
    });
    expect(rangeQuery({ kind: 'preset', key: '30d' }, NOW)).toEqual({
      query: { from: '2026-08-29T12:30' },
    });
  });

  it('passes a custom range through as whole days', () => {
    const range = { kind: 'custom', from: '2026-09-14', to: '2026-09-20' };
    expect(rangeQuery(range, NOW)).toEqual({ query: { from: '2026-09-14', to: '2026-09-20' } });
  });

  it('accepts a single day, since "to" includes that whole day', () => {
    const range = { kind: 'custom', from: '2026-09-14', to: '2026-09-14' };
    expect(rangeQuery(range, NOW).query).toBeDefined();
  });

  it('asks for both dates before loading a custom range', () => {
    expect(rangeQuery({ kind: 'custom', from: '2026-09-14', to: '' }, NOW)).toEqual({
      error: 'Pick a start and an end date.',
    });
  });

  it('says so when the start is after the end, instead of asking the server', () => {
    expect(rangeQuery({ kind: 'custom', from: '2026-09-20', to: '2026-09-14' }, NOW)).toEqual({
      error: 'The start date must be on or before the end date.',
    });
  });
});
