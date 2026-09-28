// Wording for the Loggers screens (docs/design/ui.md, "Loggers" and "Logger detail"). Pure
// functions of the registry API's responses, so the wording is tested.

import { formatDate } from '../../shared/format/format.js';

const number = new Intl.NumberFormat('en-US');

/** Loggers by the ID printed on them. */
export function sortByCode(loggers) {
  return [...loggers].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * One row of the logger list: where it is, since when, and tags for files written in a
 * non-default way (°F, month-first dates), so an odd logger stands out.
 */
export function loggerRow(logger) {
  const tags = [logger.unit === 'F' && '°F', logger.dateFormat === 'MM/DD' && 'Dates MM/DD'].filter(
    Boolean,
  );
  if (!logger.current) return { where: 'Not in a fridge', since: 'Spare logger', tags };
  return {
    where: `${logger.current.branchName} · ${logger.current.fridgeName}`,
    since: `since ${formatDate(logger.current.fromUtc)}`,
    tags,
  };
}

/**
 * After adding a logger or changing its settings, files that were waiting for it are tried
 * again on the server; say what happened to them.
 * @param {Array<{ status: string, readings: { added: number } }> | undefined} retried
 */
export function retriedNote(retried) {
  if (!retried?.length) return null;
  const done = retried.filter((r) => r.status === 'processed');
  const stuck = retried.length - done.length;
  const added = done.reduce((sum, r) => sum + r.readings.added, 0);
  const parts = [];
  if (done.length) {
    parts.push(
      `${done.length} waiting ${done.length === 1 ? 'file was' : 'files were'} processed: ${number.format(added)} readings added.`,
    );
  }
  if (stuck) parts.push(`${stuck} ${stuck === 1 ? 'is' : 'are'} still held back; see Upload.`);
  return parts.join(' ');
}
