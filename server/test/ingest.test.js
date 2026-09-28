import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import {
  createBranch,
  createFridge,
  createLogger,
  assignLogger,
  updateLoggerSettings,
  fridgeAt,
} from '../src/registry/registry.js';
import {
  IngestError,
  ingestFile,
  ingestFiles,
  assignUploadLogger,
  retryUpload,
  rebuildReadings,
  rawPath,
} from '../src/ingest/ingest.js';
import { findLoggerCode } from '../src/ingest/identify.js';

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name));
const csv = (text) => Buffer.from(text);

let db;
let rawDir;
let fridges;
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-raw-'));
  const telAviv = createBranch(db, 'Tel Aviv');
  fridges = {
    walkIn: createFridge(db, { branchId: telAviv.id, name: 'Walk-in' }),
    display: createFridge(db, { branchId: telAviv.id, name: 'Display 2' }),
  };
});
afterEach(() => {
  db.close();
  fs.rmSync(rawDir, { recursive: true, force: true });
});

/** A logger that has been in the walk-in since January. */
function placedLogger(code, settings = {}) {
  const logger = createLogger(db, { code, ...settings });
  assignLogger(db, {
    loggerId: logger.id,
    fridgeId: fridges.walkIn.id,
    fromUtc: '2026-01-01T00:00:00Z',
  });
  return logger;
}

const readingCount = () => db.prepare('SELECT COUNT(*) AS n FROM readings').get().n;

describe('findLoggerCode', () => {
  it('reads the logger ID from the file name', () => {
    expect(findLoggerCode('TL-0417_2026-09-21.csv', '17/09/2026 09:30,3.6')).toBe('TL-0417');
    expect(findLoggerCode('export tl-0388 week 38.csv', '')).toBe('TL-0388');
  });

  it('prefers a logger line inside the file over the file name', () => {
    expect(findLoggerCode('TL-0417.csv', 'Logger ID: TL-0231\nTime,Temp\n')).toBe('TL-0231');
    expect(findLoggerCode('export.csv', 'Serial number = TL-0500\n')).toBe('TL-0500');
  });

  it('finds nothing in a file with no logger ID', () => {
    expect(findLoggerCode('export_2026-09-21.csv', 'Time,Temp\n21/09/2026 06:00,3.9')).toBeNull();
  });
});

