/**
 * Runs `fn` inside a transaction: committed if it returns, rolled back if it throws.
 * node:sqlite has no transaction helper, so BEGIN/COMMIT are issued by hand.
 * @template T
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {() => T} fn
 * @returns {T}
 */
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
