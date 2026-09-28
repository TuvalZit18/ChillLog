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
      const fileName = decodeFileName(file.originalname);
      if (hasUploadExtension(fileName)) {
        accepted.push({ index, fileName, content: file.buffer });
      } else {
        reports[index] = rejectedReport(fileName, 'not_csv');
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

const REPLACEMENT_CHAR = String.fromCodePoint(0xfffd);

/**
 * Multer reads file names as Latin-1, but browsers send them as UTF-8 bytes, so a Hebrew name
 * like "מקרר חלב.csv" arrives garbled. Re-decode it as UTF-8, unless the name is already
 * proper Unicode or its bytes aren't valid UTF-8.
 */
function decodeFileName(name) {
  if ([...name].some((ch) => ch.codePointAt(0) > 0xff)) return name;
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return utf8.includes(REPLACEMENT_CHAR) ? name : utf8;
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
