import { describe, it, expect } from 'vitest';
import { formatDurationLong } from '@chilllog/shared';
import { UTF8_BOM, csvCell, toCsv } from '../src/reporting/csv.js';

describe('csvCell: safe to open in Excel', () => {
  it('turns text that starts like a formula into plain text', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+972 50 000 0000')).toBe("'+972 50 000 0000");
    expect(csvCell('-fridge')).toBe("'-fridge");
    expect(csvCell('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
  });

  it('leaves numbers as numbers, negative ones included', () => {
    expect(csvCell(-2.5)).toBe('-2.5');
    expect(csvCell(6.1)).toBe('6.1');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Tel Aviv, Display 2')).toBe('"Tel Aviv, Display 2"');
    expect(csvCell('say "cold"')).toBe('"say ""cold"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it('writes empty cells for missing values', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('starts the file with a byte-order mark so Excel reads °C and Hebrew correctly', () => {
    const csv = toCsv(['Fridge', 'Peak °C'], [['מקרר חלב', 6.1]]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(UTF8_BOM.codePointAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Fridge,Peak °C\r\nמקרר חלב,6.1\r\n');
  });
});

describe('formatDurationLong', () => {
  it('says durations the way the inspector answer does', () => {
    expect(formatDurationLong(3435)).toBe('2 days 9 h 15 min');
    expect(formatDurationLong(2040)).toBe('1 day 10 h');
    expect(formatDurationLong(1440)).toBe('1 day');
    expect(formatDurationLong(60)).toBe('1 h');
    expect(formatDurationLong(45)).toBe('45 min');
    expect(formatDurationLong(0)).toBe('0 min');
  });
});
