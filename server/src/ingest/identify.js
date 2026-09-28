import path from 'node:path';

// Assumed file format (NOTES.md asks Summer to confirm): the logger ID is on a line above the
// data ("Logger ID: TL-0231") or in the file name ("TL-0417_2026-09-21.csv").
const HEADER_LINE = /\b(?:logger|serial|device)\b[^:=\n]*[:=]\s*([A-Za-z0-9][A-Za-z0-9-]*)/i;
const NAME_CODE = /(?:^|[^A-Za-z0-9])([A-Za-z]{1,4}-\d{3,6})(?!\d)/;
const HEADER_LINES_TO_SCAN = 5;

/**
 * The logger ID a file names, upper-cased, or null. A line inside the file wins over the file
 * name: the logger writes the line itself, while a branch manager may rename the file.
 * @param {string} fileName
 * @param {string} text
 * @returns {string | null}
 */
export function findLoggerCode(fileName, text) {
  for (const line of text.split(/\r?\n/, HEADER_LINES_TO_SCAN)) {
    const match = HEADER_LINE.exec(line);
    if (match) return match[1].toUpperCase();
  }
  const match = NAME_CODE.exec(path.basename(fileName));
  return match ? match[1].toUpperCase() : null;
}
