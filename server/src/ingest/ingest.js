// Ingest: raw logger files in, readings out. Single and bulk upload are one pipeline.
// Idempotent by construction: a file seen before is recognized by its hash, and a reading
// seen before is ignored by the (logger_id, ts_utc) key, so any retry or re-upload is safe.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { transaction } from '../db/transaction.js';
import { normalizeFile } from '../normalize/normalize.js';
import { findLoggerByCode, getLogger, loggerHistory } from '../registry/registry.js';
import { findLoggerCode } from './identify.js';

/** @typedef {import('node:sqlite').DatabaseSync} Db */

/**
 * What happened to one file, shown to Summer after an upload and kept in uploads.report_json.
 * @typedef {object} FileReport
 * @property {number | null} uploadId
 * @property {string} fileName
 * @property {'processed' | 'needs_logger' | 'failed' | 'already_uploaded'} status
 *   failed = held back: stored, but nothing was added until the reason is fixed.
 * @property {null | 'unknown_logger' | 'no_logger_id' | 'no_readings' | 'looks_fahrenheit'
 *   | 'looks_celsius' | 'error'} reason
 * @property {number | null} loggerId
 * @property {string | null} loggerCode the file's logger, or the unregistered ID found in it
 * @property {{ added: number, alreadyStored: number, err: number, unreadable: number,
 *   duplicatesInFile: number, beforePlacement: number }} readings
 * @property {{ fromUtc: string, toUtc: string } | null} range first and last reading in the file
 * @property {('out_of_order' | 'date_format_differs')[]} notes
 */

