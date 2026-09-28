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

// Monday 21 Sep 2026, 09:12 in Israel: "this week" is Mon 14 – Sun 20 Sep, like the mockup.
const MONDAY_MORNING = new Date('2026-09-21T06:12:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** Israel wall-clock time as milliseconds, for building files only (no zone maths). */
const wall = (text) => Date.parse(`${text}:00Z`);
const pad = (n) => String(n).padStart(2, '0');

/** A logger file with a reading every 15 minutes in [from, to); valueAt returns null to skip one. */
function loggerFile(from, to, valueAt) {
  const lines = [];
  for (let t = wall(from); t < wall(to); t += 15 * 60_000) {
    const value = valueAt(t);
    if (value === null) continue;
    const d = new Date(t);
    const stamp = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    lines.push(`${stamp},${typeof value === 'number' ? value.toFixed(1) : value}`);
  }
  return Buffer.from(lines.join('\n'));
}

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

/** A fridge, with a logger placed in it since January unless `code` is null. */
function fridge(branchName, fridgeName, code) {
  const branch =
    db.prepare('SELECT id FROM branches WHERE name = ?').get(branchName) ??
    createBranch(db, branchName);
  const created = createFridge(db, { branchId: branch.id, name: fridgeName });
  if (code) {
    const logger = createLogger(db, { code });
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: created.id,
      fromUtc: '2026-01-01T00:00:00Z',
    });
  }
  return created;
}

const upload = (code, content) =>
  ingestFile(db, { rawDir, fileName: `${code}_2026-09-21.csv`, content });

const overview = (query = '', now = MONDAY_MORNING) =>
  request(createApp({ db, rawDir, now: () => now })).get(`/api/overview${query}`);

