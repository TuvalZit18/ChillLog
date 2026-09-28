import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { UPLOAD_LIMITS } from '@chilllog/shared';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import {
  assignLogger,
  createBranch,
  createFridge,
  createLogger,
} from '../src/registry/registry.js';

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name));

let db;
let rawDir;
let api;
let fridge;
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-raw-'));
  api = request(createApp({ db, rawDir }));
  const branch = createBranch(db, 'Tel Aviv');
  fridge = createFridge(db, { branchId: branch.id, name: 'Walk-in' });
});
afterEach(() => {
  db.close();
  fs.rmSync(rawDir, { recursive: true, force: true });
});

function placedLogger(code, settings = {}) {
  const logger = createLogger(db, { code, ...settings });
  assignLogger(db, { loggerId: logger.id, fridgeId: fridge.id, fromUtc: '2026-01-01T00:00:00Z' });
  return logger;
}

const rawFileCount = () => (fs.existsSync(rawDir) ? fs.readdirSync(rawDir).length : 0);

describe('POST /api/uploads', () => {
  it('"Once a week each branch manager downloads the logger\'s file and emails it to me": many files in one upload, one report each', async () => {
    placedLogger('TL-0417');
    placedLogger('TL-0231', { unit: 'F' });

    const res = await api
      .post('/api/uploads')
      .attach('files', fixture('tel-aviv-logger-moved.csv'), 'TL-0417_2026-09-21.csv')
      .attach('files', fixture('haifa-fahrenheit-ddmm.csv'), 'haifa.csv')
      .attach('files', fixture('err-values.csv'), 'mystery.csv');

    expect(res.status).toBe(200);
    expect(res.body.files.map((f) => [f.fileName, f.status])).toEqual([
      ['TL-0417_2026-09-21.csv', 'processed'],
      ['haifa.csv', 'processed'],
      ['mystery.csv', 'needs_logger'],
    ]);
    expect(res.body.summary).toEqual({
      files: 3,
      readingsAdded: 9,
      alreadyUploaded: 0,
      needYourHelp: 1,
    });
  });

  it('refuses a file that is not a CSV and still takes the rest of the batch', async () => {
    placedLogger('TL-0417');
    const res = await api
      .post('/api/uploads')
      .attach('files', Buffer.from('%PDF-1.7'), 'week 38.pdf')
      .attach('files', fixture('tel-aviv-logger-moved.csv'), 'TL-0417.csv');

    expect(res.body.files).toMatchObject([
      { fileName: 'week 38.pdf', status: 'rejected', reason: 'not_csv', uploadId: null },
      { fileName: 'TL-0417.csv', status: 'processed' },
    ]);
    expect(rawFileCount()).toBe(1); // the PDF was never stored
  });

  it('says so when the same file is uploaded again', async () => {
    placedLogger('TL-0417');
    const send = () =>
      api.post('/api/uploads').attach('files', fixture('tel-aviv-logger-moved.csv'), 'TL-0417.csv');
    await send();
    const res = await send();
    expect(res.body.files[0].status).toBe('already_uploaded');
    expect(res.body.summary).toMatchObject({ readingsAdded: 0, alreadyUploaded: 1 });
  });

  it('keeps a Hebrew file name as it was sent', async () => {
    const res = await api
      .post('/api/uploads')
      .attach('files', fixture('err-values.csv'), 'מקרר חלב.csv');
    expect(res.body.files[0].fileName).toBe('מקרר חלב.csv');
  });

  it('refuses a file over the size limit and stores nothing', async () => {
    const tooBig = Buffer.alloc(UPLOAD_LIMITS.maxFileBytes + 1, 'a');
    const res = await api.post('/api/uploads').attach('files', tooBig, 'huge.csv');
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Each file must be 5 MB or smaller. Nothing was uploaded.');
    expect(rawFileCount()).toBe(0);
  });

  it('refuses more files than the limit in one upload', async () => {
    let req = api.post('/api/uploads');
    for (let i = 0; i <= UPLOAD_LIMITS.maxFiles; i++) {
      req = req.attach('files', Buffer.from(`${i}`), `f${i}.csv`);
    }
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Upload up to 50 files at a time. Nothing was uploaded.');
  });

  it('asks for at least one file', async () => {
    const res = await api.post('/api/uploads');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Choose at least one file to upload.');
  });
});

