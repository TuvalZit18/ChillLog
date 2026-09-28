import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { generateDemo, loadDemo } from '../src/seed/demo.js';

// Monday 21 Sep 2026: the demo's last week is 14–20 Sep, the week of Summer's sample rows.
const NOW = new Date('2026-09-21T06:12:00Z');

describe('generateDemo', () => {
  it('makes the same files every time for the same week', () => {
    const a = generateDemo({ now: NOW });
    const b = generateDemo({ now: new Date('2026-09-23T15:00:00Z') }); // later the same week
    expect(b.weeks.map((w) => w.files.map((f) => [f.fileName, f.content.toString()]))).toEqual(
      a.weeks.map((w) => w.files.map((f) => [f.fileName, f.content.toString()])),
    );
  });

  it('covers the four full weeks before now', () => {
    const { weeks, branches, loggers } = generateDemo({ now: NOW });
    expect(weeks.map((w) => [w.firstDay, w.lastDay])).toEqual([
      ['2026-08-24', '2026-08-30'],
      ['2026-08-31', '2026-09-06'],
      ['2026-09-07', '2026-09-13'],
      ['2026-09-14', '2026-09-20'],
    ]);
    expect(branches).toHaveLength(12);
    expect(branches.flatMap((b) => b.fridges)).toHaveLength(30);
    expect(loggers).toHaveLength(30); // 29 fridges start with one; TL-0419 joins after the move
  });

  it('"The logger files themselves only have the time and the temperature": each file is time + temperature, in varying shapes', () => {
    const files = generateDemo({ now: NOW }).weeks[3].files;
    const firstLines = (name) =>
      files
        .find((f) => f.fileName === name)
        .content.toString()
        .split(/\r?\n/)
        .slice(0, 2);
    const [header, firstRow] = firstLines('TL-0417_2026-09-21.csv');
    expect(header).toBe('Time,Temperature');
    expect(firstRow).toMatch(/^14\/09\/2026 00:00,\d\.\d$/);
    expect(firstLines('TL-0388_2026-09-21.csv')[0]).toBe('Temperature (C);Timestamp');
    expect(firstLines('TL-0450_2026-09-21.csv')[0]).toBe('Timestamp\tTemp');
    expect(firstLines('haifa-dairy_2026-09-21.csv')).toEqual([
      'Logger ID: TL-0231',
      'Date/Time,Temp',
    ]);
    expect(firstLines('eilat-dairy_2026-09-21.csv')[0]).toBe('Logger ID: TL-0700');
  });
});

describe('the demo, loaded through the real pipeline', () => {
  let db;
  let rawDir;
  let lastWeekReports;
  let overview;
  const report = (fileName) => lastWeekReports.find((r) => r.fileName === fileName);
  const status = (branch, fridge) =>
    overview.fridges.find((f) => f.branchName === branch && f.fridgeName === fridge);

  beforeAll(async () => {
    db = openDatabase(':memory:');
    migrate(db);
    rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-seed-'));
    const plan = generateDemo({ now: NOW });
    lastWeekReports = loadDemo(db, { rawDir, plan, weeks: [0, 1, 2, 3] })[3];
    overview = (await request(createApp({ db, rawDir, now: () => NOW })).get('/api/overview')).body;
  });
  afterAll(() => {
    db.close();
    fs.rmSync(rawDir, { recursive: true, force: true });
  });

  it('shows every status on the overview, and only where intended', () => {
    expect(overview.counts).toEqual({ alert: 1, warming: 1, gap: 2, no_file: 3, ok: 23 });
    expect(
      overview.fridges
        .filter((f) => f.status !== 'ok')
        .map((f) => `${f.branchName}/${f.fridgeName}: ${f.status}`),
    ).toEqual([
      'Rishon LeZion/Cream cakes: alert',
      'Petah Tikva/Display 1: warming',
      'Ashdod/Dairy: gap',
      'Jerusalem/Dairy: gap',
      'Beersheba/Dairy: no_file',
      'Beersheba/Walk-in: no_file',
      'Netanya/Drinks: no_file',
    ]);
  });

  it('"nobody noticed it had been slowly dying for two days": Rishon\'s cream cakes fridge passes 5°C', () => {
    expect(status('Rishon LeZion', 'Cream cakes').alert.peakC).toBeGreaterThan(5);
  });

  it('"A fridge that\'s slowly warming up is not fine": Petah Tikva shows warming while still below 5°C', () => {
    const petahTikva = status('Petah Tikva', 'Display 1');
    expect(petahTikva.warming.riseC).toBeGreaterThanOrEqual(0.5);
    expect(petahTikva.latest.tempC).toBeLessThan(5);
  });

  it('"The old logger in Haifa shows the numbers differently": its °F file reads as normal °C, ERR counted', () => {
    expect(report('haifa-dairy_2026-09-21.csv')).toMatchObject({
      status: 'processed',
      loggerCode: 'TL-0231',
      readings: { err: 2 },
    });
    expect(status('Haifa', 'Dairy')).toMatchObject({ status: 'ok' });
    expect(status('Haifa', 'Dairy').latest.tempC).toBeLessThan(5);
  });

  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": both fridges are covered', () => {
    expect(status('Tel Aviv', 'Walk-in')).toMatchObject({ status: 'ok', gap: null });
    expect(status('Tel Aviv', 'Display 2')).toMatchObject({ status: 'ok', noLogger: false });
    expect(report('TL-0417_2026-09-21.csv').notes).toContain('out_of_order');
  });

  it('"someone opens the door for a delivery and you see a jump for one reading, which is fine": door openings never alert', () => {
    const doorSpikes = db.prepare('SELECT COUNT(*) AS n FROM door_spikes').get().n;
    expect(doorSpikes).toBeGreaterThan(30);
    expect(overview.counts.alert).toBe(1); // only Rishon
  });

  it('"Sometimes there\'s a gap of a couple of hours in a file": Jerusalem\'s gap and repeated row', () => {
    expect(status('Jerusalem', 'Dairy').gap).toEqual({ count: 1, totalMinutes: 135 });
    expect(report('TL-0512_2026-09-21.csv').readings.duplicatesInFile).toBe(1);
  });

  it('"the battery ran out": Ashdod\'s file stops on Thursday', () => {
    // Thursday 13:45 to Monday 00:00.
    expect(status('Ashdod', 'Dairy').gap).toEqual({
      count: 1,
      totalMinutes: 3 * 24 * 60 + 10 * 60 + 15,
    });
  });

  it('keeps a file with no logger ID for Summer to assign, and marks a branch with no file', () => {
    expect(report('export_2026-09-21.csv')).toMatchObject({
      status: 'needs_logger',
      reason: 'no_logger_id',
    });
    expect(lastWeekReports.some((r) => r.fileName.startsWith('TL-062'))).toBe(false); // Beersheba
  });
});
