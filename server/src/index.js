import fs from 'node:fs';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { openDatabase } from './db/database.js';
import { migrate } from './db/migrate.js';

const config = loadConfig();

// The data folder (raw files + DB) must never be a reason a fresh clone fails to start.
fs.mkdirSync(config.dataDir, { recursive: true });

const db = openDatabase(config.dbFile);
const applied = migrate(db);
if (applied.length > 0) {
  console.log(`Applied migrations: ${applied.join(', ')}`);
}

const app = createApp({ db, rawDir: config.rawDir, clientDist: config.clientDist });

app.listen(config.port, config.host, () => {
  console.log(`ChillLog running at http://${config.host}:${config.port}`);
  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.warn('Warning: exposed on the network with no login. Use only on a trusted network.');
  }
});
