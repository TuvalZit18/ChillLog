import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import {
  RegistryError,
  createBranch,
  listBranches,
  createFridge,
  listFridges,
  createLogger,
  getLogger,
  findLoggerByCode,
  listLoggers,
  updateLoggerSettings,
  assignLogger,
  loggerHistory,
  fridgeAt,
} from '../src/registry/registry.js';

let db;
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
});
afterEach(() => {
  db.close();
});

/** Tel Aviv with a walk-in and the new display fridge. */
function telAviv() {
  const branch = createBranch(db, 'Tel Aviv');
  const walkIn = createFridge(db, { branchId: branch.id, name: 'Walk-in' });
  const display = createFridge(db, { branchId: branch.id, name: 'Display 2' });
  return { branch, walkIn, display };
}

describe('branches and fridges', () => {
  it('creates and lists branches by name', () => {
    createBranch(db, 'Tel Aviv');
    createBranch(db, 'Haifa');
    expect(listBranches(db).map((b) => b.name)).toEqual(['Haifa', 'Tel Aviv']);
  });

  it('refuses a second branch with the same name', () => {
    createBranch(db, 'Haifa');
    expect(() => createBranch(db, 'Haifa')).toThrow(
      expect.objectContaining({ name: 'RegistryError', code: 'duplicate' }),
    );
  });

  it('lists fridges with their branch', () => {
    const { branch } = telAviv();
    expect(listFridges(db)).toEqual([
      expect.objectContaining({ branchId: branch.id, branchName: 'Tel Aviv', name: 'Display 2' }),
      expect.objectContaining({ branchId: branch.id, branchName: 'Tel Aviv', name: 'Walk-in' }),
    ]);
  });

  it('refuses a fridge in a branch that does not exist', () => {
    expect(() => createFridge(db, { branchId: 99, name: 'Dairy' })).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    );
  });

  it('allows the same fridge name in different branches', () => {
    const a = createBranch(db, 'Haifa');
    const b = createBranch(db, 'Rishon LeZion');
    createFridge(db, { branchId: a.id, name: 'Dairy' });
    expect(() => createFridge(db, { branchId: b.id, name: 'Dairy' })).not.toThrow();
  });
});

describe('loggers', () => {
  it('defaults a new logger to °C and day/month dates', () => {
    const logger = createLogger(db, { code: 'TL-0388' });
    expect(logger).toEqual({ id: logger.id, code: 'TL-0388', unit: 'C', dateFormat: 'DD/MM' });
  });

  it('"I type in the logger number, the branch and the fridge myself": finds a logger by the ID written in its file', () => {
    const logger = createLogger(db, { code: 'TL-0417' });
    expect(findLoggerByCode(db, 'TL-0417')).toEqual(logger);
    expect(findLoggerByCode(db, ' tl-0417 ')).toEqual(logger);
    expect(findLoggerByCode(db, 'TL-9999')).toBeNull();
  });

  it('refuses a second logger with the same ID, however it is typed', () => {
    createLogger(db, { code: 'TL-0417' });
    expect(() => createLogger(db, { code: 'tl-0417' })).toThrow(
      expect.objectContaining({ code: 'duplicate' }),
    );
  });

  it('"The old logger in Haifa shows the numbers differently from all the others": a logger can be set to °F and month/day', () => {
    const haifa = createLogger(db, { code: 'TL-0231' });
    updateLoggerSettings(db, haifa.id, { unit: 'F' });
    expect(getLogger(db, haifa.id)).toMatchObject({ unit: 'F', dateFormat: 'DD/MM' });
    updateLoggerSettings(db, haifa.id, { dateFormat: 'MM/DD' });
    expect(getLogger(db, haifa.id)).toMatchObject({ unit: 'F', dateFormat: 'MM/DD' });
  });

  it('refuses settings for a logger that does not exist', () => {
    expect(() => updateLoggerSettings(db, 99, { unit: 'F' })).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    );
  });

  it('lists each logger with the fridge it is in now', () => {
    const { walkIn, display } = telAviv();
    const moved = createLogger(db, { code: 'TL-0417' });
    const unplaced = createLogger(db, { code: 'TL-0500' });
    assignLogger(db, { loggerId: moved.id, fridgeId: walkIn.id, fromUtc: '2026-01-01T00:00:00Z' });
    assignLogger(db, { loggerId: moved.id, fridgeId: display.id, fromUtc: '2026-09-17T08:00:00Z' });

    expect(listLoggers(db)).toEqual([
      expect.objectContaining({
        id: moved.id,
        current: {
          fridgeId: display.id,
          fridgeName: 'Display 2',
          branchName: 'Tel Aviv',
          fromUtc: '2026-09-17T08:00:00Z',
        },
      }),
      expect.objectContaining({ id: unplaced.id, current: null }),
    ]);
  });
});

