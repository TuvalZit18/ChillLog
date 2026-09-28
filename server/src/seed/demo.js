// Demo data. The assignment says to invent data in whatever shape the loggers produce, so this
// generator also defines the assumed file formats. Every messy case in Summer's email is built in
// on purpose, at the times of her own sample rows where there are some.
// Deterministic: the same week always produces the same files (a seeded random function).

import { DateTime } from 'luxon';
import { TIME_ZONE } from '@chilllog/shared';
import { assignLogger, createBranch, createFridge, createLogger } from '../registry/registry.js';
import { ingestFiles } from '../ingest/ingest.js';

export const DEMO_SEED = 20260921;
const SLOT_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Tiny seeded random numbers in [0, 1) (mulberry32): same seed, same sequence. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 12 branches. The file format is per branch: "the files don't look quite the same from branch
// to branch, the columns move around".
const BRANCHES = [
  {
    name: 'Tel Aviv',
    format: 'comma',
    fridges: [
      ['Walk-in', 'TL-0417'],
      ['Display 1', 'TL-0415'],
      ['Display 2', null],
    ],
  },
  {
    name: 'Jerusalem',
    format: 'comma-iso',
    fridges: [
      ['Dairy', 'TL-0512'],
      ['Walk-in', 'TL-0513'],
    ],
  },
  {
    name: 'Haifa',
    format: 'id-line',
    fridges: [
      ['Dairy', 'TL-0231'],
      ['Walk-in', 'TL-0232'],
    ],
  },
  {
    name: 'Rishon LeZion',
    format: 'semicolon',
    fridges: [
      ['Cream cakes', 'TL-0388'],
      ['Dairy', 'TL-0389'],
      ['Walk-in', 'TL-0390'],
    ],
  },
  {
    name: 'Petah Tikva',
    format: 'tab',
    fridges: [
      ['Display 1', 'TL-0450'],
      ['Dairy', 'TL-0451'],
    ],
  },
  {
    name: 'Ashdod',
    format: 'comma',
    fridges: [
      ['Dairy', 'TL-0470'],
      ['Walk-in', 'TL-0471'],
    ],
  },
  {
    name: 'Netanya',
    format: 'id-line',
    fridges: [
      ['Dairy', 'TL-0601'],
      ['Drinks', 'TL-0602'],
    ],
  },
  {
    name: 'Beersheba',
    format: 'comma',
    fridges: [
      ['Dairy', 'TL-0620'],
      ['Walk-in', 'TL-0621'],
    ],
  },
  {
    name: 'Holon',
    format: 'semicolon',
    fridges: [
      ['Dairy', 'TL-0640'],
      ['Display 1', 'TL-0641'],
      ['Cream cakes', 'TL-0642'],
    ],
  },
  {
    name: 'Ramat Gan',
    format: 'tab',
    fridges: [
      ['Dairy', 'TL-0660'],
      ['Walk-in', 'TL-0661'],
      ['Drinks', 'TL-0662'],
    ],
  },
  {
    name: 'Herzliya',
    format: 'comma',
    fridges: [
      ['Dairy', 'TL-0680'],
      ['Display 1', 'TL-0681'],
      ['Display 2', 'TL-0682'],
      ['Walk-in', 'TL-0683'],
    ],
  },
  {
    name: 'Eilat',
    format: 'id-line',
    fridges: [
      ['Dairy', 'TL-0700'],
      ['Drinks', 'TL-0701'],
    ],
  },
];

// The scenarios, each tied to the line of the email it demonstrates.
const HAIFA_FAHRENHEIT = 'TL-0231'; // "The old logger in Haifa shows the numbers differently"
const MOVED = 'TL-0417'; // "We moved one of the Tel Aviv loggers into the new display fridge last week"
const REPLACEMENT = 'TL-0419'; // the walk-in's new logger after the move
const GAP = 'TL-0512'; // "Sometimes there's a gap of a couple of hours in a file"
const SLOW_WARMING = 'Rishon LeZion/Cream cakes'; // "slowly dying for two days": passes 5°C
const WARMING = 'Petah Tikva/Display 1'; // "A fridge that's slowly warming up is not fine": still below 5°C
const STOPS_EARLY = 'TL-0470'; // "the battery ran out"
const NO_LOGGER_ID = 'TL-0602'; // a file with no logger ID: Summer picks the logger once
const NO_FILE_BRANCH = 'Beersheba'; // a branch that didn't send this week's files

