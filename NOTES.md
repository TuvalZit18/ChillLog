# ChillLog: Notes

> Full reasoning for every decision: [`docs/architecture-and-stack.md`](docs/architecture-and-stack.md).
> How to run it: [`README.md`](README.md).

## Time spent

- Planning (understanding the brief, architecture, tech stack, UI mockup): ~[X] h
- Build (backend, then the five screens): ~[X] h
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
- **"This week" is the last full Monday–Sunday week in Israel time**, because files arrive on Monday for the week before. Earlier weeks can be picked.
- **A file that stops early is a gap to the end of the week**, so a logger that died on Thursday doesn't look fine for the whole week.

**Her day**
- **Mobile-first**, phone date pickers, status shown with icon + word + value (not color alone), readable in sunlight.
- **Excursion export (CSV)** for the inspector, escaped so it can't run as formulas when opened in Excel.
- **No push notifications.** Files arrive weekly, so an alert could only fire at upload time, when she's already looking. Catching a fridge "slowly dying for two days" needs more frequent data (see questions).

**Made while building**
- **Missing time after the last reading only counts as a gap up to the end of the last full week.** Files arrive on Monday for the week before, so on a Monday every fridge would otherwise show a "gap" until now. The fridge page says "Readings after Sun 27 Sep arrive with next Monday's files" instead.
- **The inspector answer never calls a fridge with no readings "not above 5°C".** It says there are no readings for that range, so missing data can't look like a clean record.
- **Files waiting for Summer stay listed** on the Upload screen (no logger ID, or held back) until she handles them, with no re-upload.
- **Moves and settings are checked before sending**, so errors use Israel dates ("Pick a date after 23 Sep…") instead of a UTC timestamp.
- **Branch cards reviewed against the [Laws of UX](https://lawsofux.com/)**: OK fridges are one quiet line, problems keep filled badges, each branch says its state in words ("1 alert, 1 gap · 3 fridges"), and a branch with a problem glows in its worst status's color.
- **A Setup screen** (add logger / fridge / branch, move a logger, file settings). The first plan had no branch for it, but without it the registry could only be changed through the API. It has two tabs, Loggers and Branches and fridges, rather than a fifth nav item: both are setup Summer does a few times a year, and a fifth tab would squeeze the phone's bottom bar.

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

**Questions that came up while building**
- Can one fridge have two loggers at the same time (e.g. a spare left inside)? The app allows it and combines their readings; if it's always a mistake, I'd block it.
- When a logger moves, do you know the time, or only the day? Moves are recorded from a date.
- Is "last full Monday–Sunday week" the right first view, or would you rather see "the last 7 days"?

## What's not done / what I'd do with one more hour

**With one more hour**
- **Keep the upload report when Summer leaves the page.** Today it lives in the Upload page, so opening a fridge from the report and coming back shows an empty screen (the files themselves are saved; files still needing her stay listed).
- **Block, or at least warn about, a second logger in the same fridge** (see the question above).
- **Try it on a real phone.** Every screen was checked with screenshots at phone width (390 px) in light and dark, but not by hand on a device; touch on the chart and the Share button are untested.

**Deferred on purpose**
- **Login** (single user) before any real use.
- **Hosting**, so Summer's phone works away from the laptop's network.
- **Automated backups** of the data folder.
- **Importing Summer's existing Excel sheet** to seed the registry and past readings.
- **Email ingestion**: branch managers' emails imported automatically, removing the upload step.
- **AI Assistant**: ask inspector-style questions in plain language, answered through read-only tools over the same detection code, with the underlying rows shown. Deferred because free AI APIs still need an account (conflicts with the brief). I'd ask you whether to add it.
- **Move to Postgres/MySQL** once hosted with multiple users.

## How I worked with AI tools

I used Claude Code for the whole build, with fixed rules in [`CLAUDE.md`](CLAUDE.md): the architecture is decided and not reopened, one branch per feature, stop after each commit-sized piece, narrate every action, and **the AI never commits**: I made every commit and merge by hand.

**One thing it got wrong, how it was caught, where to see it**
- The fridge page and the inspector counted missing data up to "now", so every Monday, before the week's files are due, every fridge showed a gap (a healthy fridge got "Gap · 19h 36m"), and the overview disagreed with them. It was caught by screenshotting the new fridge page against the demo data. Tests were written first and shown failing, then fixed in one commit: **`f75c5cb`**, tests in `server/test/api-fridges.test.js` (`"Once a week each branch manager downloads the logger's file" …`). Full entry: [`docs/ai-log.md`](docs/ai-log.md) #2; entry #1 is an earlier bug (a repeated upload reported readings added).

**Where I rejected or changed its output**
- **Process:** it wanted each fix on its own branch and the failing test in its own commit (CLAUDE.md said so); I chose fixes on the current branch and tests committed with their fix, and it recorded that in the log.
- **Design:** I rejected its Gap look (purple, three dots → blue, broken line), sent it to review the branch cards against the Laws of UX, replaced its card border with a glow design, and pointed out uneven card heights and dividers crossing the border, which it then fixed.
- **Caught by me in use:** the upload report disappearing when leaving the page (left as a known gap above).

Per-conversation summaries (what I asked, where I overrode it, what it did): [`docs/ai-sessions/`](docs/ai-sessions/).

## Approach (optional)

- Decided the **architecture before any tools**, using my own `architecture-advisor` skill (context questions → decision tables with options, trade-offs, approval), then picked tools to serve each decision. Both are in `docs/architecture-and-stack.md`.
- Built in feature branches with self-merged PRs, one per module, so the history shows how it came together.
- **Test-first where there's logic** (detection, gaps, time zones, wording): ~290 tests, each messy case from the email named after the line it quotes.
- **Every screen checked in a real browser** before committing: headless Edge driven against freshly seeded demo data, at phone and desktop width, in light and dark. That's how the gap bug above was found.