describe('logger moves', () => {
  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": readings belong to the fridge the logger was in at the time', () => {
    const { walkIn, display } = telAviv();
    const logger = createLogger(db, { code: 'TL-0417' });
    assignLogger(db, { loggerId: logger.id, fridgeId: walkIn.id, fromUtc: '2026-01-01T00:00:00Z' });
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: display.id,
      fromUtc: '2026-09-17T08:00:00Z',
    });

    expect(fridgeAt(db, logger.id, '2026-09-17T07:45:00Z')).toBe(walkIn.id);
    expect(fridgeAt(db, logger.id, '2026-09-17T08:00:00Z')).toBe(display.id);
    expect(fridgeAt(db, logger.id, '2026-09-20T12:00:00Z')).toBe(display.id);
  });

  it('has no fridge for a reading from before the logger was placed', () => {
    const { walkIn } = telAviv();
    const logger = createLogger(db, { code: 'TL-0417' });
    assignLogger(db, { loggerId: logger.id, fridgeId: walkIn.id, fromUtc: '2026-09-01T00:00:00Z' });
    expect(fridgeAt(db, logger.id, '2026-08-31T23:45:00Z')).toBeNull();
  });

  it('shows the move history newest first', () => {
    const { walkIn, display } = telAviv();
    const logger = createLogger(db, { code: 'TL-0417' });
    assignLogger(db, { loggerId: logger.id, fridgeId: walkIn.id, fromUtc: '2026-01-01T00:00:00Z' });
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: display.id,
      fromUtc: '2026-09-17T08:00:00Z',
    });

    expect(loggerHistory(db, logger.id)).toEqual([
      expect.objectContaining({
        fridgeName: 'Display 2',
        branchName: 'Tel Aviv',
        fromUtc: '2026-09-17T08:00:00Z',
      }),
      expect.objectContaining({
        fridgeName: 'Walk-in',
        branchName: 'Tel Aviv',
        fromUtc: '2026-01-01T00:00:00Z',
      }),
    ]);
  });

  it('refuses a move dated before the logger’s current placement', () => {
    const { walkIn, display } = telAviv();
    const logger = createLogger(db, { code: 'TL-0417' });
    assignLogger(db, { loggerId: logger.id, fridgeId: walkIn.id, fromUtc: '2026-09-17T08:00:00Z' });
    expect(() =>
      assignLogger(db, {
        loggerId: logger.id,
        fridgeId: display.id,
        fromUtc: '2026-09-01T00:00:00Z',
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_move' }));
  });

  it('refuses a move into the fridge the logger is already in', () => {
    const { walkIn } = telAviv();
    const logger = createLogger(db, { code: 'TL-0417' });
    assignLogger(db, { loggerId: logger.id, fridgeId: walkIn.id, fromUtc: '2026-01-01T00:00:00Z' });
    expect(() =>
      assignLogger(db, {
        loggerId: logger.id,
        fridgeId: walkIn.id,
        fromUtc: '2026-09-17T08:00:00Z',
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_move' }));
  });

  it('refuses a move for an unknown logger or fridge', () => {
    const { walkIn } = telAviv();
    const logger = createLogger(db, { code: 'TL-0417' });
    expect(() =>
      assignLogger(db, { loggerId: 99, fridgeId: walkIn.id, fromUtc: '2026-01-01T00:00:00Z' }),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(() =>
      assignLogger(db, { loggerId: logger.id, fridgeId: 99, fromUtc: '2026-01-01T00:00:00Z' }),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
  });

  it('errors are RegistryError instances', () => {
    expect(() => updateLoggerSettings(db, 99, { unit: 'F' })).toThrow(RegistryError);
  });
});
