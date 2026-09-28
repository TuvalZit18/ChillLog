// What the upload report says about each file (docs/design/ui.md, "Upload file card").
// Reports have the shape POST /api/uploads returns per file.

import { describe, expect, it } from 'vitest';
import {
  checkFiles,
  fileKind,
  fileLines,
  fileWhere,
  summarize,
  summaryLine,
  waitingUploads,
} from './uploadModel.js';

const NONE = {
  added: 0,
  alreadyStored: 0,
  err: 0,
  unreadable: 0,
  duplicatesInFile: 0,
  beforePlacement: 0,
};
const report = (overrides) => ({
  uploadId: 1,
  fileName: 'TL-0388_2026-09-28.csv',
  status: 'processed',
  reason: null,
  loggerId: 7,
  loggerCode: 'TL-0388',
  readings: { ...NONE, added: 672 },
  range: { fromUtc: '2026-09-20T21:00:00Z', toUtc: '2026-09-27T20:45:00Z' },
  notes: [],
  ...overrides,
});

describe('fileKind', () => {
  it('a clean file is "Added"', () => {
    expect(fileKind(report())).toBe('added');
  });

  it('a file with ERR, unreadable or repeated rows is "Added, with notes"', () => {
    expect(fileKind(report({ readings: { ...NONE, added: 669, err: 3 } }))).toBe('notes');
    expect(fileKind(report({ notes: ['out_of_order'] }))).toBe('notes');
  });

  it('maps the other statuses to their cards', () => {
    expect(fileKind(report({ status: 'already_uploaded' }))).toBe('duplicate');
    expect(fileKind(report({ status: 'failed', reason: 'looks_fahrenheit' }))).toBe('held');
    expect(fileKind(report({ status: 'needs_logger', reason: 'no_logger_id' }))).toBe('help');
    expect(fileKind(report({ status: 'rejected', reason: 'not_csv' }))).toBe('rejected');
  });
});

describe('fileLines', () => {
  it('says how many readings were added, with thousands separators', () => {
    expect(fileLines(report({ readings: { ...NONE, added: 2004 } }))).toEqual([
      '2,004 readings added',
    ]);
  });

  it('"The files don\'t look quite the same from branch to branch": explains every row it skipped', () => {
    const lines = fileLines(
      report({
        readings: {
          added: 660,
          alreadyStored: 96,
          err: 3,
          unreadable: 2,
          duplicatesInFile: 5,
          beforePlacement: 12,
        },
        notes: ['out_of_order', 'date_format_differs'],
      }),
    );
    expect(lines).toEqual([
      '660 readings added',
      '96 already in from an earlier file',
      '3 ERR readings (no temperature) kept as missing',
      "2 rows couldn't be read and were skipped",
      '5 repeated rows skipped',
      '12 readings from before the logger was in a fridge, not used',
      'Rows were out of time order; sorted',
      "Dates are day/month the other way round from this logger's setting",
    ]);
  });

  it('a file uploaded again adds nothing', () => {
    expect(fileLines(report({ status: 'already_uploaded', readings: NONE }))).toEqual([
      'Same file as before. Nothing added.',
    ]);
  });

  it('"The old logger in Haifa shows the numbers differently": a file that looks like °F is held back', () => {
    expect(
      fileLines(report({ status: 'failed', reason: 'looks_fahrenheit', readings: NONE })),
    ).toEqual([
      "Temperatures look like °F, but this logger is set to °C. Nothing was added. Check the logger's settings, then try again.",
    ]);
  });

  it('explains the other reasons a file is held back', () => {
    const lines = (reason) => fileLines(report({ status: 'failed', reason, readings: NONE }));
    expect(lines('looks_celsius')).toEqual([
      "Temperatures look like °C, but this logger is set to °F. Nothing was added. Check the logger's settings, then try again.",
    ]);
    expect(lines('no_readings')).toEqual(['No readings found in this file. Nothing was added.']);
    expect(lines('error')).toEqual(['Something went wrong reading this file. Nothing was added.']);
  });

  it('a file with no logger ID waits for Summer to say which logger it is from', () => {
    const waiting = report({ status: 'needs_logger', reason: 'no_logger_id', loggerId: null });
    expect(fileLines(waiting)).toEqual([
      'Waiting: choose the logger, then its readings are added.',
    ]);
  });

  it('a file whose logger is not registered says which ID it found', () => {
    const unknown = report({
      status: 'needs_logger',
      reason: 'unknown_logger',
      loggerId: null,
      loggerCode: 'TL-0999',
    });
    expect(fileLines(unknown)).toEqual([
      "Logger TL-0999 isn't in ChillLog yet. Choose the logger, then its readings are added.",
    ]);
  });

  it('a file of the wrong type is not uploaded', () => {
    expect(fileLines(report({ status: 'rejected', reason: 'not_csv', readings: NONE }))).toEqual([
      'Not a CSV file from a logger. Nothing was uploaded.',
    ]);
  });
});

