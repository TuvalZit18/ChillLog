// The inspector report, on screen (JSON) and as a CSV download for Excel.

import express from 'express';
import { inspectorQuery } from '@chilllog/shared';
import { getBranch, getFridge } from '../registry/registry.js';
import { resolveRange } from '../reporting/fridge-detail.js';
import {
  DEFAULT_RANGE_DAYS,
  buildInspectorReport,
  inspectorCsv,
  inspectorFileName,
} from '../reporting/inspector.js';
import { HttpError, validate } from './errors.js';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {() => Date} now
 */
export function inspectorRoutes(db, now) {
  const router = express.Router();

  /** Checks the filters and builds the report both endpoints share. */
  const report = (query) => {
    const { branchId, fridgeId, from, to } = validate(inspectorQuery, query);
    if (branchId !== undefined && !getBranch(db, branchId)) {
      throw new HttpError(404, 'That branch does not exist.');
    }
    if (fridgeId !== undefined) {
      const fridge = getFridge(db, fridgeId);
      if (!fridge) throw new HttpError(404, 'That fridge does not exist.');
      if (branchId !== undefined && fridge.branchId !== branchId) {
        throw new HttpError(400, 'That fridge is not in the chosen branch.');
      }
    }
    const clock = now();
    const range = resolveRange({ now: clock, from, to, defaultDays: DEFAULT_RANGE_DAYS });
    if ('error' in range) throw new HttpError(400, range.error);
    return buildInspectorReport(db, { branchId, fridgeId, range, now: clock });
  };

  router.get('/inspector', (req, res) => {
    res.json(report(req.query));
  });

  router.get('/inspector/export', (req, res) => {
    const built = report(req.query);
    res
      .type('text/csv; charset=utf-8')
      .attachment(inspectorFileName(built.range))
      .send(inspectorCsv(built));
  });

  return router;
}
