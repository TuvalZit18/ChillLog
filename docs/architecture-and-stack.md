# ChillLog: Architecture & Stack

ChillLog is a fridge-temperature monitor for Squanchy Bakery (12 branches).

The architecture was decided first. Tools were then picked to serve each decision.
Each section: **Architecture** (what and why) → **Stack** (tools that implement it, alternatives rejected).
Summer's email is the whole spec; where it was open, the call is written down here.

## Context (the filters every decision was checked against)

| Input | Answer |
|---|---|
| User & platform | Summer, one non-technical user, mostly on her **phone**. Web app, **mobile-first**, responsive to desktop. "Run on a laptop" is how the reviewer starts it, not how Summer uses it |
| Scale | 12 branches, ~30–40 loggers, up to ~25k readings/week, history kept. Data volume is small; **fast, smooth phone experience is a hard requirement** |
| Run constraint | Clone → running in minutes, **one runtime, no Docker, no accounts, no paid services** |
| Correctness | Summer repeats the answers to a health inspector: re-uploads never duplicate, raw data never silently altered, same file → same answer |
| Team & time | Solo, 48 hours, partial submission acceptable |
| Inspector | Not a user. Summer answers him: on-screen answer (must), export (should), raw files kept with upload record (must) |
| Manual merge | Today Summer types logger/branch/fridge per row. The system must remove that work, not move it |

---

## 1. System shape & runtime