describe('fileWhere', () => {
  const loggers = new Map([
    [
      7,
      {
        id: 7,
        code: 'TL-0388',
        current: { fridgeId: 8, fridgeName: 'Cream cakes', branchName: 'Rishon LeZion' },
      },
    ],
    [9, { id: 9, code: 'TL-0700', current: null }],
  ]);

  it('names the logger and the fridge it is in now', () => {
    expect(fileWhere(report(), loggers)).toBe('TL-0388 · Rishon LeZion · Cream cakes');
  });

  it('says so when the logger is not in a fridge, or there is no logger yet', () => {
    expect(fileWhere(report({ loggerId: 9, loggerCode: 'TL-0700' }), loggers)).toBe(
      'TL-0700 · not in a fridge',
    );
    expect(
      fileWhere(report({ status: 'needs_logger', loggerId: null, loggerCode: null }), loggers),
    ).toBe('No logger ID in the file');
  });
});

describe('fileWhere for a file that was not uploaded', () => {
  it('says nothing about a logger for a file that was never read', () => {
    const pdf = report({ status: 'rejected', reason: 'not_csv', loggerId: null, loggerCode: null });
    expect(fileWhere(pdf, new Map())).toBeNull();
  });
});

describe('summarize', () => {
  it('counts the batch the way the server does, so it stays right after "Try again"', () => {
    expect(
      summarize([
        report({ readings: { ...NONE, added: 672 } }),
        report({ status: 'already_uploaded', readings: { ...NONE, alreadyStored: 672 } }),
        report({ status: 'needs_logger', readings: NONE }),
        report({ status: 'failed', readings: NONE }),
        report({ status: 'rejected', readings: NONE }),
      ]),
    ).toEqual({ files: 5, readingsAdded: 672, alreadyUploaded: 1, needYourHelp: 3 });
  });
});

describe('summaryLine', () => {
  it('reads "6 files · 2,004 readings added · 2 need your help"', () => {
    expect(
      summaryLine({ files: 6, readingsAdded: 2004, alreadyUploaded: 1, needYourHelp: 2 }),
    ).toBe('6 files · 2,004 readings added · 2 need your help');
  });

  it('says when nothing needs help, and uses the singular', () => {
    expect(summaryLine({ files: 1, readingsAdded: 1, alreadyUploaded: 0, needYourHelp: 0 })).toBe(
      '1 file · 1 reading added · nothing needs your help',
    );
    expect(summaryLine({ files: 3, readingsAdded: 0, alreadyUploaded: 0, needYourHelp: 1 })).toBe(
      '3 files · 0 readings added · 1 needs your help',
    );
  });
});

describe('checkFiles', () => {
  const file = (name, size = 20_000) => ({ name, size });

  it('lets a normal batch through', () => {
    expect(checkFiles([file('a.csv'), file('b.CSV'), file('c.txt')])).toBeNull();
  });

  it('asks for at least one file', () => {
    expect(checkFiles([])).toBe('Choose at least one file to upload.');
  });

  it('stops a batch that is too big before sending it on a weak signal', () => {
    expect(checkFiles(Array.from({ length: 51 }, (_, i) => file(`${i}.csv`)))).toBe(
      'Upload up to 50 files at a time. Nothing was uploaded.',
    );
    expect(checkFiles([file('huge.csv', 6 * 1024 * 1024)])).toBe(
      'huge.csv is bigger than 5 MB. Nothing was uploaded.',
    );
  });
});

describe('waitingUploads', () => {
  it('lists earlier files that still need Summer, newest first as the server sends them', () => {
    const uploads = [
      report({ uploadId: 3, status: 'processed' }),
      report({ uploadId: 2, status: 'needs_logger', reason: 'no_logger_id' }),
      report({ uploadId: 1, status: 'failed', reason: 'looks_fahrenheit' }),
    ];
    expect(waitingUploads(uploads).map((u) => u.uploadId)).toEqual([2, 1]);
  });
});
