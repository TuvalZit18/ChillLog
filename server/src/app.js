import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

/**
 * Builds the Express app without starting it, so tests can drive it with Supertest.
 * @param {{ clientDist?: string }} [options]
 */
export function createApp({ clientDist } = {}) {
  const app = express();

  app.use(express.json());

  // Auth slot: a single middleware goes here when login is added.

  const api = express.Router();
  api.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', api);
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Serve the built SPA from the same process; every non-API GET falls back to index.html.
  if (clientDist && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
