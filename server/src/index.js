import fs from 'node:fs';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();

// The data folder (raw files + DB) must never be a reason a fresh clone fails to start.
fs.mkdirSync(config.dataDir, { recursive: true });

const app = createApp({ clientDist: config.clientDist });

app.listen(config.port, config.host, () => {
  console.log(`ChillLog running at http://${config.host}:${config.port}`);
  if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.warn('Warning: exposed on the network with no login. Use only on a trusted network.');
  }
});
