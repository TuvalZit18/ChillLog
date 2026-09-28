// GET /api/overview: every fridge's status for one week, worst first.

import express from 'express';
import { overviewQuery } from '@chilllog/shared';
import { buildOverview, weekWindow } from '../reporting/overview.js';
import { HttpError, validate } from './errors.js';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {() => Date} now the clock, injectable so tests can pin "this week"
 */
export function overviewRoutes(db, now) {
  const router = express.Router();

  router.get('/overview', (req, res) => {
    const { week } = validate(overviewQuery, req.query);
    const selected = weekWindow({ now: now(), week });
    if (!selected) throw new HttpError(400, `${week} is not a real date.`);
    res.json(buildOverview(db, { now: now(), week: selected }));
  });

  return router;
}
