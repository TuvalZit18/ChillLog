// npm run rebuild: derive every reading again from the stored raw files.
// Use after fixing a parsing bug or changing a rule; the raw files are the source of truth.

import fs from 'node:fs';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { rebuildReadings } from '../src/ingest/ingest.js';

const config = loadConfig();
fs.mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(config.dbFile);

try {
  migrate(db);
  const reports = rebuildReadings(db, { rawDir: config.rawDir });
  const count = (status) => reports.filter((r) => r.status === status).length;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM readings').get();
  console.log(
    `Rebuilt from ${reports.length} raw files: ${count('processed')} processed, ` +
      `${count('failed')} held back, ${count('needs_logger')} waiting for a logger. ` +
      `${n} readings.`,
  );
} catch (err) {
  console.error(`Rebuild failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
