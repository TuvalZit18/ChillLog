// Upload endpoints: bulk upload with a report per file, the upload list, and the follow-ups
// for files that need Summer (preview, pick the logger, try again).

import express from 'express';
import multer from 'multer';
import { UPLOAD_LIMITS, assignInput, hasUploadExtension, idParam } from '@chilllog/shared';
import {
  assignUploadLogger,
  ingestFiles,
  listUploads,
  previewUpload,
  rejectedReport,
  retryUpload,
} from '../ingest/ingest.js';
import { HttpError, validate } from './errors.js';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} rawDir
 */
export function uploadRoutes(db, rawDir) {
  const router = express.Router();

  // In memory: files are small, and the pipeline hashes them before anything touches the disk.
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.maxFileBytes, files: UPLOAD_LIMITS.maxFiles },
  }).array('files', UPLOAD_LIMITS.maxFiles);

  router.post('/uploads', receive, (req, res) => {
    const files = req.files ?? [];
    if (files.length === 0) throw new HttpError(400, 'Choose at least one file to upload.');

    // Files with the wrong extension are refused one by one, so the rest of the batch still
    // goes in. Reports come back in the order the files were sent.
    const reports = new Array(files.length);
    const accepted = [];
    files.forEach((file, index) => {
      if (hasUploadExtension(file.originalname)) {
        accepted.push({ index, fileName: file.originalname, content: file.buffer });
      } else {
        reports[index] = rejectedReport(file.originalname, 'not_csv');
      }
    });
    ingestFiles(db, { rawDir, files: accepted }).forEach((report, i) => {
      reports[accepted[i].index] = report;
    });

    res.json({ summary: summarize(reports), files: reports });
  });

  router.get('/uploads', (req, res) => {
    res.json(listUploads(db));
  });

  router.get('/uploads/:id/preview', (req, res) => {
    res.json(previewUpload(db, { rawDir, uploadId: validate(idParam, req.params).id }));
  });

  router.post('/uploads/:id/assign', (req, res) => {
    const { id } = validate(idParam, req.params);
    const { loggerId } = validate(assignInput, req.body);
    res.json(assignUploadLogger(db, { rawDir, uploadId: id, loggerId }));
  });

  router.post('/uploads/:id/retry', (req, res) => {
    res.json(retryUpload(db, { rawDir, uploadId: validate(idParam, req.params).id }));
  });

  return router;
}

/** The line above the file cards: "6 files · 2,004 readings added · 2 need your help". */
function summarize(reports) {
  const count = (...statuses) => reports.filter((r) => statuses.includes(r.status)).length;
  return {
    files: reports.length,
    readingsAdded: reports.reduce((sum, r) => sum + r.readings.added, 0),
    alreadyUploaded: count('already_uploaded'),
    needYourHelp: count('needs_logger', 'failed', 'rejected'),
  };
}
