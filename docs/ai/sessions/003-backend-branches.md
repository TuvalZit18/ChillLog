# AI Session 003: The backend, branch by branch

- **Date:** 2026-09-28 ~09:50 → 12:40 (Israel time)
- **Tool:** Claude Code (VS Code extension), Claude Opus 5.5
- **Outputs:** the whole server side: SQLite migrations, logger registry, ingest pipeline (normalize, upload,
  rebuild), detection rules and derived tables, the REST API, and the demo data generator. `docs/ai/ai-log.md` entry #1.
  NOTES.md: detection parameters, the overview's week, early-stopping files.
- **Branches / PRs:** `feat/db-migrations` → PR #6 · `feat/registry` → PR #7 · `feat/ingest` → PR #8 (3 commits) ·
  `feat/detection` → PR #9 (2 commits) · `feat/api` → PR #10 (5 pieces, plus the ai-log test and fix) ·
  `feat/seed-generator` (this file is committed on it)
- **Tests at the end:** 159 passing (server), lint and Prettier clean
- **Next:** `feat/ui-overview`, the first client branch

## What I asked for
1. Show me the plan of work from the first conversation again.
2. Confirm that until step 8 (`feat/ui-overview`) we work only on the backend and don't touch the frontend.
3. Start, and go branch by branch in the §16 order: `feat/db-migrations`, `feat/registry`, `feat/ingest`,
   `feat/detection`, `feat/api`, `feat/seed-generator`. After each piece: stop, give me a commit name and description,
   and wait for me to commit, merge and say "continue".
4. For each commit, only the commit name and description, not a PR description.
5. Why did no CI run on the last two PRs, when before the `ci.yml` change I saw a spinner before merging?
6. Before committing the seed branch: write this session log on the same branch, so it needs no separate PR.

## What the AI did (short)
- Recapped the §16 branch plan and confirmed: steps 2–7 are server only; `shared/` gets schemas and thresholds but
  no client code changes until step 8.
- **Decisions I made when asked** (AskUserQuestion), each with a recommendation:
  - `feat/db-migrations`: runner + core tables now; derived tables later in their own migration.
  - `feat/ingest`: the upload route (Multer) goes to `feat/api`; the rebuild command stays in `feat/ingest`.
  - `feat/detection`: excursion = 2+ readings in a row above 5°C (one alone is a door opening); duration runs to the
    first reading back at or below 5°C; warming = 24 h median up ≥ 0.5°C on the 24 h before; gap = more than 1 hour
    without a valid reading, ERR counts as missing.
  - `feat/api`: 5 pieces; "this week" = the last full Mon–Sun week in Israel time; a file that stops early is a gap.
- **Built, test-first where the rules are:**
  - `feat/db-migrations`: `node:sqlite`, numbered `.sql` files each in its own transaction, core tables with
    `(logger_id, ts_utc)` as the readings key.
  - `feat/registry`: branches, fridges, loggers (unit, date format), move history, `fridgeAt(logger, time)`.
  - `feat/ingest`: normalize (delimiter, moving columns, DD/MM vs MM/DD per file, decimal commas, ERR, °F, the repeated
    hour when the clocks go back), the pipeline (hash, raw file kept unchanged, logger from a header line or file name,
    per-file report, "needs logger" and "held back" flows), and `npm run rebuild`.
  - `feat/detection`: pure rules with thresholds in `shared/`, then derived tables (excursions, door spikes, gaps,
    fridge status) recomputed in the same transaction as each upload.
  - `feat/api`: registry routes with shared Zod schemas and one error handler; uploads (bulk, preview, assign, retry,
    auto-retry when a logger is added or its settings change); the weekly overview; the fridge page with min/max
    downsampling; the inspector report with an Excel-safe CSV export.
  - `feat/seed-generator`: deterministic demo data for 12 branches / 30 fridges / 30 loggers, with every case from
    the email placed on her own sample rows, and `npm run seed` (refuses to overwrite data unless `--reset`).
- Named tests quote the email throughout; every generated fixture's expected values were worked out by hand first.
- Ran live checks after each piece against a scratch `DATA_DIR`: server start, real API calls, a real multipart
  upload with `curl`, the CSV download's bytes, and the full seed → upload → overview flow.
- **CI question:** found that CI did run on PRs #6 and #7 and passed, but each PR was merged 3–5 seconds after its run
  started. The spinner I used to see came from the old push-on-every-branch trigger, which PR #4 limited to `main`.
  Nothing ever blocked a merge: `main` has no branch protection. Suggested requiring the `test` check (a GitHub setting).
- **ai-log #1:** while writing the upload API tests, found a bug in merged `feat/ingest` code: a re-uploaded file
  reported the readings "added" the first time. Stopped, wrote a focused failing test, had me commit it (`1c7c018`),
  then fixed it (`a7f81ea`) and wrote the log entry.

## Where I overrode or corrected the AI
| AI proposed | I said | Result |
|---|---|---|
| Gave a commit message **and** a full PR description | I only asked for the commit name and description | Only commit name + description from then on |
| Explained CI with the triggers as they are now | "You don't understand: before the change I saw CI on every PR" | AI diffed PR #4 and found `branches: [main]` removed the branch-push run; the PR run still ran, just after I'd merged |
| Asked how to handle `1c7c018`, which carried the unfinished upload work along with the test | "Wait, do you want a new branch, a commit, or a PR now?" | AI explained in plain steps: same branch, keep the commit, fix next; I agreed |
| Planned the session log for the end of the conversation, on its own branch | Put it on `feat/seed-generator` so it needs no extra PR | This file is on the seed branch |

## What I didn't like
- **The CI explanation took three rounds.** The AI first answered from the current config instead of comparing it
  with what changed, so it didn't match what I had actually seen.
- **Answering more than I asked:** a PR description when I asked for a commit message.
- **Repeated slip with an invisible character:** the AI typed a raw byte-order mark into code three times. Caught each
  time before a commit (lint, then a byte scan it added), but it kept happening.
- **Test mistakes the AI had to fix itself:** a clock-arithmetic slip in a warming test, a guessed value for seeded
  data, a wrong logger count, and test data that accidentally reused another file's bytes. All caught before handover.
- **Messy live checks:** two command mistakes (cutting a seed run short with `Select-Object`, and PowerShell's reserved
  `$args`) made results look wrong until rerun.

## Deferred / open
- **Branch protection** on `main` with the `test` job required. If turned on, docs-only PRs need CI to run on
  `pull_request` too (drop `paths-ignore` there), or they'll wait forever for a check that never comes.
- **Known limit:** a file is recognized as already uploaded by its content alone, so byte-identical files claiming two
  different loggers would count once. Real files from different loggers practically never match; not in NOTES.md yet.
- **For the client branches:** the logger move endpoint recomputes both fridges; saving logger settings and adding a
  logger return the retried files (`retried`); overview cards carry a `sparkline`; the fridge page's status pill is
  always the last full week.
- **Demo choices to mention in the README:** the demo weeks end last Sunday (not "yesterday") so the last week is the
  overview's "this week"; TL-0417 moves on Wednesday 18:00; a Petah Tikva fridge warms without passing 5°C.
- Still open from 002: fonts (self-host IBM Plex or not), theme switch placement, the freezer question for Summer,
  and the `gh` CLI (the AI read CI status from GitHub's public API instead).
