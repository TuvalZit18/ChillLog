// CSV for Excel. Summer opens exports in Excel, where a cell that starts like a formula
// (=, +, -, @) runs as one: a fridge named =HYPERLINK(...) would become a live link.
// Text cells like that get a leading apostrophe, which Excel shows as plain text. Numbers are
// written as numbers, so a negative temperature stays a number.

/** Excel reads a UTF-8 file correctly (°C, Hebrew names) only when it starts with this mark. */
export const UTF8_BOM = String.fromCodePoint(0xfeff);

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/** @param {string | number | null | undefined} value */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {string[]} header
 * @param {(string | number | null)[][]} rows
 * @returns {string} with the BOM, CRLF line ends (what Excel writes itself)
 */
export function toCsv(header, rows) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}
