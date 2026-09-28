// What the upload report says about each file (docs/design/ui.md, "Upload file card"). Pure
// functions of POST /api/uploads' per-file reports, so every sentence is tested.

import { UPLOAD_LIMITS } from '@chilllog/shared';

const number = new Intl.NumberFormat('en-US');
const count = (n, one, many = `${one}s`) => `${number.format(n)} ${n === 1 ? one : many}`;

/**
 * Which card a file gets: added · notes (added, with notes) · duplicate (already uploaded) ·
 * held (held back) · help (needs your help) · rejected (not uploaded).
 */
export function fileKind(report) {
  switch (report.status) {
    case 'already_uploaded':
      return 'duplicate';
    case 'failed':
      return 'held';
    case 'needs_logger':
      return 'help';
    case 'rejected':
      return 'rejected';
    default: {
      const { err, unreadable, duplicatesInFile, beforePlacement } = report.readings;
      const skipped = err + unreadable + duplicatesInFile + beforePlacement;
      return skipped > 0 || report.notes.length > 0 ? 'notes' : 'added';
    }
  }
}

const NOTE_TEXT = {
  out_of_order: 'Rows were out of time order; sorted',
  date_format_differs: "Dates are day/month the other way round from this logger's setting",
};

const HELD_TEXT = {
  looks_fahrenheit:
    "Temperatures look like °F, but this logger is set to °C. Nothing was added. Check the logger's settings, then try again.",
  looks_celsius:
    "Temperatures look like °C, but this logger is set to °F. Nothing was added. Check the logger's settings, then try again.",
  no_readings: 'No readings found in this file. Nothing was added.',
  error: 'Something went wrong reading this file. Nothing was added.',
};

/** The result lines under the file name. */
export function fileLines(report) {
  const r = report.readings;
  switch (report.status) {
    case 'already_uploaded':
      return ['Same file as before. Nothing added.'];
    case 'failed':
      return [HELD_TEXT[report.reason] ?? HELD_TEXT.error];
    case 'needs_logger':
      return report.reason === 'unknown_logger'
        ? [
            `Logger ${report.loggerCode} isn't in ChillLog yet. Choose the logger, then its readings are added.`,
          ]
        : ['Waiting: choose the logger, then its readings are added.'];
    case 'rejected':
      return ['Not a CSV file from a logger. Nothing was uploaded.'];
    default:
      return [
        `${count(r.added, 'reading')} added`,
        r.alreadyStored && `${number.format(r.alreadyStored)} already in from an earlier file`,
        r.err && `${count(r.err, 'ERR reading')} (no temperature) kept as missing`,
        r.unreadable && `${count(r.unreadable, 'row')} couldn't be read and were skipped`,
        r.duplicatesInFile && `${count(r.duplicatesInFile, 'repeated row')} skipped`,
        r.beforePlacement &&
          `${count(r.beforePlacement, 'reading')} from before the logger was in a fridge, not used`,
        ...report.notes.map((note) => NOTE_TEXT[note]),
      ].filter(Boolean);
  }
}

/**
 * The line under the file name saying where it belongs: "TL-0388 · Rishon LeZion · Cream cakes".
 * @param {Map<number, { code: string, current: { branchName: string, fridgeName: string } | null }>} loggers
 */
export function fileWhere(report, loggers) {
  if (report.status === 'rejected') return null; // never read, so nothing to say about a logger
  if (!report.loggerCode) return 'No logger ID in the file';
  const current = loggers.get(report.loggerId)?.current;
  return current
    ? `${report.loggerCode} · ${current.branchName} · ${current.fridgeName}`
    : `${report.loggerCode} · not in a fridge`;
}

/**
 * The batch's counts, worked out the same way as the server's summary (upload-routes.js), so the
 * line stays right after a file is tried again or given its logger.
 */
export function summarize(reports) {
  const count = (...statuses) => reports.filter((r) => statuses.includes(r.status)).length;
  return {
    files: reports.length,
    readingsAdded: reports.reduce((sum, r) => sum + r.readings.added, 0),
    alreadyUploaded: count('already_uploaded'),
    needYourHelp: count('needs_logger', 'failed', 'rejected'),
  };
}

/** "6 files · 2,004 readings added · 2 need your help" */
export function summaryLine({ files, readingsAdded, needYourHelp }) {
  const help =
    needYourHelp === 0
      ? 'nothing needs your help'
      : `${number.format(needYourHelp)} ${needYourHelp === 1 ? 'needs' : 'need'} your help`;
  return `${count(files, 'file')} · ${count(readingsAdded, 'reading')} added · ${help}`;
}

/**
 * A quick check before sending, so a batch that's too big fails at once instead of after a slow
 * upload. The server checks the same limits (shared/uploads.js) and has the last word.
 * @param {Array<{ name: string, size: number }>} files
 * @returns {string | null} what's wrong, or null
 */
export function checkFiles(files) {
  if (files.length === 0) return 'Choose at least one file to upload.';
  if (files.length > UPLOAD_LIMITS.maxFiles) {
    return `Upload up to ${UPLOAD_LIMITS.maxFiles} files at a time. Nothing was uploaded.`;
  }
  const tooBig = files.find((f) => f.size > UPLOAD_LIMITS.maxFileBytes);
  if (tooBig) {
    const mb = UPLOAD_LIMITS.maxFileBytes / (1024 * 1024);
    return `${tooBig.name} is bigger than ${mb} MB. Nothing was uploaded.`;
  }
  return null;
}

/** Earlier uploads still waiting for Summer: a logger to choose, or a held-back file. */
export function waitingUploads(uploads) {
  return uploads.filter((u) => u.status === 'needs_logger' || u.status === 'failed');
}
