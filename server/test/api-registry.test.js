import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { ingestFile } from '../src/ingest/ingest.js';

let db;
let api;
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  api = request(createApp({ db }));
});
afterEach(() => {
  db.close();
});

/** Tel Aviv with its walk-in and the new display fridge, through the API. */
async function telAviv() {
  const { body: branch } = await api.post('/api/branches').send({ name: 'Tel Aviv' });
  const { body: walkIn } = await api
    .post('/api/fridges')
    .send({ branchId: branch.id, name: 'Walk-in' });
  const { body: display } = await api
    .post('/api/fridges')
    .send({ branchId: branch.id, name: 'Display 2' });
  return { branch, walkIn, display };
}

describe('branches and fridges', () => {
  it('lists branches with their fridges', async () => {
    const { branch, walkIn, display } = await telAviv();
    const res = await api.get('/api/branches');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: branch.id,
        name: 'Tel Aviv',
        fridges: [
          { id: display.id, name: 'Display 2' },
          { id: walkIn.id, name: 'Walk-in' },
        ],
      },
    ]);
  });

  it('says what is wrong with a form, field by field', async () => {
    const res = await api.post('/api/fridges').send({ branchId: 'x', name: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Some fields need fixing.');
    expect(res.body.issues.map((i) => i.path).sort()).toEqual(['branchId', 'name']);
  });

  it('refuses a duplicate branch with 409 and a readable message', async () => {
    await api.post('/api/branches').send({ name: 'Haifa' });
    const res = await api.post('/api/branches').send({ name: 'Haifa' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'A branch called "Haifa" already exists.',
      code: 'duplicate',
    });
  });

  it('answers 404 for a fridge in a branch that does not exist', async () => {
    const res = await api.post('/api/fridges').send({ branchId: 99, name: 'Dairy' });
    expect(res.status).toBe(404);
  });

  it('answers 400, not 500, for a body that is not JSON', async () => {
    const res = await api
      .post('/api/branches')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'The request body is not valid JSON.' });
  });
});

describe('loggers', () => {
  it('adds a logger already placed in a fridge, with the date in Israel time', async () => {
    const { walkIn } = await telAviv();
    const res = await api
      .post('/api/loggers')
      .send({ code: 'tl-0417', fridgeId: walkIn.id, from: '2026-01-01' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 'TL-0417',
      unit: 'C',
      dateFormat: 'DD/MM',
      current: {
        fridgeId: walkIn.id,
        fridgeName: 'Walk-in',
        branchName: 'Tel Aviv',
        fromUtc: '2025-12-31T22:00:00Z', // midnight 1 Jan in Israel (UTC+2 in winter)
      },
    });
  });

  it('needs both the fridge and the date to place a logger', async () => {
    const { walkIn } = await telAviv();
    const res = await api.post('/api/loggers').send({ code: 'TL-0417', fridgeId: walkIn.id });
    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual([
      { path: 'from', message: 'To place the logger, give both the fridge and the date.' },
    ]);
  });

  it('rejects a date that does not exist', async () => {
    const { walkIn } = await telAviv();
    const res = await api
      .post('/api/loggers')
      .send({ code: 'TL-0417', fridgeId: walkIn.id, from: '2026-02-31' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('2026-02-31 is not a real date.');
    expect((await api.get('/api/loggers')).body).toEqual([]); // nothing half-created
  });

  it('"The old logger in Haifa shows the numbers differently from all the others": its unit can be set to °F', async () => {
    const { body: logger } = await api.post('/api/loggers').send({ code: 'TL-0231' });
    const res = await api.patch(`/api/loggers/${logger.id}/settings`).send({ unit: 'F' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code: 'TL-0231', unit: 'F', dateFormat: 'DD/MM' });
  });

  it('refuses an empty settings change', async () => {
    const { body: logger } = await api.post('/api/loggers').send({ code: 'TL-0231' });
    const res = await api.patch(`/api/loggers/${logger.id}/settings`).send({});
    expect(res.status).toBe(400);
  });

  it('answers 404 for a logger that does not exist', async () => {
    expect((await api.get('/api/loggers/99')).status).toBe(404);
    expect((await api.get('/api/loggers/abc')).status).toBe(400);
  });
});

describe('moving a logger', () => {
  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": the move re-assigns its readings to the new fridge', async () => {
    const rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-raw-'));
    try {
      const { walkIn, display } = await telAviv();
      const { body: logger } = await api
        .post('/api/loggers')
        .send({ code: 'TL-0417', fridgeId: walkIn.id, from: '2026-01-01' });

      // The file comes in before Summer records the move, so the excursion lands in the walk-in.
      ingestFile(db, {
        rawDir,
        fileName: 'TL-0417_2026-09-21.csv',
        content: Buffer.from(
          '17/09/2026 10:15,4.0\n17/09/2026 10:30,5.8\n17/09/2026 10:45,5.9\n17/09/2026 11:00,4.1\n',
        ),
      });
      const excursionFridges = () =>
        db
          .prepare('SELECT fridge_id FROM excursions')
          .all()
          .map((r) => r.fridge_id);
      expect(excursionFridges()).toEqual([walkIn.id]);

      const res = await api
        .post(`/api/loggers/${logger.id}/moves`)
        .send({ fridgeId: display.id, from: '2026-09-17T10:00' });

      expect(res.status).toBe(201);
      expect(res.body.history.map((h) => [h.fridgeName, h.fromUtc])).toEqual([
        ['Display 2', '2026-09-17T07:00:00Z'],
        ['Walk-in', '2025-12-31T22:00:00Z'],
      ]);
      expect(excursionFridges()).toEqual([display.id]);
    } finally {
      fs.rmSync(rawDir, { recursive: true, force: true });
    }
  });

  it('refuses a move dated before the current placement', async () => {
    const { walkIn, display } = await telAviv();
    const { body: logger } = await api
      .post('/api/loggers')
      .send({ code: 'TL-0417', fridgeId: walkIn.id, from: '2026-09-01' });
    const res = await api
      .post(`/api/loggers/${logger.id}/moves`)
      .send({ fridgeId: display.id, from: '2026-08-01' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('invalid_move');
  });
});
