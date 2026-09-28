-- Derived per fridge by the detection rules, rebuilt inside the ingest transaction so they are
-- never stale. Everything here can be thrown away and rebuilt from readings (npm run rebuild).
-- Times are UTC ISO-8601 text, like everywhere else.

-- Time above 5°C. end_reason says how the end is known: the first reading back in range,
-- the last reading before a gap, or the last reading there is.
CREATE TABLE excursions (
  id               INTEGER PRIMARY KEY,
  fridge_id        INTEGER NOT NULL REFERENCES fridges (id),
  start_utc        TEXT NOT NULL,
  end_utc          TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  peak_c           REAL NOT NULL,
  readings         INTEGER NOT NULL,
  end_reason       TEXT NOT NULL CHECK (end_reason IN ('back_in_range', 'gap', 'data_ends')),
  UNIQUE (fridge_id, start_utc)
);

-- Single readings above 5°C: door openings, shown on the chart but never counted.
CREATE TABLE door_spikes (
  fridge_id INTEGER NOT NULL REFERENCES fridges (id),
  ts_utc    TEXT NOT NULL,
  temp_c    REAL NOT NULL,
  PRIMARY KEY (fridge_id, ts_utc)
) WITHOUT ROWID;

-- Stretches with no valid reading for longer than the gap threshold.
CREATE TABLE gaps (
  fridge_id    INTEGER NOT NULL REFERENCES fridges (id),
  from_utc     TEXT NOT NULL,
  to_utc       TEXT NOT NULL,
  minutes      INTEGER NOT NULL,
  err_readings INTEGER NOT NULL,
  PRIMARY KEY (fridge_id, from_utc)
) WITHOUT ROWID;

-- The latest known state of each fridge with readings, so the overview reads one small table.
-- Warming is judged at the latest valid reading; the warming_* columns are NULL when there
-- isn't enough data to judge.
CREATE TABLE fridge_status (
  fridge_id           INTEGER PRIMARY KEY REFERENCES fridges (id),
  first_utc           TEXT NOT NULL, -- first reading of any kind, ERR included
  last_utc            TEXT NOT NULL, -- last reading of any kind: "did a file come in?"
  latest_valid_utc    TEXT,          -- last reading with a temperature: "Latest 7.1°C at …"
  latest_temp_c       REAL,
  warming_median_c    REAL,
  warming_previous_c  REAL,
  warming_rise_c      REAL,
  is_warming          INTEGER NOT NULL DEFAULT 0 CHECK (is_warming IN (0, 1))
);
