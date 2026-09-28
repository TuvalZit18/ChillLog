// Wording for the Loggers screens (docs/design/ui.md, "Loggers" and "Logger detail"). Pure
// functions of the registry API's responses, so the wording is tested.

import { formatDate, formatDay, toIsraelLocal } from '../../shared/format/format.js';

const number = new Intl.NumberFormat('en-US');
const place = (p) => `${p.branchName} · ${p.fridgeName}`;

/** How a logger's files are written, in plain words. */
export const UNIT_LABELS = Object.freeze({ C: '°C', F: '°F' });
export const DATE_FORMAT_LABELS = Object.freeze({
  'DD/MM': 'Day first (21/09)',
  'MM/DD': 'Month first (09/21)',
});

/**
 * The move history as a timeline, newest first (GET /api/loggers/:id sends it that way): each
 * place lasts until the next move; the current one reads "From Wed 23 Sep · now".
 */
export function historyItems(logger) {
  return logger.history.map((p, i) => {
    const current = i === 0 && logger.current !== null;
    const next = logger.history[i - 1];
    return {
      key: p.id,
      where: place(p),
      when: current
        ? `From ${formatDay(p.fromUtc)} · now`
        : `${formatDate(p.fromUtc)} to ${formatDate(next.fromUtc)}`,
      current,
    };
  });
}

/**
 * The server's rules for a move, checked before sending so the message can use Israel dates:
 * after the current placement (by date, since the form picks a day) and to a different fridge.
 * @param {{ fridgeId: number, from: string }} move from is an Israel date 'YYYY-MM-DD'
 * @returns {{ field: 'from' | 'fridgeId', message: string } | null}
 */
export function checkMove({ fridgeId, from }, logger) {
  const { current } = logger;
  if (!current) return null;
  if (from <= toIsraelLocal(new Date(current.fromUtc)).slice(0, 10)) {
    return {
      field: 'from',
      message: `Pick a date after ${formatDate(current.fromUtc)}, when ${logger.code} went into ${place(current)}.`,
    };
  }
  if (fridgeId === current.fridgeId) {
    return {
      field: 'fridgeId',
      message: `${logger.code} is already in ${place(current)}. Choose another fridge.`,
    };
  }
  return null;
}

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
    where: place(logger.current),
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
