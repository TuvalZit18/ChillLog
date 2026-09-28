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
import { weekFile } from './week-file.js';

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name));
const MONDAY_MORNING = new Date('2026-09-21T06:12:00Z');

let db;
let rawDir;
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-raw-'));
});
afterEach(() => {
  db.close();
  fs.rmSync(rawDir, { recursive: true, force: true });
});

/** A fridge with a logger in it since January, and that logger's file uploaded. */
function fridgeWithFile(branchName, fridgeName, code, fixtureName) {
  const branch = createBranch(db, branchName);
  const fridge = createFridge(db, { branchId: branch.id, name: fridgeName });
  const logger = createLogger(db, { code });
  assignLogger(db, { loggerId: logger.id, fridgeId: fridge.id, fromUtc: '2026-01-01T00:00:00Z' });
  if (fixtureName) {
    ingestFile(db, { rawDir, fileName: `${code}.csv`, content: fixture(fixtureName) });
  }
  return { branch, fridge, logger };
}

const get = (url, now = MONDAY_MORNING) =>
  request(createApp({ db, rawDir, now: () => now })).get(url);

function fridgeWithContent(code, content) {
  const { fridge } = fridgeWithFile('Rishon LeZion', 'Dairy', code);
  ingestFile(db, { rawDir, fileName: `${code}.csv`, content });
  return fridge;
}

