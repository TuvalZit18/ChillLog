// GET /api/fridges/:id: one fridge over a range, for the fridge page and its chart.

import express from 'express';
import { fridgeQuery, idParam } from '@chilllog/shared';
import { buildFridgeDetail, resolveRange } from '../reporting/fridge-detail.js';
import { HttpError, validate } from './errors.js';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {() => Date} now
 */
export function fridgeRoutes(db, now) {
  const router = express.Router();

  router.get('/fridges/:id', (req, res) => {
    const { id } = validate(idParam, req.params);
    const { from, to } = validate(fridgeQuery, req.query);
    const clock = now();
    const range = resolveRange({ now: clock, from, to });
    if ('error' in range) throw new HttpError(400, range.error);
    const detail = buildFridgeDetail(db, { fridgeId: id, range, now: clock });
    if (!detail) throw new HttpError(404, 'That fridge does not exist.');
    res.json(detail);
  });

  return router;
}
