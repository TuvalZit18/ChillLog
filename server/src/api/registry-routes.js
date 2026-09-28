// Registry endpoints: branches, fridges, loggers, logger settings and moves.

import express from 'express';
import {
  branchInput,
  fridgeInput,
  idParam,
  loggerInput,
  loggerSettingsInput,
  moveInput,
} from '@chilllog/shared';
import { transaction } from '../db/transaction.js';
import { recomputeForLogger } from '../detection/store.js';
import {
  assignLogger,
  createBranch,
  createFridge,
  createLogger,
  getLogger,
  listBranches,
  listFridges,
  listLoggers,
  loggerHistory,
  updateLoggerSettings,
} from '../registry/registry.js';
import { HttpError, validate } from './errors.js';
import { localToUtc } from './time.js';

/** @param {import('node:sqlite').DatabaseSync} db */
export function registryRoutes(db) {
  const router = express.Router();

  /** A logger with where it is now and where it has been, newest first. */
  const loggerDetail = (id) => {
    const logger = getLogger(db, id);
    if (!logger) throw new HttpError(404, 'That logger does not exist.');
    const history = loggerHistory(db, id);
    return { ...logger, current: history[0] ?? null, history };
  };

  router.get('/branches', (req, res) => {
    const fridges = listFridges(db);
    res.json(
      listBranches(db).map((branch) => ({
        ...branch,
        fridges: fridges
          .filter((f) => f.branchId === branch.id)
          .map(({ id, name }) => ({ id, name })),
      })),
    );
  });

  router.post('/branches', (req, res) => {
    const { name } = validate(branchInput, req.body);
    res.status(201).json(createBranch(db, name));
  });

  router.post('/fridges', (req, res) => {
    res.status(201).json(createFridge(db, validate(fridgeInput, req.body)));
  });

  router.get('/loggers', (req, res) => {
    res.json(listLoggers(db));
  });

  router.post('/loggers', (req, res) => {
    const input = validate(loggerInput, req.body);
    const logger = transaction(db, () => {
      const created = createLogger(db, input);
      if (input.fridgeId !== undefined) {
        assignLogger(db, {
          loggerId: created.id,
          fridgeId: input.fridgeId,
          fromUtc: localToUtc(input.from),
        });
      }
      return created;
    });
    res.status(201).json(loggerDetail(logger.id));
  });

  router.get('/loggers/:id', (req, res) => {
    res.json(loggerDetail(validate(idParam, req.params).id));
  });

  router.patch('/loggers/:id/settings', (req, res) => {
    const { id } = validate(idParam, req.params);
    updateLoggerSettings(db, id, validate(loggerSettingsInput, req.body));
    res.json(loggerDetail(id));
  });

  // A move changes which readings belong to which fridge, so both fridges are recomputed in
  // the same transaction as the move.
  router.post('/loggers/:id/moves', (req, res) => {
    const { id } = validate(idParam, req.params);
    const { fridgeId, from } = validate(moveInput, req.body);
    transaction(db, () => {
      assignLogger(db, { loggerId: id, fridgeId, fromUtc: localToUtc(from) });
      recomputeForLogger(db, id);
    });
    res.status(201).json(loggerDetail(id));
  });

  return router;
}
