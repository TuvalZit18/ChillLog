// npm run seed: demo data for trying ChillLog.
// Sets up 12 branches, their fridges and loggers, ingests three weeks of logger files through the
// real pipeline, and leaves the last week's files in samples/upload-me/ to upload from the app.
// Refuses to touch a database that already has data unless run with --reset.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import { generateDemo, loadDemo } from '../src/seed/demo.js';

const config = loadConfig();
const reset = process.argv.includes('--reset');
const uploadDir = path.resolve(import.meta.dirname, '..', '..', 'samples', 'upload-me');

function hasData() {
  if (!fs.existsSync(config.dbFile)) return false;
  const db = openDatabase(config.dbFile);
  try {
    migrate(db);
    return db.prepare('SELECT EXISTS (SELECT 1 FROM branches) AS yes').get().yes === 1;
  } finally {
    db.close();
  }
}

if (hasData()) {
  if (!reset) {
    console.error(
      `The database in ${config.dataDir} already has data, so nothing was changed.\n` +
        'To delete it and start over with demo data: npm run seed -- --reset',
    );
    process.exit(1);
  }
  // Only ChillLog's own files: the database (with its WAL files) and the stored raw uploads.
  for (const suffix of ['', '-wal', '-shm'])
    fs.rmSync(`${config.dbFile}${suffix}`, { force: true });
  fs.rmSync(config.rawDir, { recursive: true, force: true });
  console.log(`Deleted the database and raw files in ${config.dataDir}.`);
}

fs.mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(config.dbFile);
try {
  migrate(db);
  const plan = generateDemo();
  const reports = loadDemo(db, { rawDir: config.rawDir, plan, weeks: [0, 1, 2] }).flat();

  // The last week waits for the reviewer to upload it, from a laptop or a phone.
  fs.mkdirSync(uploadDir, { recursive: true });
  for (const name of fs.readdirSync(uploadDir)) {
    if (name.endsWith('.csv')) fs.rmSync(path.join(uploadDir, name));
  }
  const lastWeek = plan.weeks.at(-1);
  for (const file of lastWeek.files)
    fs.writeFileSync(path.join(uploadDir, file.fileName), file.content);

  const fridgeCount = plan.branches.reduce((sum, b) => sum + b.fridges.length, 0);
  const readings = reports.reduce((sum, r) => sum + r.readings.added, 0);
  console.log(
    [
      `Demo data ready in ${config.dataDir}:`,
      `  ${plan.branches.length} branches, ${fridgeCount} fridges, ${plan.loggers.length} loggers`,
      `  ${reports.length} files from ${plan.weeks[0].firstDay} to ${plan.weeks[2].lastDay}, ${readings} readings`,
      '',
      `This week's ${lastWeek.files.length} files (${lastWeek.firstDay} to ${lastWeek.lastDay}) are in`,
      `  ${uploadDir}`,
      'Start the app (npm start) and upload them on the Upload screen.',
    ].join('\n'),
  );
} finally {
  db.close();
}
