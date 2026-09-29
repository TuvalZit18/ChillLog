# ChillLog: testing

> What is tested, where the tests are, how to run them, and how to write new ones. The decisions
> behind it are in [architecture-and-stack.md](../architecture/architecture-and-stack.md) §13.

## At a glance

- **313 tests, all passing:** 162 on the server (14 files) and 151 on the client (11 files).
- **One tool: [Vitest](https://vitest.dev/)**, for server and client alike. It speaks ES modules
  natively, which the whole project uses. Server API tests add **Supertest**.
- **No config files:** Vitest's defaults apply. It runs every `*.test.js` file in Node (no browser).
- **Run on every pull request by CI**, together with lint and the build
  ([git-and-ci.md](git-and-ci.md)).

## What we test, and what we don't

The tests follow the risk: the parts that decide what Summer tells the inspector are tested hardest.

| Layer | Tested how | Why |
| --- | --- | --- |
| **Reading files** (`server/src/normalize/`) | Unit tests with real-looking CSV fixtures | Every messy file from the email must be read correctly |
| **Detection rules** (`server/src/detection/`) | Unit tests, **written before the rules** | The inspector's answer comes from them; same input must give the same answer |
| **Ingest, registry, derived tables** | Tests against a real in-memory SQLite database | Re-uploads, moves and rebuilds must never lose or double readings |
| **The API** | Supertest against the real Express app (`createApp`) | Each endpoint's input checks, answers and errors, end to end |
| **Client logic** (`client/src/**/…Model.js`, `format.js`, `status.js`) | Unit tests of the pure functions | Wording, filters, sorting, dates in Israel time |
| **React components and screens** | **Not unit-tested.** Checked in a real browser at phone and desktop width, light and dark | Their logic lives in the tested models; what's left is layout, which a test without a browser can't see |

**Not set up:** browser (end-to-end) tests and coverage reports. The architecture treats coverage as a
diagnostic, not a target; to add it, install `@vitest/coverage-v8` and run `vitest run --coverage`.

## Where the tests are

```text
server/test/
├── normalize.test.js          Reading messy files: columns, dates, °F, ERR, duplicates, clock change
├── detection.test.js          The rules: excursions, door spikes, gaps, slow warming
├── registry.test.js           Branches, fridges, loggers, moves
├── ingest.test.js             Uploads: hashes, re-uploads, waiting files, rebuild
├── derived.test.js            Derived tables stay in step with readings and moves
├── migrations.test.js         Migrations run once, in order, and roll back on failure
├── seed.test.js               The demo data contains every scenario from the email
├── csv.test.js                The inspector CSV export (including Excel formula safety)
├── health.test.js             The app starts and answers
├── api-*.test.js              One file per API resource: uploads, registry, overview, fridges, inspector
├── week-file.js               Helper: a steady week of readings, for "where does the week end" tests
└── fixtures/                  Named CSV files, one per messy case (below)

client/src/
└── …/xModel.test.js           Next to the file it tests, e.g. features/overview/overviewModel.test.js
```

**Rule:** server tests live in `server/test/`, one file per module or API resource. Client tests sit
**next to** the file they test, with the same name plus `.test.js`.

## Running them

| Command | Runs |
| --- | --- |
| `npm test` | Everything, server then client (what CI runs) |
| `npm test -w @chilllog/server` | Server only |
| `npm test -w @chilllog/client` | Client only |
| `npx vitest run --root server test/detection.test.js` | One server file |
| `npx vitest run --root client src/features/overview/overviewModel.test.js` | One client file |
| `npx vitest --root server` | Watch mode: re-runs on every save |

To run only tests whose name contains a word: `npx vitest run --root server -t "gap"`.

Tests don't need the app running, a seeded database or internet: each test file builds what it needs.

## How the tests are written

### Named after Summer's email

Every messy case in the email has a test whose name **quotes the line it proves** (51 tests do), so
each requirement can be traced to a test by searching for her words:

```js
it('"someone opens the door for a delivery and you see a jump for one reading, which is fine": one reading above 5°C is not an excursion', () => {
```

Other tests say the rule in plain words: `'exactly 5.0°C is not above five degrees'`.

### Named CSV fixtures

`server/test/fixtures/` holds one small file per messy case, named after what's in it:

| Fixture | The case |
| --- | --- |
| `haifa-fahrenheit-ddmm.csv` | "The old logger in Haifa shows the numbers differently" (°F, day first) |
| `tel-aviv-logger-moved.csv` | A logger moved to another fridge mid-week |
| `columns-swapped-semicolon.csv` | "The columns move around" (and semicolons with decimal commas) |
| `gap-two-hours.csv` | "A gap of a couple of hours" |
| `err-values.csv` | Readings the logger wrote as `ERR` |
| `duplicates-and-out-of-order.csv` | Repeated and shuffled rows |
| `door-spike-single-reading.csv` | One reading above 5°C: a door opening, not an excursion |
| `rishon-slow-warming.csv` | Rishon's cream cakes fridge warming slowly past 5°C |
| `dst-repeated-hour.csv` | The clock-change night, when one hour happens twice |

A new file quirk gets a new named fixture, not an edit to an existing one.

### A fresh database per test

Tests that touch data open **their own in-memory SQLite database** and a temporary folder for raw
files, and throw both away afterwards. Tests never share data and never touch `server/data/`.

```js
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-raw-'));
});
afterEach(() => {
  db.close();
  fs.rmSync(rawDir, { recursive: true, force: true });
});
```

They build the setup they need with the real code (`createBranch`, `createLogger`, `ingestFile`…), so
they test the same path the app uses.

### A pinned clock

"This week" and "no file this week" depend on today's date, so tests never use the real clock.
`createApp` takes a `now` function, and tests pass a fixed moment:

```js
const MONDAY_MORNING = new Date('2026-09-21T06:12:00Z');
const api = (now = MONDAY_MORNING) => request(createApp({ db, rawDir, now: () => now }));
```

The same test gives the same result on any day and in any time zone.

### Test first

- **Detection rules and bug fixes are written test-first:** write the test, run it, **see it fail for
  the right reason**, then write the code until it passes.
- The failing run is seen locally (and noted in the AI conversation when the AI writes it), but it's
  **never committed on its own**: the test and the code that makes it pass go in one commit
  ([git-and-ci.md](git-and-ci.md)).
- When the AI got something wrong, the test that caught it is named in the [AI log](../ai/ai-log.md).

## Adding a test: where does it go?

| You're changing… | Add a test in… |
| --- | --- |
| How a file is read (a new column layout, date or unit quirk) | `server/test/normalize.test.js`, with a new fixture in `fixtures/` |
| A detection rule or threshold | `server/test/detection.test.js`, **first** |
| What an upload, move or rebuild stores | `server/test/ingest.test.js` or `derived.test.js` |
| An API endpoint | `server/test/api-<resource>.test.js` |
| A table (a new migration) | `server/test/migrations.test.js`, plus the module's own tests |
| Client wording, filters, sorting or URL state | The feature's `xModel.test.js` (move the logic into the model if it's in a component) |
| Date, temperature or duration formatting | `client/src/shared/format/format.test.js` |
| Only layout or styling | No unit test: check it in the browser at phone and desktop width, light and dark |

## Before you commit

- `npm test` passes, and so do `npm run lint` and `npm run build`.
- A new messy case from the email has a named test (quoting the email) and, if it's about files, a
  named fixture.
- A bug fix has a test that failed before the fix.
