import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import {
  assignLogger,
  createBranch,
  createFridge,
  createLogger,
} from '../src/registry/registry.js';
import { ingestFile } from '../src/ingest/ingest.js';

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name));
const MONDAY_MORNING = new Date('2026-09-21T06:12:00Z');
// Two readings above 5°C on Thursday 17 Sep, 10:30–11:00 Israel time.
const SHORT_EXCURSION = Buffer.from(
  '17/09/2026 10:15,4.0\n17/09/2026 10:30,5.8\n17/09/2026 10:45,5.9\n17/09/2026 11:00,4.1\n',
);

let db;
let rawDir;
let fridges;
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-raw-'));
  fridges = {
    rishon: fridgeWithFile(
      'Rishon LeZion',
      'Cream cakes',
      'TL-0388',
      fixture('rishon-slow-warming.csv'),
    ),
    walkIn: fridgeWithFile('Tel Aviv', 'Walk-in', 'TL-0417', SHORT_EXCURSION),
    jerusalem: fridgeWithFile('Jerusalem', 'Dairy', 'TL-0512', fixture('gap-two-hours.csv')),
  };
});
afterEach(() => {
  db.close();
  fs.rmSync(rawDir, { recursive: true, force: true });
});

function fridgeWithFile(branchName, fridgeName, code, content) {
  const branch =
    db.prepare('SELECT id FROM branches WHERE name = ?').get(branchName) ??
    createBranch(db, branchName);
  const fridge = createFridge(db, { branchId: branch.id, name: fridgeName });
  const logger = createLogger(db, { code });
  assignLogger(db, { loggerId: logger.id, fridgeId: fridge.id, fromUtc: '2026-01-01T00:00:00Z' });
  ingestFile(db, { rawDir, fileName: `${code}.csv`, content });
  return { ...fridge, branchId: branch.id };
}

const api = (now = MONDAY_MORNING) => request(createApp({ db, rawDir, now: () => now }));

/** The CSV exactly as sent: raw bytes, so the byte-order mark is checked too. */
const download = (query) =>
  api()
    .get(`/api/inspector/export${query}`)
    .buffer(true)
    .parse((res, done) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });

describe('GET /api/inspector', () => {
  it('"The Ministry of Health inspector asks me \'when did this fridge go above five degrees, and for how long?\'": one fridge over a range', async () => {
    const res = await api().get(
      `/api/inspector?fridgeId=${fridges.rishon.id}&from=2026-09-01&to=2026-09-21`,
    );
    expect(res.status).toBe(200);
    expect(res.body.range).toEqual({
      fromUtc: '2026-08-31T21:00:00Z',
      toUtc: '2026-09-21T21:00:00Z',
    });
    expect(res.body.summary).toEqual({ count: 1, totalMinutes: 2040 });
    expect(res.body.excursions).toEqual([
      {
        fridgeId: fridges.rishon.id,
        branchName: 'Rishon LeZion',
        fridgeName: 'Cream cakes',
        startUtc: '2026-09-14T10:45:00Z',
        endUtc: '2026-09-15T20:45:00Z',
        durationMinutes: 2040,
        peakC: 6.1,
        endReason: 'data_ends',
      },
    ]);
  });

  it("lists every fridge's time above 5°C, oldest first", async () => {
    const { body } = await api().get('/api/inspector?from=2026-09-01&to=2026-09-21');
    expect(body.excursions.map((e) => [e.fridgeName, e.startUtc, e.durationMinutes])).toEqual([
      ['Cream cakes', '2026-09-14T10:45:00Z', 2040],
      ['Walk-in', '2026-09-17T07:30:00Z', 30],
    ]);
    expect(body.summary).toEqual({ count: 2, totalMinutes: 2070 });
  });

  it('narrows to one branch', async () => {
    const { body } = await api().get(
      `/api/inspector?branchId=${fridges.walkIn.branchId}&from=2026-09-01&to=2026-09-21`,
    );
    expect(body.excursions.map((e) => e.fridgeName)).toEqual(['Walk-in']);
  });

  it('"Sometimes there\'s a gap of a couple of hours in a file": lists gaps, and fridges with no data at all', async () => {
    // Monday 14 Sep, 09:40 Israel time.
    const { body } = await api(new Date('2026-09-14T06:40:00Z')).get(
      '/api/inspector?from=2026-09-14&to=2026-09-14',
    );
    expect(body.gaps).toEqual([
      {
        fridgeId: fridges.jerusalem.id,
        branchName: 'Jerusalem',
        fridgeName: 'Dairy',
        fromUtc: '2026-09-14T03:15:00Z',
        toUtc: '2026-09-14T05:30:00Z',
        minutes: 135,
      },
    ]);
    expect(body.fridgesWithoutData).toEqual([
      { fridgeId: fridges.walkIn.id, branchName: 'Tel Aviv', fridgeName: 'Walk-in' },
    ]);
  });

  it('covers the last 30 days when no dates are given', async () => {
    const { body } = await api().get('/api/inspector');
    expect(body.range).toEqual({ fromUtc: '2026-08-22T06:12:00Z', toUtc: '2026-09-21T06:12:00Z' });
  });

  it('checks the branch and fridge filters', async () => {
    const status = async (query) => (await api().get(`/api/inspector${query}`)).status;
    expect(await status('?branchId=99')).toBe(404);
    expect(await status('?fridgeId=99')).toBe(404);
    expect(await status(`?branchId=${fridges.walkIn.branchId}&fridgeId=${fridges.rishon.id}`)).toBe(
      400,
    );
  });
});

describe('GET /api/inspector/export', () => {
  it('downloads the list as a CSV that Excel opens with Israel times', async () => {
    const res = await download(`?fridgeId=${fridges.rishon.id}&from=2026-09-01&to=2026-09-21`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="chilllog-above-5C_2026-09-01_to_2026-09-21.csv"',
    );
    expect([...res.body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte-order mark
    expect(res.body.subarray(3).toString('utf8').split('\r\n')).toEqual([
      'Branch,Fridge,Started (Israel time),Ended (Israel time),Duration (minutes),Duration,Peak °C,How the end is known',
      'Rishon LeZion,Cream cakes,2026-09-14 13:45,2026-09-15 23:45,2040,1 day 10 h,6.1,Still above 5°C at the last reading',
      '',
    ]);
  });

  it('an export opened in Excel cannot run a formula hidden in a branch or fridge name', async () => {
    // Its own file content: a byte-identical file would be recognized as already uploaded.
    const file = Buffer.from('17/09/2026 10:30,5.8\n17/09/2026 10:45,6.2\n17/09/2026 11:00,4.1\n');
    fridgeWithFile('=HYPERLINK("http://evil.example","Click")', '+Dairy', 'TL-0666', file);
    const res = await download('?from=2026-09-01&to=2026-09-21');
    const rows = res.body.subarray(3).toString('utf8').split('\r\n');
    expect(rows).toContain(
      `"'=HYPERLINK(""http://evil.example"",""Click"")",'+Dairy,2026-09-17 10:30,2026-09-17 11:00,30,30 min,6.2,Back at or below 5°C`,
    );
  });
});