describe('ingestFile', () => {
  it('keeps the raw file unchanged, named by its content hash', () => {
    placedLogger('TL-0417');
    const content = fixture('tel-aviv-logger-moved.csv');
    ingestFile(db, { rawDir, fileName: 'TL-0417_2026-09-21.csv', content });

    const { sha256 } = db.prepare('SELECT sha256 FROM uploads').get();
    expect(fs.readFileSync(path.join(rawDir, `${sha256}.csv`))).toEqual(content);
  });

  it('"I type in the logger number, the branch and the fridge myself when I paste": the logger comes from the file name, no typing', () => {
    const logger = placedLogger('TL-0417');
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0417_2026-09-21.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });

    expect(report).toMatchObject({
      status: 'processed',
      reason: null,
      loggerId: logger.id,
      loggerCode: 'TL-0417',
      readings: { added: 4, alreadyStored: 0, beforePlacement: 0 },
      range: { fromUtc: '2026-09-17T06:30:00Z', toUtc: '2026-09-17T07:15:00Z' },
    });
    expect(readingCount()).toBe(4);
  });

  it('"The old logger in Haifa shows the numbers differently from all the others": the file is read with its logger\'s °F setting', () => {
    placedLogger('TL-0231', { unit: 'F' });
    const report = ingestFile(db, {
      rawDir,
      fileName: 'haifa-export.csv',
      content: fixture('haifa-fahrenheit-ddmm.csv'),
    });

    expect(report).toMatchObject({
      status: 'processed',
      loggerCode: 'TL-0231',
      readings: { added: 5, err: 1 },
    });
    const temps = db.prepare('SELECT temp_c FROM readings ORDER BY ts_utc').all();
    expect(temps.map((r) => r.temp_c)).toEqual([3.39, 3.5, null, 3.78, 3.89]);
  });

  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": one file, readings on both sides of the move', () => {
    const logger = placedLogger('TL-0417');
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: fridges.display.id,
      fromUtc: '2026-09-17T07:00:00Z',
    });
    ingestFile(db, {
      rawDir,
      fileName: 'TL-0417_2026-09-21.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });

    const byFridge = db
      .prepare('SELECT ts_utc FROM readings ORDER BY ts_utc')
      .all()
      .map((r) => fridgeAt(db, logger.id, r.ts_utc));
    const { walkIn, display } = fridges;
    expect(byFridge).toEqual([walkIn.id, walkIn.id, display.id, display.id]);
  });

  it('uploading the same file again changes nothing', () => {
    placedLogger('TL-0417');
    const file = {
      rawDir,
      fileName: 'TL-0417_2026-09-21.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    };
    const first = ingestFile(db, file);
    const again = ingestFile(db, { ...file, fileName: 'TL-0417 (1).csv' });

    expect(again).toMatchObject({
      status: 'already_uploaded',
      uploadId: first.uploadId,
      fileName: 'TL-0417 (1).csv',
    });
    expect(readingCount()).toBe(4);
    expect(db.prepare('SELECT COUNT(*) AS n FROM uploads').get().n).toBe(1);
  });

  it('overlapping files from one logger store each reading once', () => {
    placedLogger('TL-0417');
    ingestFile(db, {
      rawDir,
      fileName: 'TL-0417_a.csv',
      content: csv('17/09/2026 09:30,3.6\n17/09/2026 09:45,3.7\n'),
    });
    const second = ingestFile(db, {
      rawDir,
      fileName: 'TL-0417_b.csv',
      content: csv('17/09/2026 09:45,3.7\n17/09/2026 10:00,3.8\n'),
    });

    expect(second.readings).toMatchObject({ added: 1, alreadyStored: 1 });
    expect(readingCount()).toBe(3);
  });

  it('counts readings from before the logger was placed in any fridge', () => {
    const logger = createLogger(db, { code: 'TL-0417' });
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: fridges.walkIn.id,
      fromUtc: '2026-09-17T06:45:00Z',
    });
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0417.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });
    expect(report.readings).toMatchObject({ added: 4, beforePlacement: 1 });
  });

  it("notes when the file's dates are in a different order from the logger's setting", () => {
    placedLogger('TL-0417');
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0417.csv',
      content: csv('09/17/2026 09:30,3.6\n09/17/2026 09:45,3.7\n'),
    });
    expect(report.status).toBe('processed');
    expect(report.notes).toContain('date_format_differs');
  });
});

describe('files that need Summer', () => {
  it('keeps a file from an unregistered logger and processes it once she picks the logger', () => {
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0999_2026-09-21.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });
    expect(report).toMatchObject({
      status: 'needs_logger',
      reason: 'unknown_logger',
      loggerCode: 'TL-0999',
    });
    expect(readingCount()).toBe(0);

    const logger = placedLogger('TL-0999');
    const done = assignUploadLogger(db, { rawDir, uploadId: report.uploadId, loggerId: logger.id });
    expect(done).toMatchObject({
      status: 'processed',
      loggerId: logger.id,
      readings: { added: 4 },
    });
    expect(readingCount()).toBe(4);
  });

  it('processes a waiting file on retry once its logger has been registered', () => {
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0999_2026-09-21.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });
    expect(retryUpload(db, { rawDir, uploadId: report.uploadId })).toMatchObject({
      status: 'needs_logger',
      reason: 'unknown_logger',
      loggerCode: 'TL-0999',
    });

    placedLogger('TL-0999');
    expect(retryUpload(db, { rawDir, uploadId: report.uploadId })).toMatchObject({
      status: 'processed',
      readings: { added: 4 },
    });
  });

  it('asks for the logger when the file has no logger ID at all', () => {
    const report = ingestFile(db, {
      rawDir,
      fileName: 'export.csv',
      content: fixture('err-values.csv'),
    });
    expect(report).toMatchObject({
      status: 'needs_logger',
      reason: 'no_logger_id',
      loggerCode: null,
    });
  });

  it('holds back a °F file on a °C logger, and processes it after the setting is fixed', () => {
    const logger = placedLogger('TL-0231');
    const report = ingestFile(db, {
      rawDir,
      fileName: 'haifa.csv',
      content: fixture('haifa-fahrenheit-ddmm.csv'),
    });
    expect(report).toMatchObject({ status: 'failed', reason: 'looks_fahrenheit' });
    expect(readingCount()).toBe(0);

    updateLoggerSettings(db, logger.id, { unit: 'F' });
    const done = retryUpload(db, { rawDir, uploadId: report.uploadId });
    expect(done).toMatchObject({ status: 'processed', readings: { added: 5 } });
  });

  it('holds back a file with no readable readings', () => {
    placedLogger('TL-0417');
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0417.csv',
      content: csv('Name,Notes\nfridge,cold\n'),
    });
    expect(report).toMatchObject({ status: 'failed', reason: 'no_readings' });
  });

  it('refuses to re-process a file that is already in', () => {
    const logger = placedLogger('TL-0417');
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0417.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });
    expect(() =>
      assignUploadLogger(db, { rawDir, uploadId: report.uploadId, loggerId: logger.id }),
    ).toThrow(expect.objectContaining({ name: 'IngestError', code: 'already_processed' }));
    expect(() => retryUpload(db, { rawDir, uploadId: 999 })).toThrow(IngestError);
  });
});

