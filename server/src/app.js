import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { errorHandler } from './api/errors.js';
import { registryRoutes } from './api/registry-routes.js';
import { fridgeRoutes } from './api/fridge-routes.js';
import { overviewRoutes } from './api/overview-routes.js';
import { uploadRoutes } from './api/upload-routes.js';

/**
 * Builds the Express app without starting it, so tests can drive it with Supertest.
 * @param {{ db?: import('node:sqlite').DatabaseSync, rawDir?: string, clientDist?: string,
 *   now?: () => Date }} [options]
 *   db and rawDir go together: the data routes are mounted only when both are given.
 *   now is the clock ("this week" depends on it); tests pin it.
 */
export function createApp({ db, rawDir, clientDist, now = () => new Date() } = {}) {
  const app = express();

  app.use(express.json());

  // Auth slot: a single middleware goes here when login is added.

  const api = express.Router();
  api.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  if (db && rawDir) {
    api.use(registryRoutes(db, rawDir));
    api.use(uploadRoutes(db, rawDir));
    api.use(overviewRoutes(db, now));
    api.use(fridgeRoutes(db, now));
  }
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

  app.use(errorHandler);

  return app;
}