export class IngestError extends Error {
  /**
   * @param {'not_found' | 'already_processed'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
  }
}

export function rawPath(rawDir, sha256) {
  return path.join(rawDir, `${sha256}.csv`);
}

/**
 * Stores one uploaded file and, when its logger is known, adds its readings.
 * @param {Db} db
 * @param {{ rawDir: string, fileName: string, content: Buffer }} file
 * @returns {FileReport}
 */
export function ingestFile(db, { rawDir, fileName, content }) {
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const seen = db.prepare('SELECT id, report_json FROM uploads WHERE sha256 = ?').get(sha256);
  if (seen) {
    return {
      ...JSON.parse(seen.report_json),
      uploadId: seen.id,
      fileName,
      status: 'already_uploaded',
    };
  }

  // Kept byte for byte before anything is derived from it. A file left behind by a failed
  // insert below has the same name next time, so it is simply reused.
  fs.mkdirSync(rawDir, { recursive: true });
  const file = rawPath(rawDir, sha256);
  if (!fs.existsSync(file)) fs.writeFileSync(file, content);

  const text = decode(content);
  const code = findLoggerCode(fileName, text);
  const logger = code ? findLoggerByCode(db, code) : null;

  return transaction(db, () => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO uploads (sha256, original_name, uploaded_at, status)
         VALUES (?, ?, ?, 'needs_logger')`,
      )
      .run(sha256, fileName, nowUtc());
    const upload = { id: Number(lastInsertRowid), fileName };
    return save(db, logger ? addReadings(db, upload, logger, text) : needsLogger(upload, code));
  });
}

/**
 * A bulk upload: each file on its own, in its own transaction, so one bad file doesn't stop
 * the rest. The same file twice in one batch is caught by its hash like any re-upload.
 * @param {Db} db
 * @param {{ rawDir: string, files: { fileName: string, content: Buffer }[] }} batch
 * @returns {FileReport[]}
 */
export function ingestFiles(db, { rawDir, files }) {
  return files.map(({ fileName, content }) => {
    try {
      return ingestFile(db, { rawDir, fileName, content });
    } catch (err) {
      console.error(`Ingest of ${fileName} failed:`, err);
      return { ...blankReport({ id: null, fileName }), status: 'failed', reason: 'error' };
    }
  });
}

/**
 * Summer picked the logger for a file that needed one: process the stored copy, no re-upload.
 * @returns {FileReport}
 */
export function assignUploadLogger(db, { rawDir, uploadId, loggerId }) {
  return reprocess(db, rawDir, uploadId, loggerId);
}

/**
 * Tries a held-back file again, e.g. after its logger's unit or date setting was fixed.
 * @returns {FileReport}
 */
export function retryUpload(db, { rawDir, uploadId }) {
  return reprocess(db, rawDir, uploadId, null);
}

function reprocess(db, rawDir, uploadId, loggerId) {
  const row = db
    .prepare('SELECT id, sha256, original_name, logger_id, status FROM uploads WHERE id = ?')
    .get(uploadId);
  if (!row) throw new IngestError('not_found', `Upload ${uploadId} does not exist.`);
  if (row.status === 'processed') {
    throw new IngestError('already_processed', `${row.original_name} is already in.`);
  }
  const upload = { id: row.id, fileName: row.original_name };
  const text = decode(fs.readFileSync(rawPath(rawDir, row.sha256)));
  const code = findLoggerCode(upload.fileName, text);

  let logger;
  if (loggerId !== null) {
    logger = getLogger(db, loggerId);
    if (!logger) throw new IngestError('not_found', `Logger ${loggerId} does not exist.`);
  } else if (row.logger_id !== null) {
    logger = getLogger(db, row.logger_id);
  } else {
    // The logger may have been registered since the file came in.
    logger = code ? findLoggerByCode(db, code) : null;
  }
  return transaction(db, () =>
    save(db, logger ? addReadings(db, upload, logger, text) : needsLogger(upload, code)),
  );
}

/** Normalizes the file with its logger's settings and inserts the readings. */
function addReadings(db, upload, logger, text) {
  const file = normalizeFile(text, { unit: logger.unit, dateFormat: logger.dateFormat });
  const report = blankReport(upload);
  report.loggerId = logger.id;
  report.loggerCode = logger.code;
  report.readings.err = file.counts.err;
  report.readings.unreadable = file.counts.unreadable;
  report.readings.duplicatesInFile = file.counts.duplicates;
  if (file.readings.length > 0) {
    report.range = { fromUtc: file.readings[0].tsUtc, toUtc: file.readings.at(-1).tsUtc };
  }
  if (file.outOfOrder) report.notes.push('out_of_order');
  if (file.dateFormat.detected && file.dateFormat.detected !== logger.dateFormat) {
    report.notes.push('date_format_differs');
  }

  if (file.readings.length === 0) return { ...report, status: 'failed', reason: 'no_readings' };
  // Held back rather than stored: °F values read as °C would fill the fridge with false alerts.
  if (file.unitWarning) return { ...report, status: 'failed', reason: file.unitWarning };

  const firstPlaced = loggerHistory(db, logger.id).at(-1)?.fromUtc;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO readings (logger_id, ts_utc, temp_c, is_err, upload_id)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const reading of file.readings) {
    const { changes } = insert.run(
      logger.id,
      reading.tsUtc,
      reading.tempC,
      reading.isErr ? 1 : 0,
      upload.id,
    );
    if (changes > 0) report.readings.added++;
    else report.readings.alreadyStored++;
    if (!firstPlaced || reading.tsUtc < firstPlaced) report.readings.beforePlacement++;
  }
  return { ...report, status: 'processed' };
}

function needsLogger(upload, code) {
  return {
    ...blankReport(upload),
    status: 'needs_logger',
    reason: code ? 'unknown_logger' : 'no_logger_id',
    loggerCode: code,
  };
}

/** @returns {FileReport} */
function blankReport({ id, fileName }) {
  return {
    uploadId: id,
    fileName,
    status: 'failed',
    reason: null,
    loggerId: null,
    loggerCode: null,
    readings: {
      added: 0,
      alreadyStored: 0,
      err: 0,
      unreadable: 0,
      duplicatesInFile: 0,
      beforePlacement: 0,
    },
    range: null,
    notes: [],
  };
}

/** Records the outcome on the upload row and returns the report. */
function save(db, report) {
  db.prepare('UPDATE uploads SET status = ?, logger_id = ?, report_json = ? WHERE id = ?').run(
    report.status,
    report.loggerId,
    JSON.stringify(report),
    report.uploadId,
  );
  return report;
}

function decode(content) {
  return new TextDecoder('utf-8').decode(content);
}

function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
