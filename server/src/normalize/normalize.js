import Papa from 'papaparse';
import { TIME_ZONE } from '@chilllog/shared';
import {
  looksLikeTimestamp,
  detectDateFormat,
  parseTimestamp,
  createUtcConverter,
} from './dates.js';

/**
 * One temperature reading, in UTC and °C.
 * @typedef {{ tsUtc: string, tempC: number | null, isErr: boolean }} Reading
 *   tempC is null when the logger wrote ERR.
 */

/**
 * @typedef {object} NormalizedFile
 * @property {Reading[]} readings sorted by time, one per moment
 * @property {{ time: number, temp: number, delimiter: string } | null} columns null when no time column was found
 * @property {{ used: 'DD/MM' | 'MM/DD', detected: 'DD/MM' | 'MM/DD' | null }} dateFormat
 * @property {{ err: number, unreadable: number, duplicates: number }} counts
 * @property {boolean} outOfOrder the file's rows weren't in time order
 * @property {'looks_fahrenheit' | 'looks_celsius' | null} unitWarning
 */

// Tab and semicolon first: a semicolon file usually uses the comma as its decimal point.
const DELIMITERS = ['\t', ';', ',', '|'];
const ERR = /^err(or)?$/i;
const NUMBER = /^[-+]?\d+(?:[.,]\d+)?$/;
const HEADER_TEMP = /temp|°/i;

// Fridge readings sit around 1–8 °C, i.e. 34–46 °F. A median past 20 in either unit is the other one.
const WRONG_UNIT_MEDIAN = 20;

/**
 * Turns the text of one logger file into UTC °C readings. Deterministic: same text and
 * settings, same result. Rows that can't be read are counted, never guessed.
 * @param {string} text
 * @param {{ unit?: 'C' | 'F', dateFormat?: 'DD/MM' | 'MM/DD', zone?: string }} [settings] from the logger's registry entry
 * @returns {NormalizedFile}
 */
export function normalizeFile(text, { unit = 'C', dateFormat = 'DD/MM', zone = TIME_ZONE } = {}) {
  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = guessDelimiter(clean);
  const rows = Papa.parse(clean, { delimiter, skipEmptyLines: 'greedy' }).data.map((row) =>
    row.map((cell) => cell.trim()),
  );

  const result = {
    readings: [],
    columns: null,
    dateFormat: { used: dateFormat, detected: null },
    counts: { err: 0, unreadable: 0, duplicates: 0 },
    outOfOrder: false,
    unitWarning: null,
  };

  const columns = detectColumns(rows);
  if (!columns) return result;
  result.columns = { ...columns, delimiter };

  // Everything above the first timestamp is a preamble (logger ID line, header row), not data.
  const dataRows = rows.slice(rows.findIndex((row) => looksLikeTimestamp(row[columns.time] ?? '')));
  const detected = detectDateFormat(dataRows.map((row) => row[columns.time] ?? ''));
  const used = detected ?? dateFormat;
  result.dateFormat = { used, detected };

  const toUtc = createUtcConverter(zone);
  const inFileOrder = [];
  const rawValues = [];
  for (const row of dataRows) {
    const parts = parseTimestamp(row[columns.time] ?? '', used);
    const tsUtc = parts && toUtc(parts);
    const temp = parseTemperature(row[columns.temp] ?? '');
    if (!tsUtc || !temp) {
      result.counts.unreadable++;
      continue;
    }
    if (!temp.isErr) rawValues.push(temp.value);
    inFileOrder.push({
      tsUtc,
      tempC: temp.isErr ? null : unit === 'F' ? fahrenheitToCelsius(temp.value) : temp.value,
      isErr: temp.isErr,
    });
  }

  result.outOfOrder = inFileOrder.some((r, i) => i > 0 && r.tsUtc < inFileOrder[i - 1].tsUtc);

  // Stable sort keeps file order among equal times, so the first copy of a repeated row wins.
  const sorted = inFileOrder.toSorted((a, b) =>
    a.tsUtc < b.tsUtc ? -1 : a.tsUtc > b.tsUtc ? 1 : 0,
  );
  for (const reading of sorted) {
    if (result.readings.at(-1)?.tsUtc === reading.tsUtc) {
      result.counts.duplicates++;
      continue;
    }
    result.readings.push(reading);
    if (reading.isErr) result.counts.err++;
  }

  result.unitWarning = checkUnit(rawValues, unit);
  return result;
}

function guessDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  return (
    DELIMITERS.find((d) => lines.filter((l) => l.includes(d)).length >= lines.length / 2) ?? ','
  );
}

/** @returns {{ value: number, isErr: false } | { value: null, isErr: true } | null} */
function parseTemperature(cell) {
  const text = cell.replace(/\s*°?\s*[CF]$/i, '');
  if (ERR.test(text)) return { value: null, isErr: true };
  if (!NUMBER.test(text)) return null;
  return { value: Number(text.replace(',', '.')), isErr: false };
}

function fahrenheitToCelsius(f) {
  return Math.round(((f - 32) * 5 * 100) / 9) / 100;
}

/**
 * The time column is the one where most cells are timestamps; the temperature column is,
 * of the rest, the one where most cells are numbers or ERR. Ties go to a column whose header
 * says "temp", then to one with decimals or ERR (so a 1, 2, 3… row counter loses).
 */
function detectColumns(rows) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  const count = (col, test) => rows.filter((row) => test(row[col] ?? '')).length;

  let time = -1;
  let best = 0;
  for (let col = 0; col < width; col++) {
    const score = count(col, looksLikeTimestamp);
    if (score > best) [time, best] = [col, score];
  }
  if (time === -1) return null;

  const firstData = rows.findIndex((row) => looksLikeTimestamp(row[time] ?? ''));
  const header = firstData > 0 ? rows[firstData - 1] : [];
  const candidates = [];
  for (let col = 0; col < width; col++) {
    if (col === time) continue;
    candidates.push({
      col,
      score: count(col, (cell) => parseTemperature(cell) !== null),
      header: HEADER_TEMP.test(header[col] ?? '') ? 1 : 0,
      decimals: count(col, (cell) => /[.,]\d|^err/i.test(cell)) > 0 ? 1 : 0,
    });
  }
  candidates.sort(
    (a, b) => b.score - a.score || b.header - a.header || b.decimals - a.decimals || a.col - b.col,
  );
  if (!candidates.length || candidates[0].score === 0) return null;
  return { time, temp: candidates[0].col };
}

function checkUnit(values, unit) {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (unit === 'C' && median > WRONG_UNIT_MEDIAN) return 'looks_fahrenheit';
  if (unit === 'F' && median < WRONG_UNIT_MEDIAN) return 'looks_celsius';
  return null;
}