describe('ingestFiles (bulk upload)', () => {
  it('reports each file on its own, and catches the same file twice in one batch', () => {
    placedLogger('TL-0417');
    const content = fixture('tel-aviv-logger-moved.csv');
    const reports = ingestFiles(db, {
      rawDir,
      files: [
        { fileName: 'TL-0417.csv', content },
        { fileName: 'mystery.csv', content: fixture('err-values.csv') },
        { fileName: 'TL-0417 copy.csv', content },
      ],
    });
    expect(reports.map((r) => r.status)).toEqual(['processed', 'needs_logger', 'already_uploaded']);
    expect(readingCount()).toBe(4);
  });
});

describe('rebuildReadings', () => {
  const allReadings = () =>
    db
      .prepare('SELECT logger_id, ts_utc, temp_c, is_err, upload_id FROM readings ORDER BY ts_utc')
      .all();

  it('derives exactly the same readings again from the raw files', () => {
    placedLogger('TL-0417');
    placedLogger('TL-0231', { unit: 'F' });
    ingestFile(db, {
      rawDir,
      fileName: 'TL-0417_a.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });
    ingestFile(db, {
      rawDir,
      fileName: 'TL-0417_b.csv',
      content: csv('17/09/2026 10:15,4.1\n17/09/2026 10:30,4.0\n'),
    });
    ingestFile(db, {
      rawDir,
      fileName: 'haifa.csv',
      content: fixture('haifa-fahrenheit-ddmm.csv'),
    });
    const before = allReadings();

    const reports = rebuildReadings(db, { rawDir });
    expect(reports.map((r) => r.status)).toEqual(['processed', 'processed', 'processed']);
    expect(allReadings()).toEqual(before);
  });

  it('uses the logger settings as they are now', () => {
    const logger = placedLogger('TL-0231');
    ingestFile(db, {
      rawDir,
      fileName: 'haifa.csv',
      content: fixture('haifa-fahrenheit-ddmm.csv'),
    });
    expect(readingCount()).toBe(0); // held back: looked like °F on a °C logger

    updateLoggerSettings(db, logger.id, { unit: 'F' });
    const [report] = rebuildReadings(db, { rawDir });
    expect(report).toMatchObject({ status: 'processed', readings: { added: 5 } });
  });

  it('picks up a waiting file whose logger has been registered since', () => {
    ingestFile(db, {
      rawDir,
      fileName: 'TL-0999.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });
    placedLogger('TL-0999');
    const [report] = rebuildReadings(db, { rawDir });
    expect(report).toMatchObject({ status: 'processed', loggerCode: 'TL-0999' });
    expect(readingCount()).toBe(4);
  });

  it('refuses to start when a raw file is missing, and leaves the readings as they were', () => {
    placedLogger('TL-0417');
    const report = ingestFile(db, {
      rawDir,
      fileName: 'TL-0417.csv',
      content: fixture('tel-aviv-logger-moved.csv'),
    });
    const { sha256 } = db.prepare('SELECT sha256 FROM uploads WHERE id = ?').get(report.uploadId);
    fs.rmSync(rawPath(rawDir, sha256));

    expect(() => rebuildReadings(db, { rawDir })).toThrow(
      expect.objectContaining({ code: 'raw_missing' }),
    );
    expect(readingCount()).toBe(4);
  });
});
