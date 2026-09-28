-- Core tables: the registry (branches, fridges, loggers, where each logger was when),
-- the upload record, and readings.
-- All times are UTC ISO-8601 text, e.g. '2026-09-21T06:45:00Z', which sorts correctly as text.

CREATE TABLE branches (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE fridges (
  id        INTEGER PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches (id),
  name      TEXT NOT NULL,
  UNIQUE (branch_id, name)
);

-- Per-logger file settings: the Haifa logger records °F, and date order varies.
CREATE TABLE loggers (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE, -- e.g. 'TL-0417', as found in the file
  unit        TEXT NOT NULL DEFAULT 'C' CHECK (unit IN ('C', 'F')),
  date_format TEXT NOT NULL DEFAULT 'DD/MM' CHECK (date_format IN ('DD/MM', 'MM/DD'))
);

-- Move history: a logger is in a fridge from a point in time until its next assignment.
-- A reading belongs to the assignment with the latest from_utc at or before the reading.
CREATE TABLE logger_assignments (
  id        INTEGER PRIMARY KEY,
  logger_id INTEGER NOT NULL REFERENCES loggers (id),
  fridge_id INTEGER NOT NULL REFERENCES fridges (id),
  from_utc  TEXT NOT NULL,
  UNIQUE (logger_id, from_utc)
);

-- One row per distinct raw file. The file itself is kept unchanged at raw/<sha256>.csv.
CREATE TABLE uploads (
  id            INTEGER PRIMARY KEY,
  sha256        TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  uploaded_at   TEXT NOT NULL,
  logger_id     INTEGER REFERENCES loggers (id), -- NULL until the logger is known
  status        TEXT NOT NULL CHECK (status IN ('processed', 'needs_logger', 'failed')),
  report_json   TEXT
);

-- Derived from the raw files and rebuildable. The primary key is what makes
-- re-uploading overlapping files safe: one reading per logger per moment.
CREATE TABLE readings (
  logger_id INTEGER NOT NULL REFERENCES loggers (id),
  ts_utc    TEXT NOT NULL,
  temp_c    REAL, -- NULL when the logger wrote ERR
  is_err    INTEGER NOT NULL DEFAULT 0 CHECK (is_err IN (0, 1)),
  upload_id INTEGER NOT NULL REFERENCES uploads (id),
  PRIMARY KEY (logger_id, ts_utc)
) WITHOUT ROWID;
