// The logger registry: branches, fridges, loggers and where each logger was when.
// Set up once, it replaces Summer typing logger, branch and fridge on every pasted row.

/** @typedef {import('node:sqlite').DatabaseSync} Db */
/** @typedef {{ id: number, name: string }} Branch */
/** @typedef {{ id: number, branchId: number, name: string }} Fridge */
/** @typedef {{ id: number, code: string, unit: 'C' | 'F', dateFormat: 'DD/MM' | 'MM/DD' }} Logger */
/** @typedef {{ fridgeId: number, fridgeName: string, branchName: string, fromUtc: string }} Placement */

export class RegistryError extends Error {
  /**
   * @param {'duplicate' | 'not_found' | 'invalid_move'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
  }
}

/** Logger IDs are matched however they were typed in the file: ' tl-0417 ' is TL-0417. */
function normalizeCode(code) {
  return code.trim().toUpperCase();
}

function isUniqueViolation(err) {
  return /UNIQUE constraint failed/.test(err.message);
}

/** Runs an insert, turning a UNIQUE violation into a readable duplicate error. */
function insertUnique(stmt, params, message) {
  try {
    return stmt.run(...params);
  } catch (err) {
    if (isUniqueViolation(err)) throw new RegistryError('duplicate', message);
    throw err;
  }
}

function toLogger(row) {
  return { id: row.id, code: row.code, unit: row.unit, dateFormat: row.date_format };
}

// Branches ------------------------------------------------------------------

/** @returns {Branch} */
export function createBranch(db, name) {
  const { lastInsertRowid } = insertUnique(
    db.prepare('INSERT INTO branches (name) VALUES (?)'),
    [name],
    `A branch called "${name}" already exists.`,
  );
  return { id: Number(lastInsertRowid), name };
}

/** @returns {Branch[]} */
export function listBranches(db) {
  return db.prepare('SELECT id, name FROM branches ORDER BY name').all();
}

// Fridges -------------------------------------------------------------------

/** @returns {Fridge} */
export function createFridge(db, { branchId, name }) {
  if (!db.prepare('SELECT 1 FROM branches WHERE id = ?').get(branchId)) {
    throw new RegistryError('not_found', `Branch ${branchId} does not exist.`);
  }
  const { lastInsertRowid } = insertUnique(
    db.prepare('INSERT INTO fridges (branch_id, name) VALUES (?, ?)'),
    [branchId, name],
    `This branch already has a fridge called "${name}".`,
  );
  return { id: Number(lastInsertRowid), branchId, name };
}

/** @returns {(Fridge & { branchName: string })[]} */
export function listFridges(db) {
  return db
    .prepare(
      `SELECT f.id, f.branch_id AS branchId, b.name AS branchName, f.name
       FROM fridges f JOIN branches b ON b.id = f.branch_id
       ORDER BY b.name, f.name`,
    )
    .all();
}

// Loggers -------------------------------------------------------------------

/** @returns {Logger} */
export function createLogger(db, { code, unit = 'C', dateFormat = 'DD/MM' }) {
  const normalized = normalizeCode(code);
  const { lastInsertRowid } = insertUnique(
    db.prepare('INSERT INTO loggers (code, unit, date_format) VALUES (?, ?, ?)'),
    [normalized, unit, dateFormat],
    `Logger ${normalized} is already registered.`,
  );
  return { id: Number(lastInsertRowid), code: normalized, unit, dateFormat };
}

/** @returns {Logger | null} */
export function getLogger(db, id) {
  const row = db.prepare('SELECT id, code, unit, date_format FROM loggers WHERE id = ?').get(id);
  return row ? toLogger(row) : null;
}

/** @returns {Logger | null} */
export function findLoggerByCode(db, code) {
  const row = db
    .prepare('SELECT id, code, unit, date_format FROM loggers WHERE code = ?')
    .get(normalizeCode(code));
  return row ? toLogger(row) : null;
}

/** Every logger with the fridge it is in now (null if never placed), ordered by ID. */
export function listLoggers(db) {
  const rows = db
    .prepare(
      `SELECT l.id, l.code, l.unit, l.date_format,
              a.fridge_id, f.name AS fridge_name, b.name AS branch_name, a.from_utc
       FROM loggers l
       LEFT JOIN logger_assignments a ON a.id = (
         SELECT id FROM logger_assignments WHERE logger_id = l.id ORDER BY from_utc DESC LIMIT 1
       )
       LEFT JOIN fridges f ON f.id = a.fridge_id
       LEFT JOIN branches b ON b.id = f.branch_id
       ORDER BY l.code`,
    )
    .all();
  return rows.map((row) => ({
    ...toLogger(row),
    /** @type {Placement | null} */
    current:
      row.fridge_id === null
        ? null
        : {
            fridgeId: row.fridge_id,
            fridgeName: row.fridge_name,
            branchName: row.branch_name,
            fromUtc: row.from_utc,
          },
  }));
}

/** Changes how this logger's files are read. Only the given settings change. */
export function updateLoggerSettings(db, id, { unit, dateFormat }) {
  const logger = getLogger(db, id);
  if (!logger) throw new RegistryError('not_found', `Logger ${id} does not exist.`);
  db.prepare('UPDATE loggers SET unit = ?, date_format = ? WHERE id = ?').run(
    unit ?? logger.unit,
    dateFormat ?? logger.dateFormat,
    id,
  );
}

// Placement and moves ---------------------------------------------------------

/**
 * Puts a logger in a fridge from `fromUtc` on. The history only grows forward:
 * a move must be later than the current placement, and to a different fridge.
 */
export function assignLogger(db, { loggerId, fridgeId, fromUtc }) {
  if (!getLogger(db, loggerId)) {
    throw new RegistryError('not_found', `Logger ${loggerId} does not exist.`);
  }
  if (!db.prepare('SELECT 1 FROM fridges WHERE id = ?').get(fridgeId)) {
    throw new RegistryError('not_found', `Fridge ${fridgeId} does not exist.`);
  }
  const current = db
    .prepare(
      `SELECT fridge_id, from_utc FROM logger_assignments
       WHERE logger_id = ? ORDER BY from_utc DESC LIMIT 1`,
    )
    .get(loggerId);
  if (current && fromUtc <= current.from_utc) {
    throw new RegistryError(
      'invalid_move',
      `The move must be after ${current.from_utc}, when the logger was last placed.`,
    );
  }
  if (current && current.fridge_id === fridgeId) {
    throw new RegistryError('invalid_move', 'The logger is already in this fridge.');
  }
  const { lastInsertRowid } = db
    .prepare('INSERT INTO logger_assignments (logger_id, fridge_id, from_utc) VALUES (?, ?, ?)')
    .run(loggerId, fridgeId, fromUtc);
  return { id: Number(lastInsertRowid), loggerId, fridgeId, fromUtc };
}

/** @returns {(Placement & { id: number })[]} newest first */
export function loggerHistory(db, loggerId) {
  return db
    .prepare(
      `SELECT a.id, a.fridge_id AS fridgeId, f.name AS fridgeName, b.name AS branchName,
              a.from_utc AS fromUtc
       FROM logger_assignments a
       JOIN fridges f ON f.id = a.fridge_id
       JOIN branches b ON b.id = f.branch_id
       WHERE a.logger_id = ?
       ORDER BY a.from_utc DESC`,
    )
    .all(loggerId);
}

/**
 * The fridge a logger was in at `tsUtc`, or null if it hadn't been placed yet.
 * @returns {number | null}
 */
export function fridgeAt(db, loggerId, tsUtc) {
  const row = db
    .prepare(
      `SELECT fridge_id FROM logger_assignments
       WHERE logger_id = ? AND from_utc <= ?
       ORDER BY from_utc DESC LIMIT 1`,
    )
    .get(loggerId, tsUtc);
  return row ? row.fridge_id : null;
}