**Architecture:** **Modular monolith**: one process with modules `ingest`, `registry`, `normalize`, `detection`, `reporting`. Detection rules isolated so they can be tested and changed alone. Single frontend app.
- Rejected: browser-only app (data uploaded on the laptop wouldn't appear on her phone); microservices/serverless (solo developer, no ops capacity).

**Stack:** **Node.js 24 LTS** (works on ≥22.13), **JavaScript** on both sides, **Express 5**.
- JavaScript over TypeScript: my strongest language under a 48h deadline. The safety TS would give is covered by Zod schemas at the boundaries + JSDoc on core shapes (`Reading`, `Excursion`, `FridgeStatus`).
- Rejected: Python/FastAPI (second language/toolchain), Java Spring (second runtime, JDK + build tool), Fastify/Hono (performance irrelevant for one user; familiarity wins).

## 2. Data storage

**Architecture:** **Embedded relational database** (a single file inside the app).
- Unique key on (logger, timestamp) makes re-uploads idempotent through a constraint, not hand-written code.
- Registry, logger moves, excursions and status are naturally relational.
- **Precomputed derived tables** (excursions, fridge status), rebuilt at ingest in the same transaction, so the overview reads a small table instead of scanning readings, which serves phone speed. Not full CQRS: one store.
- Custom backend; BaaS rejected (needs an account or Docker). Time-series DB rejected (needs a server; indexing gains irrelevant at this size).

**Stack:** **SQLite** via Node's built-in **`node:sqlite`**, **raw SQL with prepared statements**, **numbered SQL migration files** run on start (applied files tracked in `schema_migrations`).
- **Why not MySQL/Postgres:** they're database servers: the reviewer would install/start one, create a DB and user, set credentials. Any mismatch (version, port taken, auth plugin) means the app doesn't start. SQLite is a library writing one file: no install, no credentials. It handles millions of rows (≈1.3M/year here) with full SQL, constraints and transactions. Its limits (many concurrent writers, several app servers) don't apply. When hosted with multiple users → move to Postgres/MySQL; plain SQL keeps that mostly a driver swap.
- **Why `node:sqlite` over `better-sqlite3`:** nothing to compile. `better-sqlite3` is a native addon that needs Python + a C++ toolchain when no prebuilt binary matches, the most common "clone and it fails" cause. Trade-offs accepted: experimental warning on start, Node ≥22.13, manual `BEGIN`/`COMMIT`.
- **Why raw SQL over Knex/ORM:** ~6 tables, parameterized by default, readable in review. Knex needs a native driver; Prisma is heavy; Drizzle is TS-first.

## 3. Raw files, upload & ingest flow

**Architecture:**
- **Raw uploads stored unchanged** on local disk, named by **content hash**, with a metadata row (upload time, logger, result). Private, served only via the app.
- **Synchronous processing** in the request. Each file is its own transaction, so one bad file doesn't fail a batch.
- **Per-file report** returned to Summer: rows accepted, duplicates skipped, ERR rows, gaps, unit warnings, unknown logger.
- **Single and bulk upload are one pipeline** (a single upload is a batch of one):
  - same file twice in one batch → caught by hash;
  - overlapping files from one logger → unique key keeps one copy, skipped count reported;
  - **unknown logger doesn't block the batch**: file is stored and returned as "needs logger assignment"; Summer picks the logger once and the stored file is processed with no re-upload.
- Idempotent ingest (hash + unique key): any retry or re-upload is safe.

**Stack:** **Multer** (in-memory) with limits on size, count and type → SHA-256 → skip if seen → write `raw/<hash>.csv` → parse.
- **Data directory can't fail on a fresh clone:** `server/data/` (raw files + DB), path resolved from the code's location (`import.meta.dirname`), created on startup (`mkdirSync recursive`), git-ignored, overridable via `DATA_DIR`.
- **Server is the only authority on files.** The frontend only does courtesy pre-checks (extension, size, count) to save a wasted upload on weak signal; the server repeats them.

## 4. Logger registry & normalization (the domain core)

**Architecture:**
- **Logger registry with move history:** a logger belongs to a fridge *from a date*, so a reading belongs to the fridge the logger was in *at that time* (TL-0417: Walk-in → Display 2). Set up once; replaces Summer's per-row typing.
- Logger identified automatically from the file; fallback is a one-time pick.
- Per-logger settings: unit (°C/°F) and date format.
- All business times computed on the server in **UTC**.

**Stack (all server-side):**
- **Papa Parse** for CSV: auto-detects delimiter (comma/semicolon/tab vary by Excel locale), quotes, header or no header. Rejected: csv-parse (manual delimiter), `split(',')` (breaks on quotes).
- **Column detection is our own code:** time column = parses as a date in most rows; temperature = numeric or `ERR`. Handles "the columns move around." Decimal commas normalized.
- **Luxon** for dates: explicit formats, built-in time zones. Rejected: date-fns (tz add-on), dayjs (tz plugin DST bugs).
- **DD/MM vs MM/DD:** per file; any first number > 12 → DD/MM, else default DD/MM (Israel); remembered per logger.
- **°F:** set per logger in the registry; a sanity check warns when values look like the wrong unit instead of guessing silently.
- **Daylight saving:** local times with no offset; on the clock-change night one hour repeats and the unique key would drop real readings. Convert from `Asia/Jerusalem` to UTC, resolve the repeated hour by row order. Covered by a named test.

## 5. Detection

**Architecture:** isolated module of plain, deterministic, unit-tested rules: excursions above 5°C (start, end, duration, peak), single-reading door spikes ignored, slow warming trend flagged, gaps flagged, missing weekly files flagged. Thresholds in one config.
- **Deterministic, no AI:** the same file must always produce the same inspector answer.

**Stack:** plain JavaScript functions, written **test-first**. Threshold constants live in `shared/` so server and UI agree.

## 6. API & validation

**Architecture:** **REST**, no versioning, single surface (frontend and backend ship together). Resources: uploads · loggers + assignments · fridges with status · readings by fridge + time range · excursions by fridge + range (+ CSV export).
- For phone speed: range-bound queries, overview reads precomputed status, **server-side downsampling** for long chart ranges.
- Rejected: GraphQL (one client), tRPC (TS-only benefit).

**Stack:**
- **Express 5** routes.
- **Zod** with schemas in `shared/`, used by both the Express routes and the client forms: one definition of "valid", enforced twice, server as authority. Validates API inputs (date ranges, registry forms, logger assignment). File contents are handled by the parser's rules and reported, not schema-rejected. Rejected: Joi, Yup, express-validator, hand-written checks.
- **Downsampling = min/max per time bucket:** averaging would smooth away a short spike, and a hidden peak is a false "all clear."

## 7. Auth, integrations, AI

**Architecture:** none in this submission. The app runs locally for one reviewer; auth sits in one middleware slot so it can be added without touching modules. No third-party integrations. No AI.

**Stack:** nothing added.

## 8. Frontend

**Architecture:** **client-side-rendered SPA served by the same Express process** (one process, one port). **Feature-based** code organization: overview, fridge detail, upload, logger registry, inspector report, plus `shared/`. Chart screen lazy-loaded.

**Stack:**
- **React + Vite.** Rejected: Next.js (SSR, would be a second server), CRA (deprecated).
- **React Router** (library mode). Filters live in the URL (`/fridges/:id?from=…&to=…`), so views can be bookmarked or shared.
- **Redux Toolkit + RTK Query:** my strongest stack; RTK Query covers server-state caching, loading/error states and invalidate-on-upload, so there's no separate data library.
- **react-hook-form + Zod resolver** for registry and assignment forms.
- **CSS Modules + design tokens (CSS variables) + native controls:** `<input type="date">` opens the phone's own picker, native `<dialog>`, native file input. Smallest bundle for phone speed. Rejected: Mantine (much bigger bundle, less phone-native picker), MUI (heavy), Tailwind (new to me under a deadline).
- **Recharts**: 5°C `ReferenceLine`, shaded excursions via `ReferenceArea`, **gaps drawn as breaks** (`connectNulls={false}`), since a line across missing data looks like "fridge was fine." Rejected: uPlot (imperative), Chart.js (annotation plugin), ECharts (heavy).
- **Dates:** API speaks ISO UTC; the frontend formats with built-in `Intl.DateTimeFormat`, **always in `Asia/Jerusalem`**, so a reviewer abroad sees the same times as the files. No date library on the client.
- **Design rules:** mobile-first CSS (`min-width` queries up to desktop); status never by color alone (icon + word + value, e.g. "Alert: 7.1°C, 45 min").

## 9. Caching & performance

**Architecture:** derived tables rebuilt in the ingest transaction (never stale) + client cache invalidated after a successful upload + hashed static assets. No TTLs anywhere, so an inspector answer is never stale. No server cache or CDN. Single instance, no rate limiting.

**Stack:** SQLite derived tables, RTK Query tag invalidation, Vite hashed builds.

## 10. Background jobs & resilience

**Architecture:**
- **No scheduler.** Files arrive weekly, so a notification could only fire at upload time, when Summer is already looking. The email asks for pull ("see, in one place"). "No file this week" and "logger silent" are computed on read against the current time.
- **Rebuild command** re-ingests all stored raw files: the recovery path after a bug fix or rule change.
- Resilience is minimal (no external dependencies): per-file isolation on upload; clear "couldn't load, retry" state on the client for weak signal.

**Stack:** a Node script (`npm run rebuild`).

## 11. Backup & recovery

**Architecture:** **raw files are the source of truth.** Readings, excursions and status are derived and rebuildable. Backup = copy the data folder (includes the registry, the only non-derived data).

**Stack:** nothing extra.

## 12. Security

**Architecture & stack:**
- Upload validation (size, type, count, clear rejection reasons), server-side.
- Parameterized SQL only.
- **CSV export escapes formula injection** (cells starting `=`, `+`, `-`, `@`), since Summer opens exports in Excel.
- No secrets needed; config via `.env` with safe defaults, `.env.example` committed.
- Server binds to localhost by default (see §15).

## 13. Testing

**Architecture:** unit-heavy on the domain core (parse, normalize, detect) + a few API integration tests; UI checked by hand. **Risk-based: one named test per messy case in the email**, so each requirement traces to a test. Test-first for detection rules.

**Stack:**
- **Vitest** (server + client). **Why not Jest:** the project is ES modules throughout; Jest's ESM support still needs experimental flags or a Babel transform. Vitest is native ESM with the same API.
- **Supertest** against the Express app with **in-memory SQLite** (fresh per test file).
- **Named CSV fixtures**: `haifa-fahrenheit-ddmm.csv`, `tel-aviv-logger-moved.csv`, `rishon-slow-warming.csv`, `door-spike-single-reading.csv`, `gap-two-hours.csv`, `err-values.csv`, `duplicates-and-out-of-order.csv`, `dst-repeated-hour.csv`. Test names quote the email.
- Coverage reported as a diagnostic, not a target.

## 14. Demo data

**Architecture:** the assignment says to invent data in whatever shape loggers produce, so the generator also **defines the assumed file format**. Every scenario in the email is built in on purpose.

**Stack:** plain Node script + tiny seeded random function (same seed → same data). Rejected: faker (not needed for temperatures).
- **Dates relative to the run date** (last 4 weeks, ending yesterday), so "no data this week" is correct whenever the reviewer runs it.
- 12 branches, 2–4 fridges each, ~35 loggers, 15-minute readings, registry seeded.
- Scenarios: Haifa °F + DD/MM; TL-0417 moved mid-week; varying columns/headers/delimiters; 2-hour gap; ERR; duplicates; out-of-order rows; single-reading door spikes (must not alert); Rishon Cream cakes slowly warming past 5°C over two days (must alert); one branch missing this week's file; one file with no logger ID ("needs logger assignment").
- Assumed format: logger ID in the filename (`TL-0417_2026-09-21.csv`), some files with it in a header line instead.
- `npm run seed` ingests weeks 1–3 through the real pipeline and leaves this week's files in `samples/upload-me/` for the reviewer to upload from the UI or a phone. Generated files are git-ignored.

## 15. Repo, run & network

**Architecture:** monorepo, one runtime, one command to run, CI on every push. Localhost by default, with an optional LAN mode for testing on a real phone.

**Stack:**
- **npm workspaces**: `client/`, `server/`, `shared/`. Rejected: pnpm/Turborepo (extra install for the reviewer).
- Scripts: `npm start` (build client → migrate → serve on one port), `npm run seed`, `npm run dev` (Vite proxying `/api` + server via **concurrently**), `npm test`, `npm run rebuild`.
- Built-in Node instead of packages: `node --watch` (no nodemon), `--env-file-if-exists=.env` (no dotenv).
- ESLint (flat config) + Prettier, light.
- **GitHub Actions:** `npm ci` → `npm test` → `npm run build`, Node from `.nvmrc`.
- LAN flag exposes the app to the local network; README warns it's unauthenticated.

## 16. Working process

- **GitHub, public from the first push.**
- **Feature branches + self-merged PRs**, one per module/feature (mirrors the modular monolith). `type/scope` names. **Merge commits, not squash**, to keep the real history. CI must pass before merge. PR template: *What · Decisions made · Tests · AI notes*.
- Planned sequence: `chore/scaffold` → `feat/db-migrations` → `feat/registry` → `feat/ingest` → `feat/detection` → `feat/api` → `feat/seed-generator` → `feat/ui-overview` → `feat/ui-fridge-detail` → `feat/ui-upload` → `feat/ui-inspector` → `docs/notes-readme`.
- **Conventional Commits**; history never rewritten.
- **AI traceability:** failing test committed first → fix committed → entry in `docs/ai-log.md`.
- **AI session summaries:** at the end of each AI conversation, `docs/ai-sessions/NNN-<topic>.md` (what I asked, what I decided, where I overrode the AI, what I didn't like, what the AI did).
- `CLAUDE.md` holds the instructions for AI tools.
- **Fresh-clone test** before sending: clone to a new folder, follow the README word for word.
