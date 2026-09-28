import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeFile, previewRows } from '../src/normalize/normalize.js';

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

/** Just the time and temperature of each reading, for compact expectations. */
const pairs = (result) => result.readings.map((r) => [r.tsUtc, r.tempC]);

describe('normalizeFile', () => {
  it('"The old logger in Haifa shows the numbers differently from all the others, so I convert in my head": °F is converted to °C', () => {
    const result = normalizeFile(fixture('haifa-fahrenheit-ddmm.csv'), { unit: 'F' });
    expect(pairs(result)).toEqual([
      ['2026-09-14T03:00:00Z', 3.39],
      ['2026-09-14T03:15:00Z', 3.5],
      ['2026-09-14T03:30:00Z', null],
      ['2026-09-14T03:45:00Z', 3.78],
      ['2026-09-14T04:00:00Z', 3.89],
    ]);
    expect(result.dateFormat).toEqual({ used: 'DD/MM', detected: 'DD/MM' });
    expect(result.unitWarning).toBeNull();
  });

  it('"The files don\'t look quite the same from branch to branch, the columns move around": finds time and temperature wherever they are', () => {
    const result = normalizeFile(fixture('columns-swapped-semicolon.csv'));
    expect(result.columns).toEqual({ time: 1, temp: 0, delimiter: ';' });
    expect(pairs(result)).toEqual([
      ['2026-09-14T03:00:00Z', 3.9],
      ['2026-09-14T03:15:00Z', 4],
      ['2026-09-14T03:30:00Z', 4.2],
    ]);
  });

  it('ERR in the logger file ("14/09/2026 06:30 | ERR" in the sheet) is kept as a reading with no temperature', () => {
    const result = normalizeFile(fixture('err-values.csv'));
    expect(result.readings).toHaveLength(5);
    expect(result.counts.err).toBe(3);
    expect(result.readings.filter((r) => r.isErr).every((r) => r.tempC === null)).toBe(true);
    expect(result.counts.unreadable).toBe(0);
  });

  it('sorts out-of-order rows and drops repeated rows, counting both', () => {
    const result = normalizeFile(fixture('duplicates-and-out-of-order.csv'));
    expect(result.columns.delimiter).toBe('\t');
    expect(pairs(result)).toEqual([
      ['2026-09-16T05:00:00Z', 3.8],
      ['2026-09-16T05:15:00Z', 3.8],
      ['2026-09-16T05:30:00Z', 3.9],
      ['2026-09-16T05:45:00Z', 4],
    ]);
    expect(result.outOfOrder).toBe(true);
    expect(result.counts.duplicates).toBe(1);
  });

  it('keeps both readings of the hour that repeats when the clocks go back', () => {
    const result = normalizeFile(fixture('dst-repeated-hour.csv'));
    expect(result.readings.map((r) => r.tsUtc)).toEqual([
      '2026-10-24T21:30:00Z',
      '2026-10-24T21:45:00Z',
      '2026-10-24T22:00:00Z', // 01:00 summer time
      '2026-10-24T22:15:00Z',
      '2026-10-24T22:30:00Z',
      '2026-10-24T22:45:00Z',
      '2026-10-24T23:00:00Z', // 01:00 again, winter time
      '2026-10-24T23:15:00Z',
      '2026-10-24T23:30:00Z',
      '2026-10-24T23:45:00Z',
      '2026-10-25T00:00:00Z',
    ]);
    expect(result.counts.duplicates).toBe(0);
  });

  describe('day/month order', () => {
    it('detects month/day when the second number goes above 12', () => {
      const result = normalizeFile('09/14/2026 06:00,3.9\n09/14/2026 06:15,4.0\n');
      expect(result.dateFormat).toEqual({ used: 'MM/DD', detected: 'MM/DD' });
      expect(result.readings[0].tsUtc).toBe('2026-09-14T03:00:00Z');
    });

    it("falls back to the logger's setting when every date could be either", () => {
      const text = '03/04/2026 06:00,3.9\n03/04/2026 06:15,4.0\n';
      expect(normalizeFile(text).readings[0].tsUtc).toBe('2026-04-03T03:00:00Z');
      const us = normalizeFile(text, { dateFormat: 'MM/DD' });
      expect(us.dateFormat).toEqual({ used: 'MM/DD', detected: null });
      expect(us.readings[0].tsUtc).toBe('2026-03-04T04:00:00Z'); // before the clocks change: UTC+2
    });
  });

  describe('unit sanity check', () => {
    it('warns when a °C logger writes values that look like °F', () => {
      const result = normalizeFile(fixture('haifa-fahrenheit-ddmm.csv'), { unit: 'C' });
      expect(result.unitWarning).toBe('looks_fahrenheit');
    });

    it('warns when a °F logger writes values that look like °C', () => {
      const result = normalizeFile(fixture('err-values.csv'), { unit: 'F' });
      expect(result.unitWarning).toBe('looks_celsius');
    });
  });

  it('reads a CSV saved by Excel with a byte-order mark', () => {
    const text = '\uFEFFTime,Temp\n14/09/2026 06:00,3.9\n';
    expect(normalizeFile(text).readings).toEqual([
      { tsUtc: '2026-09-14T03:00:00Z', tempC: 3.9, isErr: false },
    ]);
    expect(previewRows(text)).toEqual([{ time: '14/09/2026 06:00', temp: '3.9' }]);
  });

  it('reads 12-hour times and times with seconds', () => {
    const result = normalizeFile('14/09/2026 1:30 PM,4.0\n14/09/2026 13:45:30,4.1\n');
    expect(result.readings.map((r) => r.tsUtc)).toEqual([
      '2026-09-14T10:30:00Z',
      '2026-09-14T10:45:30Z',
    ]);
  });

  it('counts rows it cannot read instead of guessing', () => {
    const result = normalizeFile(
      '14/09/2026 06:00,3.9\n31/09/2026 06:15,4.0\n14/09/2026 06:30,warm\n',
    );
    expect(result.readings).toHaveLength(1);
    expect(result.counts.unreadable).toBe(2);
  });

  it('returns no readings, rather than failing, for a file with no time column', () => {
    const result = normalizeFile('hello,world\nfoo,bar\n');
    expect(result.columns).toBeNull();
    expect(result.readings).toEqual([]);
  });
});