describe('files that need Summer', () => {
  it('shows the first rows as written in the file, then processes it once she picks the logger', async () => {
    const { body } = await api
      .post('/api/uploads')
      .attach('files', fixture('haifa-fahrenheit-ddmm.csv'), 'export.csv');
    // The file names TL-0231 inside, but no such logger is registered yet.
    const [waiting] = body.files;
    expect(waiting).toMatchObject({ status: 'needs_logger', loggerCode: 'TL-0231' });

    const preview = await api.get(`/api/uploads/${waiting.uploadId}/preview`);
    expect(preview.body).toEqual({
      uploadId: waiting.uploadId,
      fileName: 'export.csv',
      rows: [
        { time: '14/09/2026 06:00', temp: '38.1' },
        { time: '14/09/2026 06:15', temp: '38.3' },
        { time: '14/09/2026 06:30', temp: 'ERR' },
      ],
    });

    const other = placedLogger('TL-0500', { unit: 'F' });
    const res = await api
      .post(`/api/uploads/${waiting.uploadId}/assign`)
      .send({ loggerId: other.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'processed', loggerCode: 'TL-0500' });
  });

  it('processes a waiting file as soon as its logger is added', async () => {
    const { body } = await api
      .post('/api/uploads')
      .attach('files', fixture('tel-aviv-logger-moved.csv'), 'TL-0999_2026-09-21.csv');
    expect(body.files[0].status).toBe('needs_logger');

    const res = await api
      .post('/api/loggers')
      .send({ code: 'TL-0999', fridgeId: fridge.id, from: '2026-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.retried).toMatchObject([
      { fileName: 'TL-0999_2026-09-21.csv', status: 'processed', readings: { added: 4 } },
    ]);
  });

  it('"The old logger in Haifa shows the numbers differently": a held-back °F file goes in once the unit is fixed', async () => {
    const haifa = placedLogger('TL-0231');
    const { body } = await api
      .post('/api/uploads')
      .attach('files', fixture('haifa-fahrenheit-ddmm.csv'), 'haifa.csv');
    expect(body.files[0]).toMatchObject({ status: 'failed', reason: 'looks_fahrenheit' });

    const res = await api.patch(`/api/loggers/${haifa.id}/settings`).send({ unit: 'F' });
    expect(res.body.retried).toMatchObject([{ status: 'processed', readings: { added: 5 } }]);
  });

  it('refuses to process a file twice', async () => {
    placedLogger('TL-0417');
    const { body } = await api
      .post('/api/uploads')
      .attach('files', fixture('tel-aviv-logger-moved.csv'), 'TL-0417.csv');
    const res = await api.post(`/api/uploads/${body.files[0].uploadId}/retry`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('already_processed');
  });

  it('answers 404 for an upload that does not exist', async () => {
    expect((await api.get('/api/uploads/99/preview')).status).toBe(404);
  });
});

describe('GET /api/uploads', () => {
  it('lists uploads newest first, with when the last one came in', async () => {
    placedLogger('TL-0417');
    await api.post('/api/uploads').attach('files', fixture('err-values.csv'), 'first.csv');
    await api
      .post('/api/uploads')
      .attach('files', fixture('tel-aviv-logger-moved.csv'), 'TL-0417.csv');

    const res = await api.get('/api/uploads');
    expect(res.body.uploads.map((u) => [u.fileName, u.status])).toEqual([
      ['TL-0417.csv', 'processed'],
      ['first.csv', 'needs_logger'],
    ]);
    expect(res.body.lastUploadUtc).toBe(res.body.uploads[0].uploadedAt);
  });
});