describe('GET /api/fridges/:id', () => {
  it('"when did this fridge go above five degrees, and for how long?": the fridge page lists the time above 5°C', async () => {
    const { fridge } = fridgeWithFile(
      'Rishon LeZion',
      'Cream cakes',
      'TL-0388',
      'rishon-slow-warming.csv',
    );
    const res = await get(`/api/fridges/${fridge.id}?from=2026-09-11&to=2026-09-15`);

    expect(res.status).toBe(200);
    expect(res.body.range).toEqual({
      fromUtc: '2026-09-10T21:00:00Z', // midnight 11 Sep, Israel time
      toUtc: '2026-09-15T21:00:00Z', // "to 15 Sep" includes the whole of the 15th
    });
    expect(res.body.excursions).toEqual([
      {
        startUtc: '2026-09-14T10:45:00Z',
        endUtc: '2026-09-15T20:45:00Z',
        durationMinutes: 2040,
        peakC: 6.1,
        readings: 137,
        endReason: 'data_ends',
      },
    ]);
    expect(res.body.fridge).toMatchObject({ name: 'Cream cakes', branchName: 'Rishon LeZion' });
    expect(res.body.currentLogger).toMatchObject({ loggerCode: 'TL-0388', toUtc: null });
    expect(res.body.weekStatus.status).toBe('alert'); // 14–20 Sep, the week before "now"
  });

  it('downsamples five days to 30-minute buckets that keep the minimum and maximum', async () => {
    const { fridge } = fridgeWithFile(
      'Rishon LeZion',
      'Cream cakes',
      'TL-0388',
      'rishon-slow-warming.csv',
    );
    const { body } = await get(`/api/fridges/${fridge.id}?from=2026-09-11&to=2026-09-15`);

    expect(body.series.bucketMinutes).toBe(30);
    expect(body.series.points).toHaveLength(240);
    expect(body.series.points[0]).toEqual({ tsUtc: '2026-09-10T21:00:00Z', minC: 3.5, maxC: 3.5 });
    expect(Math.max(...body.series.points.map((p) => p.maxC))).toBe(6.1);
  });

  it('"Sometimes there\'s a gap of a couple of hours in a file": the chart breaks and the gap is listed', async () => {
    const { fridge } = fridgeWithFile('Jerusalem', 'Dairy', 'TL-0512', 'gap-two-hours.csv');
    // Monday 14 Sep, 09:40: ten minutes after the last reading, so the day isn't "missing" yet.
    const { body } = await get(
      `/api/fridges/${fridge.id}?from=2026-09-14&to=2026-09-14`,
      new Date('2026-09-14T06:40:00Z'),
    );

    expect(body.series.bucketMinutes).toBe(15);
    expect(body.gaps).toEqual([
      { fromUtc: '2026-09-14T03:15:00Z', toUtc: '2026-09-14T05:30:00Z', minutes: 135 },
    ]);
    expect(body.errCount).toBe(1);
    const at = (tsUtc) => body.series.points.find((p) => p.tsUtc === tsUtc);
    expect(at('2026-09-14T03:15:00Z')).toMatchObject({ maxC: 3.9 });
    expect(at('2026-09-14T04:00:00Z')).toMatchObject({ minC: null, maxC: null }); // the break
    expect(at('2026-09-14T05:30:00Z')).toMatchObject({ maxC: 4 });
  });

  it("\"Once a week each branch manager downloads the logger's file\": no gap after the last reading while this week's file isn't due yet", async () => {
    // Readings up to Sun 20 Sep, 23:45; "now" is Mon 21 Sep, 09:12, before this week's file exists.
    const fridge = fridgeWithContent('TL-0600', weekFile(20, 23));
    const { body } = await get(`/api/fridges/${fridge.id}`);

    expect(body.gaps).toEqual([]);
    expect(body.filesDueUntilUtc).toBe('2026-09-20T21:00:00Z'); // Mon 21 Sep, 00:00 Israel time
  });

  it('"I never know if the logger died": a file that stops early is still a gap, up to the end of its week', async () => {
    // The week's file stops on Thursday 17 Sep, 11:45.
    const fridge = fridgeWithContent('TL-0601', weekFile(17, 11));
    const { body } = await get(`/api/fridges/${fridge.id}`);

    expect(body.gaps).toEqual([
      { fromUtc: '2026-09-17T08:45:00Z', toUtc: '2026-09-20T21:00:00Z', minutes: 5055 },
    ]);
  });

  it('"someone opens the door for a delivery … which is fine": the door opening is shown, not counted', async () => {
    const { fridge } = fridgeWithFile(
      'Tel Aviv',
      'Walk-in',
      'TL-0417',
      'door-spike-single-reading.csv',
    );
    const { body } = await get(`/api/fridges/${fridge.id}?from=2026-09-14&to=2026-09-14`);
    expect(body.excursions).toEqual([]);
    expect(body.doorSpikes).toEqual([{ tsUtc: '2026-09-14T03:15:00Z', tempC: 9.4 }]);
  });

  it('keeps a single high reading visible when zoomed out to 30 days', async () => {
    const { fridge } = fridgeWithFile(
      'Tel Aviv',
      'Walk-in',
      'TL-0417',
      'door-spike-single-reading.csv',
    );
    const { body } = await get(`/api/fridges/${fridge.id}?from=2026-08-22&to=2026-09-20`);

    expect(body.series.bucketMinutes).toBe(180);
    expect(body.series.points).toHaveLength(240);
    // An average of that bucket would be 5.2°C; the maximum keeps the 9.4°C reading.
    expect(body.series.points.find((p) => p.tsUtc === '2026-09-14T03:00:00Z')).toEqual({
      tsUtc: '2026-09-14T03:00:00Z',
      minC: 4,
      maxC: 9.4,
    });
  });

  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": each fridge shows which logger was in it, and when', async () => {
    const { branch, fridge: walkIn, logger } = fridgeWithFile('Tel Aviv', 'Walk-in', 'TL-0417');
    const display = createFridge(db, { branchId: branch.id, name: 'Display 2' });
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: display.id,
      fromUtc: '2026-09-17T07:00:00Z',
    });

    const displayPage = (await get(`/api/fridges/${display.id}`)).body;
    expect(displayPage.placements).toEqual([
      { loggerId: logger.id, loggerCode: 'TL-0417', fromUtc: '2026-09-17T07:00:00Z', toUtc: null },
    ]);
    expect(displayPage.currentLogger.loggerCode).toBe('TL-0417');

    const walkInPage = (await get(`/api/fridges/${walkIn.id}`)).body;
    expect(walkInPage.placements).toEqual([
      {
        loggerId: logger.id,
        loggerCode: 'TL-0417',
        fromUtc: '2026-01-01T00:00:00Z',
        toUtc: '2026-09-17T07:00:00Z',
      },
    ]);
    expect(walkInPage.currentLogger).toBeNull();
  });

  it('shows the last 7 days up to now by default', async () => {
    const { fridge } = fridgeWithFile('Haifa', 'Dairy', 'TL-0231');
    const { body } = await get(`/api/fridges/${fridge.id}`);
    expect(body.range).toEqual({
      fromUtc: '2026-09-14T06:12:00Z',
      toUtc: '2026-09-21T06:12:00Z',
    });
    expect(body.series.bucketMinutes).toBe(60);
    expect(body.latest).toBeNull();
  });

  it('explains what is wrong with a range', async () => {
    const { fridge } = fridgeWithFile('Haifa', 'Dairy', 'TL-0231');
    const error = async (query) => (await get(`/api/fridges/${fridge.id}${query}`)).body.error;
    expect(await error('?from=2026-09-20&to=2026-09-14')).toBe(
      'The start of the range must be before its end.',
    );
    expect(await error('?from=2024-01-01&to=2026-09-14')).toBe('Pick a range of a year or less.');
    expect(await error('?from=2026-02-31')).toBe('2026-02-31 is not a real date.');
    expect((await get(`/api/fridges/${fridge.id}?from=yesterday`)).status).toBe(400);
  });

  it('answers 404 for a fridge that does not exist', async () => {
    expect((await get('/api/fridges/99')).status).toBe(404);
  });
});