/**
 * @typedef {{ fileName: string, content: Buffer, loggerCode: string }} DemoFile
 * @typedef {{ firstDay: string, lastDay: string, files: DemoFile[] }} DemoWeek
 * @typedef {{ code: string, unit: 'C' | 'F', placements: { branch: string, fridge: string,
 *   fromUtc: string }[] }} DemoLogger
 * @typedef {{ branches: { name: string, fridges: string[] }[], loggers: DemoLogger[],
 *   weeks: DemoWeek[] }} DemoPlan
 */

/**
 * Four full Monday–Sunday weeks ending last Sunday (Israel time), so the last one is exactly the
 * overview's "this week" whenever this runs.
 * @param {{ now?: Date }} [options]
 * @returns {DemoPlan}
 */
export function generateDemo({ now = new Date() } = {}) {
  const lastWeek = DateTime.fromJSDate(now, { zone: TIME_ZONE })
    .startOf('week')
    .minus({ weeks: 1 });
  const weekStarts = [3, 2, 1, 0].map((n) => lastWeek.minus({ weeks: n }));
  const at = (days, hours, minutes = 0) => lastWeek.plus({ days, hours, minutes }).toMillis(); // a local time in the last week
  const firstMs = weekStarts[0].toMillis();
  const moveMs = at(2, 18); // Wednesday 18:00: the email's sample has TL-0417 in Display 2 on Thursday 06:00

  const fridges = BRANCHES.flatMap((branch) =>
    branch.fridges.map(([name, code]) => ({
      branch: branch.name,
      name,
      code,
      format: branch.format,
    })),
  ).map((fridge, index) => ({ ...fridge, index, key: `${fridge.branch}/${fridge.name}` }));
  const fridge = (key) => fridges.find((f) => f.key === key);

  const loggers = fridges
    .filter((f) => f.code)
    .map((f) => ({
      code: f.code,
      unit: f.code === HAIFA_FAHRENHEIT ? 'F' : 'C',
      format: f.code === HAIFA_FAHRENHEIT ? 'haifa' : f.format,
      branch: f.branch,
      placements: [{ fridge: f, fromMs: firstMs }],
    }));
  loggers
    .find((l) => l.code === MOVED)
    .placements.push({ fridge: fridge('Tel Aviv/Display 2'), fromMs: moveMs });
  loggers.push({
    code: REPLACEMENT,
    unit: 'C',
    format: 'comma',
    branch: 'Tel Aviv',
    placements: [{ fridge: fridge('Tel Aviv/Walk-in'), fromMs: moveMs }],
  });

  const temperature = temperatureModel(fridges, { lastWeek, at });

  const weeks = weekStarts.map((start, w) => {
    const isLast = w === weekStarts.length - 1;
    const end = start.plus({ weeks: 1 });
    const downloadDate = end.toISODate(); // the Monday the managers download the week
    const files = [];
    for (const logger of loggers) {
      if (isLast && logger.branch === NO_FILE_BRANCH) continue;
      const from = Math.max(start.toMillis(), logger.placements[0].fromMs);
      const to = isLast && logger.code === STOPS_EARLY ? at(3, 14) : end.toMillis();
      let rows = [];
      for (let t = from; t < to; t += SLOT_MS) {
        const placed = logger.placements.findLast((p) => p.fromMs <= t);
        if (placed) rows.push({ ms: t, value: temperature(placed.fridge, t, w) });
      }
      if (rows.length === 0) continue;
      if (isLast) rows = scriptedRows(logger.code, rows, at);
      files.push(
        writeFile(logger, rows, { downloadDate, hideId: isLast && logger.code === NO_LOGGER_ID }),
      );
    }
    return { firstDay: start.toISODate(), lastDay: end.minus({ days: 1 }).toISODate(), files };
  });

  return {
    branches: BRANCHES.map((b) => ({ name: b.name, fridges: b.fridges.map(([name]) => name) })),
    loggers: loggers.map((l) => ({
      code: l.code,
      unit: l.unit,
      placements: l.placements.map((p) => ({
        branch: p.fridge.branch,
        fridge: p.fridge.name,
        fromUtc: new Date(p.fromMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      })),
    })),
    weeks,
  };
}

/**
 * Temperature of a fridge at a moment, in °C. Normal fridges sit between 2.8 and 4.4°C with a
 * small daily cycle, a little noise and one or two door openings a week (single readings of
 * 7–10°C on Tuesday and Wednesday, never next to each other). Two fridges warm up in the last week.
 */
function temperatureModel(fridges, { lastWeek, at }) {
  const profiles = fridges.map((f) => {
    const random = mulberry32(DEMO_SEED + f.index * 7919);
    const base = f.key === SLOW_WARMING ? 3.5 : f.key === WARMING ? 2.8 : 2.8 + random() * 1.2;
    return { base };
  });
  const spikes = new Map(); // "fridgeIndex/week" → Map(ms → °C)
  const spikesFor = (f, w) => {
    const key = `${f.index}/${w}`;
    if (!spikes.has(key)) {
      const random = mulberry32(DEMO_SEED + f.index * 31 + w * 7);
      const weekStart = lastWeek.minus({ weeks: 3 - w });
      const days = random() < 0.5 ? [1] : [1, 2]; // Tuesday, and sometimes Wednesday
      spikes.set(
        key,
        new Map(
          days.map((day) => [
            weekStart
              .plus({
                days: day,
                hours: 7 + Math.floor(random() * 12),
                minutes: 15 * Math.floor(random() * 4),
              })
              .toMillis(),
            7 + random() * 3,
          ]),
        ),
      );
    }
    return spikes.get(key);
  };
  const slowFrom = at(3, 12); // Thursday noon
  const warmFrom = at(4, 0); // Friday midnight

  return (f, ms, w) => {
    const isLast = w === 3;
    if (isLast && f.key === SLOW_WARMING && ms >= slowFrom) {
      return round1(3.5 + (0.75 * (ms - slowFrom)) / DAY_MS); // passes 5°C on Saturday afternoon
    }
    if (isLast && f.key === WARMING && ms >= warmFrom) {
      return round1(2.8 + (0.7 * (ms - warmFrom)) / DAY_MS); // 4.9°C by Sunday night
    }
    const spike = spikesFor(f, w).get(ms);
    if (spike !== undefined) return round1(spike);
    const hour = (ms / 3_600_000) % 24;
    const cycle = 0.3 * Math.sin((2 * Math.PI * (hour - 3)) / 24);
    const noise =
      (mulberry32(DEMO_SEED + f.index * 1_000_003 + Math.floor(ms / SLOT_MS))() - 0.5) * 0.2;
    return round1(profiles[f.index].base + cycle + noise);
  };
}

/** The email's own sample rows, reproduced in the last week's files. */
function scriptedRows(code, rows, at) {
  const set = (ms, value) => {
    const row = rows.find((r) => r.ms === ms);
    if (row) row.value = value;
  };
  if (code === MOVED) {
    // Door opening on Monday 06:15, and the 05:45 row written after 06:30, as in her sheet.
    set(at(0, 5, 45), 4.0);
    set(at(0, 6), 4.1);
    set(at(0, 6, 15), 9.4);
    set(at(0, 6, 30), 4.3);
    const early = rows.findIndex((r) => r.ms === at(0, 5, 45));
    const [row] = rows.splice(early, 1);
    rows.splice(rows.findIndex((r) => r.ms === at(0, 6, 30)) + 1, 0, row);
  }
  if (code === GAP) {
    // 06:15 written twice, then nothing until 08:30.
    set(at(0, 6), 3.8);
    set(at(0, 6, 15), 3.9);
    const i = rows.findIndex((r) => r.ms === at(0, 6, 15));
    rows.splice(i + 1, 0, { ...rows[i] });
    rows = rows.filter((r) => r.ms < at(0, 6, 30) || r.ms > at(0, 8, 15));
    set(at(0, 8, 30), 4.0);
  }
  if (code === HAIFA_FAHRENHEIT) {
    // 38.3 and 39.0°F, then ERR at 06:30; one more ERR on Wednesday afternoon.
    set(at(0, 6), 3.5);
    set(at(0, 6, 15), 3.9);
    set(at(0, 6, 30), 'ERR');
    set(at(2, 14), 'ERR');
  }
  return rows;
}

const FORMATS = {
  comma: { header: 'Time,Temperature', time: 'dd/MM/yyyy HH:mm', row: (t, v) => `${t},${v}` },
  'comma-iso': { header: 'Time,Temp', time: 'yyyy-MM-dd HH:mm', row: (t, v) => `${t},${v}` },
  // Excel with a European locale: semicolons, decimal commas, temperature first, CRLF.
  semicolon: {
    header: 'Temperature (C);Timestamp',
    time: 'dd/MM/yyyy HH:mm',
    row: (t, v) => `${v.replace('.', ',')};${t}`,
    eol: '\r\n',
  },
  tab: { header: 'Timestamp\tTemp', time: 'yyyy-MM-dd HH:mm', row: (t, v) => `${t}\t${v}` },
  // Logger ID on the first line, no header row, dotted dates.
  'id-line': { idLine: true, time: 'dd.MM.yyyy HH:mm', row: (t, v) => `${t},${v}` },
  haifa: {
    idLine: true,
    header: 'Date/Time,Temp',
    time: 'dd/MM/yyyy HH:mm',
    row: (t, v) => `${t},${v}`,
  },
};

/** @returns {DemoFile} */
function writeFile(logger, rows, { downloadDate, hideId }) {
  const format = FORMATS[logger.format];
  const lines = [];
  if (format.idLine && !hideId) lines.push(`Logger ID: ${logger.code}`);
  if (format.header) lines.push(format.header);
  for (const { ms, value } of rows) {
    const time = DateTime.fromMillis(ms, { zone: TIME_ZONE }).toFormat(format.time);
    const shown =
      value === 'ERR' ? 'ERR' : (logger.unit === 'F' ? (value * 9) / 5 + 32 : value).toFixed(1);
    lines.push(format.row(time, shown));
  }
  const eol = format.eol ?? '\n';
  const placed = logger.placements[0].fridge;
  const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const fileName = hideId
    ? `export_${downloadDate}.csv`
    : format.idLine
      ? `${slug(placed.branch)}-${slug(placed.name)}_${downloadDate}.csv`
      : `${logger.code}_${downloadDate}.csv`;
  return { fileName, content: Buffer.from(lines.join(eol) + eol), loggerCode: logger.code };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

/**
 * Sets up the registry from the plan and ingests the chosen weeks through the real pipeline.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ rawDir: string, plan: DemoPlan, weeks: number[] }} options
 * @returns {import('../ingest/ingest.js').FileReport[][]} reports per week ingested
 */
export function loadDemo(db, { rawDir, plan, weeks }) {
  const fridgeIds = new Map();
  for (const branch of plan.branches) {
    const { id } = createBranch(db, branch.name);
    for (const name of branch.fridges) {
      fridgeIds.set(`${branch.name}/${name}`, createFridge(db, { branchId: id, name }).id);
    }
  }
  for (const logger of plan.loggers) {
    const { id } = createLogger(db, { code: logger.code, unit: logger.unit });
    for (const p of logger.placements) {
      assignLogger(db, {
        loggerId: id,
        fridgeId: fridgeIds.get(`${p.branch}/${p.fridge}`),
        fromUtc: p.fromUtc,
      });
    }
  }
  return weeks.map((w) => ingestFiles(db, { rawDir, files: plan.weeks[w].files }));
}
