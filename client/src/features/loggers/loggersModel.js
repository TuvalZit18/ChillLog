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

/**
 * The Loggers page has two tabs, kept in the URL: the loggers (the default, no `tab`) and
 * branches and fridges (`?tab=branches`).
 * @returns {'loggers' | 'branches'}
 */
export function readTab(params) {
  return params.get('tab') === 'branches' ? 'branches' : 'loggers';
}

/** The search string for another tab, keeping the loggers table's filters and sort. */
export function tabSearch(params, tab) {
  const next = new URLSearchParams(params);
  if (tab === 'branches') next.set('tab', 'branches');
  else next.delete('tab');
  return next.toString();
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
