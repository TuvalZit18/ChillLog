# ChillLog: Notes

> Draft. Sections marked **[TO FILL]** get completed as the build progresses.
> Full reasoning for every decision: [`docs/architecture-and-stack.md`](docs/architecture-and-stack.md).

## Time spent

**[TO FILL]**
- Planning (understanding the brief, architecture, tech stack): ~[X] h
- Build: ~[X] h
- Docs & final checks: ~[X] h

## Decisions Summer didn't ask for, and why

**Removing her manual work**
- **Logger registry with move history.** Logger files contain only time + temperature; today Summer types logger, branch and fridge on every row. The registry is set up once, and a logger is linked to a fridge *from a date*, so the Tel Aviv logger moving to the display fridge splits its readings correctly.
- **Logger identified from the file automatically** (assumed: ID in the filename or a header line). If it can't be found, the file isn't rejected: it's stored and marked "needs logger assignment", and Summer picks the logger once with no re-upload.
- **Bulk upload with a per-file report** (rows accepted, duplicates skipped, ERR rows, gaps, unit warnings), so she knows immediately what came in and what didn't.

**Correctness (she repeats these answers to an inspector)**
- **Raw files kept unchanged** and every derived number is rebuildable from them. Fixing a parsing bug means re-running, not re-collecting files.
- **Re-uploading is always safe:** duplicate files and duplicate readings are detected and skipped.
- **Deterministic rules, no AI** in the answers: the same file always gives the same excursion times.
- **Times stored in UTC and always shown in Israel time**, including across the clock change, when an hour repeats and would otherwise silently drop readings.
- **DD/MM vs MM/DD detected per file**, and °F set per logger, with a warning when values look like the wrong unit instead of a silent guess.
- **Gaps shown as gaps.** The chart never draws a line across missing data, and zoomed-out charts keep every peak (min/max downsampling), so a short spike can't disappear.
- **"No file this week" is a status**, so a branch that forgot to send its file is visible too.

**Her day**
- **Mobile-first**, phone date pickers, status shown with icon + word + value (not color alone), readable in sunlight.
- **Excursion export (CSV)** for the inspector, escaped so it can't run as formulas when opened in Excel.
- **No push notifications.** Files arrive weekly, so an alert could only fire at upload time, when she's already looking. Catching a fridge "slowly dying for two days" needs more frequent data (see questions).

**Scope**
- **No login** in this version: it runs locally for one user. It's the first thing to add before real use.
- **Detection parameters** (all in one file, `shared/src/thresholds.js`):
  - **Above 5°C** means strictly above: 5.0 is fine.
  - **Excursion = 2 or more readings in a row above 5°C.** One reading alone is a door opening and is ignored, as the email says. It matches her sample: Tel Aviv's single 9.4 is fine, Rishon's 5.4 → 6.3 → 7.1 is not.
  - **Duration runs until the first reading back at or below 5°C**, not until the last reading above it, so the answer to the inspector never under-reports. An ERR reading doesn't end an excursion. A gap does, and then the end is the last reading above 5°C, marked as such. So is an excursion still going when the data stops.
  - **Gap = more than 1 hour without a valid reading** (4 or more missed 15-minute readings). ERR counts as missing. One or two missed saves stay quiet; her "couple of hours" is always caught.
  - **Slowly warming = the median of the last 24 hours is at least 0.5°C above the median of the 24 hours before.** Medians, so door openings can't trigger it. It needs at least 12 hours of data in each day, or it gives no verdict rather than a guess. On a Rishon-like fridge warming by 0.75°C a day, it flags about 20 hours before the fridge goes above 5°C.

## What I'd ask Summer before this goes live

**About the data**
- Your sheet is ~3,000 rows a week, but 12 branches × a few fridges × a reading every 15 minutes would be ~20,000+. Do some loggers record less often, or do you paste only part of the data?
- Does each logger file include the logger's ID (in the filename or inside the file)? I assumed yes.
- Do the loggers record Israel local time (changing with daylight saving) or a fixed time?
- Can someone confirm the Haifa logger's unit and date format? I assumed °F and day/month.

**About the rules**
- Is 5°C the limit for every fridge, or do some (e.g. freezers, cream cakes) differ?
- How long above 5°C counts as a real problem rather than a door opening?
- What warming pattern means "slowly dying" to you? Is there a past example besides Rishon?

**About how it's used**
- Could files come daily instead of weekly? That's what would have saved the Rishon dairy.
- Should branch managers upload their own files, or see only their branch?
- What does the inspector want to take away: on-screen, emailed list, printed report?
- **[TO FILL: questions that come up while building]**

## What's not done / what I'd do with one more hour

**[TO FILL at the end]**. Known deferred items so far:
- **Login** (single user) before any real use.
- **Hosting**, so Summer's phone works away from the laptop's network.
- **Automated backups** of the data folder.
- **Importing Summer's existing Excel sheet** to seed the registry and past readings.
- **Email ingestion**: branch managers' emails imported automatically, removing the upload step.
- **AI Assistant**: ask inspector-style questions in plain language, answered through read-only tools over the same detection code, with the underlying rows shown. Deferred because free AI APIs still need an account (conflicts with the brief). I'd ask you whether to add it.
- **Move to Postgres/MySQL** once hosted with multiple users.

## How I worked with AI tools

**[TO FILL]**
- One thing the AI got wrong or I rejected, how I caught it, where to see it: see [`docs/ai-log.md`](docs/ai-log.md) (commit + test references).
- Per-conversation summaries (what I asked, where I overrode the AI, what the AI did): [`docs/ai-sessions/`](docs/ai-sessions/).
- Instructions given to the tools: [`CLAUDE.md`](CLAUDE.md).

## Approach (optional)

- Decided the **architecture before any tools**, using my own `architecture-advisor` skill (context questions → decision tables with options, trade-offs, approval), then picked tools to serve each decision. Both are in `docs/architecture-and-stack.md`.
- Built in feature branches with self-merged PRs, one per module, so the history shows how it came together.
- **[TO FILL: anything else worth saying at the end]**