describe('GET /api/overview', () => {
  beforeEach(() => {
    fridge('Rishon LeZion', 'Cream cakes', 'TL-0388');
    fridge('Haifa', 'Dairy', 'TL-0231');
    fridge('Jerusalem', 'Dairy', 'TL-0512');
    fridge('Tel Aviv', 'Walk-in', 'TL-0417');
    fridge('Tel Aviv', 'Display 2', 'TL-0420');
    fridge('Eilat', 'Dairy', 'TL-0600');
    fridge('Eilat', 'Drinks', null);

    // Above 5°C for two readings on Thursday morning.
    upload(
      'TL-0388',
      loggerFile('2026-09-14T00:00', '2026-09-21T00:00', (t) =>
        t === wall('2026-09-17T06:15') ? 6.3 : t === wall('2026-09-17T06:30') ? 7.1 : 3.8,
      ),
    );
    // Flat 3.0°C, then warming 0.6°C a day from Friday: 4.8°C by Sunday night, still below 5.
    upload(
      'TL-0231',
      loggerFile('2026-09-14T00:00', '2026-09-21T00:00', (t) =>
        t < wall('2026-09-18T00:00') ? 3.0 : 3.0 + (0.6 * (t - wall('2026-09-18T00:00'))) / DAY,
      ),
    );
    // Nothing saved on Wednesday between 06:15 and 08:30.
    upload(
      'TL-0512',
      loggerFile('2026-09-14T00:00', '2026-09-21T00:00', (t) =>
        t >= wall('2026-09-16T06:30') && t <= wall('2026-09-16T08:15') ? null : 3.9,
      ),
    );
    // The file stops on Thursday at 17:45.
    upload(
      'TL-0417',
      loggerFile('2026-09-14T00:00', '2026-09-17T18:00', () => 4.0),
    );
    // One door opening on Friday.
    upload(
      'TL-0420',
      loggerFile('2026-09-14T00:00', '2026-09-21T00:00', (t) =>
        t === wall('2026-09-18T10:00') ? 9.4 : 3.9,
      ),
    );
    // Only last week's file came in.
    upload(
      'TL-0600',
      loggerFile('2026-09-07T00:00', '2026-09-14T00:00', () => 3.7),
    );
  });

  it('"see, in one place, how every fridge is doing and where something is wrong": every fridge, worst first', async () => {
    const res = await overview();
    expect(res.status).toBe(200);
    expect(res.body.week).toEqual({
      startUtc: '2026-09-13T21:00:00Z',
      endUtc: '2026-09-20T21:00:00Z',
      firstDay: '2026-09-14',
      lastDay: '2026-09-20',
    });
    expect(res.body.fridges.map((f) => [f.branchName, f.fridgeName, f.status])).toEqual([
      ['Rishon LeZion', 'Cream cakes', 'alert'],
      ['Haifa', 'Dairy', 'warming'],
      ['Jerusalem', 'Dairy', 'gap'],
      ['Tel Aviv', 'Walk-in', 'gap'],
      ['Eilat', 'Dairy', 'no_file'],
      ['Eilat', 'Drinks', 'no_file'],
      ['Tel Aviv', 'Display 2', 'ok'],
    ]);
    expect(res.body.counts).toEqual({ alert: 1, warming: 1, gap: 2, no_file: 2, ok: 1 });
    expect(typeof res.body.lastUploadUtc).toBe('string');
  });

  it('"when did this fridge go above five degrees, and for how long?": an alert carries the peak and the time above', async () => {
    const { body } = await overview();
    expect(body.fridges[0].alert).toEqual({ count: 1, peakC: 7.1, totalMinutes: 30 });
  });

  it('"A fridge that\'s slowly warming up is not fine": warming shows before it passes 5°C', async () => {
    const haifa = (await overview()).body.fridges.find((f) => f.branchName === 'Haifa');
    expect(haifa.latest).toEqual({ tsUtc: '2026-09-20T20:45:00Z', tempC: 4.8 });
    expect(haifa.warming.latestC).toBe(4.8);
    expect(haifa.warming.riseC).toBeGreaterThanOrEqual(0.5);
    expect(haifa.alert).toBeNull();
  });

  it('"Sometimes there\'s a gap of a couple of hours in a file": the gap is counted in the week', async () => {
    const jerusalem = (await overview()).body.fridges.find((f) => f.branchName === 'Jerusalem');
    expect(jerusalem.gap).toEqual({ count: 1, totalMinutes: 135 });
  });

  it('"I never know if the logger died, the battery ran out": a file that stops early is a gap to the end of the week', async () => {
    const walkIn = (await overview()).body.fridges.find((f) => f.fridgeName === 'Walk-in');
    // Thursday 17:45 to Monday 00:00: 3 days, 6 hours and 15 minutes.
    expect(walkIn.gap).toEqual({ count: 1, totalMinutes: 3 * 24 * 60 + 6 * 60 + 15 });
  });

  it('"someone opens the door for a delivery … which is fine": a door opening leaves the fridge OK', async () => {
    const display = (await overview()).body.fridges.find((f) => f.fridgeName === 'Display 2');
    expect(display).toMatchObject({
      status: 'ok',
      alert: null,
      latest: { tsUtc: '2026-09-20T20:45:00Z', tempC: 3.9 },
    });
  });

  it('marks a fridge with no file this week, and one that has never had a logger', async () => {
    const { body } = await overview();
    const eilat = body.fridges.filter((f) => f.branchName === 'Eilat');
    expect(eilat.map((f) => [f.fridgeName, f.status, f.noLogger])).toEqual([
      ['Dairy', 'no_file', false],
      ['Drinks', 'no_file', true],
    ]);
  });

  it('shows an earlier week when asked', async () => {
    const { body } = await overview('?week=2026-09-09');
    expect(body.week.firstDay).toBe('2026-09-07');
    expect(
      body.fridges.find((f) => f.fridgeName === 'Dairy' && f.branchName === 'Eilat'),
    ).toMatchObject({
      status: 'ok',
      latest: { tempC: 3.7 },
    });
  });

  it('in the current week, missing data only counts up to now', async () => {
    // Thursday 17 Sep, 18:20: the walk-in's last reading was 35 minutes ago, which is fine.
    const { body } = await overview('?week=2026-09-17', new Date('2026-09-17T15:20:00Z'));
    const walkIn = body.fridges.find((f) => f.fridgeName === 'Walk-in');
    expect(walkIn).toMatchObject({ status: 'ok', gap: null });
  });

  it('refuses a week that is not a real date', async () => {
    const res = await overview('?week=2026-02-31');
    expect(res.status).toBe(400);
  });
});

describe('a week of nothing but ERR', () => {
  it('is a gap for the whole week, not an OK fridge', async () => {
    fridge('Haifa', 'Dairy', 'TL-0231');
    upload(
      'TL-0231',
      loggerFile('2026-09-14T00:00', '2026-09-21T00:00', () => 'ERR'),
    );
    const [haifa] = (await overview()).body.fridges;
    expect(haifa).toMatchObject({
      status: 'gap',
      latest: null,
      gap: { totalMinutes: 7 * 24 * 60 },
    });
  });
});
