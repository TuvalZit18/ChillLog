# ChillLog UI

The look and behaviour of the client, taken from the clickable mockup
([chilllog-mockup.html](chilllog-mockup.html)). Build the `feat/ui-*` branches from this.
The mockup's sample data is for show only; the real data comes from the server.

## Principles

- **Mobile first.** Summer uses her phone, often outdoors. Design at ~390px, then widen.
- **Status is never color alone.** Every status is **icon + word + value**, e.g. `⚠ Alert · 7.1°C · 2d 9h 15m`.
- **Readable in sunlight.** Body text 16px minimum, strong contrast, touch targets 44px minimum.
- **Native controls.** `<input type="date">`, `<select>`, `<input type="file">`, `<dialog>`. No custom pickers.
- **Calm and plain.** A food-safety tool: whitespace, clear hierarchy, big readable numbers. No decoration.
- **Times** in `Asia/Jerusalem`, 24-hour, e.g. `Mon 14 Sep, 06:45`. **Temperatures** in °C, one decimal.

## Design tokens

All colors are CSS variables in one tokens file. Components only use tokens, never raw hex values.

### Color: light (default)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F3F5F6` | Page background |
| `--surface` | `#FFFFFF` | Cards, top bar, nav, dialogs |
| `--sunken` | `#E8ECEE` | Skeletons, "no logger yet" chart area, neutral fills |
| `--ink` | `#14191D` | Main text |
| `--muted` | `#56606A` | Secondary text, axis labels |
| `--line` | `#D8DEE2` | Borders, dividers |
| `--accent` | `#0D6776` | Primary buttons, active nav, chart line, links |
| `--accent-ink` | `#FFFFFF` | Text on accent |
| `--accent-soft` | `#DCEDF0` | Active nav background, upload icon circle |
| `--grid` | `#E4E8EB` | Chart grid lines |
| `--band` | `rgba(176,39,31,0.10)` | Chart shading for time above 5°C |
| `--shade` | `rgba(20,25,29,0.14)` | Shadows (menus, dialogs, toast) |

### Color: dark

Same token names, redefined. Set `color-scheme: dark` wherever the dark palette applies.

| Token | Hex |
|---|---|
| `--bg` | `#0F1316` |
| `--surface` | `#171C20` |
| `--sunken` | `#20272C` |
| `--ink` | `#E6EAED` |
| `--muted` | `#9BA5AE` |
| `--line` | `#2B3339` |
| `--accent` | `#5CB8C7` |
| `--accent-ink` | `#06282E` |
| `--accent-soft` | `#163439` |
| `--grid` | `#232B30` |
| `--band` | `rgba(255,124,114,0.15)` |
| `--shade` | `rgba(0,0,0,0.5)` |

### Status colors

Status colors are separate from the accent. Each status has a strong color (icon + text) and a soft
color (pill background).

| Status | Light strong / soft | Dark strong / soft |
|---|---|---|
| OK | `#2B7535` / `#E3F1E4` | `#6CC77A` / `#173222` |
| Alert | `#B0271F` / `#FBE7E5` | `#FF7C72` / `#3A1916` |
| Warming | `#8F5500` / `#FAEED9` | `#F2B25C` / `#33260F` |
| Gap | `#1F5FA8` / `#E3EEF9` | `#7EB6F2` / `#16283B` |
| No file | `#4F5963` / `#E8ECEE` | `#A7B0B8` / `#20272C` |

Token names: `--ok`, `--ok-soft`, `--alert`, `--alert-soft`, `--warm`, `--warm-soft`, `--gap`, `--gap-soft`,
`--nofile`, `--nofile-soft`.

Gap was purple with a three-dots icon in the mockup. While building the UI I changed it to blue with
a broken-line icon (the same idea as the chart's line breaking at missing data); the blue stays
clear of alert red, warming amber, OK green, no-file grey and the teal accent. The mockup still
shows the old look. Contrast of strong on soft: 5.5:1 light, 7.0:1 dark.

### Typography

- **Sans:** IBM Plex Sans (400, 500, 600, 700), fallback `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- **Mono:** IBM Plex Mono (400, 500), fallback `ui-monospace, Consolas, monospace`. Used for logger IDs,
  file names, date formats and the raw-file preview.
- Self-host the fonts (no external requests at runtime); the fallbacks must still look fine.
- Numbers that line up (readings, durations, tables) use `font-variant-numeric: tabular-nums`.

| Role | Size / weight | Notes |
|---|---|---|
| Page title (h1) | 26px / 700 | letter-spacing -0.015em, `text-wrap: balance` |
| Section title (h2) | 18px / 600 | |
| Inspector answer | 20px / 500 | bold parts at 700 |
| Body | 16px / 400 | line-height 1.5 |
| Small / meta | 14px | `--muted` |
| Eyebrow (branch name, labels) | 13px / 600 | uppercase, letter-spacing 0.05–0.06em, `--muted` |
| Chart labels | 12px | |

### Spacing, radius, size

- **Page gutter:** 16px on phone, 32px on desktop. Content max width 1180px, centred.
- **Gaps:** 24px between sections, 12px inside a section, 10px between cards, 8px between chips.
- **Radius:** 8px controls and buttons · 12px cards · 16px dialogs (18px top corners on the bottom sheet) · 999px pills and chips.
- **Heights:** buttons and chips 44px · inputs and selects 46px · nav items 62px (phone) / 46px (desktop) · top bar 54px.
- Lay out groups with flex/grid and `gap`, not margins.

### Breakpoints (mobile-first `min-width`)

| Width | Change |
|---|---|
| 640px | Card grids go to 2 columns; excursion cards show 4 values in a row |
| 720px | Inspector results become a table (cards below this) |
| 880px | Bottom tabs become a left sidebar (224px); branch list becomes a card grid (3 columns); upload shows drag-and-drop text |
| 1100px | Fridge detail goes to two columns (chart left, lists right) |
| 1160px | Card grids go to 3 columns |
| 1240px | Branch grid goes to 4 columns |

## Theme: light, dark or system

The mockup follows the device setting only. The app adds a switch.

- **Options:** System (default), Light, Dark.
- **Where:** a theme button in the top bar, next to the app name. It opens a small menu with the three
  options, each with an icon and a word (sun · Light, moon · Dark, half-circle · System). The current
  one is checked.
- **How it works:**
  - System: no attribute on `<html>`; the palette follows `prefers-color-scheme`.
  - Light / Dark: set `data-theme="light"` or `data-theme="dark"` on `<html>`.
  - CSS: light tokens on `:root`; dark tokens in `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
    and again in `:root[data-theme="dark"] { … }`, so the choice wins both ways.
- **Remember it** in `localStorage` (key `chilllog.theme`). Read it in a tiny inline script in
  `index.html` before the app loads, so the page doesn't flash the wrong theme.
- If `localStorage` isn't available, fall back to System without an error.
- The menu is a native `<select>` or a simple button list. It must work by keyboard, with the
  current option announced to screen readers.

## App shell

- **Top bar** (`--surface`, bottom border): thermometer icon + "ChillLog" on the left, theme button on the right.
- **Phone:** bottom tab bar with 4 tabs, each an icon above a label: **Overview · Upload · Inspector · Loggers**.
  The active tab has accent text and an accent-soft pill behind the icon. The bar pads for the phone's safe area.
- **Desktop (≥880px):** the same 4 items in a left sidebar, icon beside label; the active item has an accent-soft background.
- Only the main area scrolls; the top bar and nav stay put.
- Fridge detail belongs to the Overview tab; logger detail belongs to the Loggers tab. Both have a
  "← Overview" / "← Loggers" back link at the top.

## Status system

| Status | Icon | Label pattern |
|---|---|---|
| Alert | triangle with ! | `Alert · 7.1°C · 2d 9h 15m` (peak, duration) |
| Warming | arrow up-right | `Warming · 4.6°C, +0.8° in 24h` |
| Gap | broken line | `Gap · 2h 15m missing` |
| No file | circle with × | `No file this week` |
| OK | check | `OK · 3.9°C` (latest reading) |

- **Severity order:** Alert > Warming > Gap > No file > OK. Lists are sorted worst first.
- **Status pill:** rounded, soft background, strong color for icon and text, 14px / 600, 16px icon.
- Icons are inline SVG line icons (24 grid, 2px stroke, round caps). No emoji.

## Components

- **Button:** 44px high, 8px radius, 15px / 600. *Primary* = accent background; *Secondary* =
  surface with a `--line` border; *Link* = accent text, no border.
- **Chip** (filters, date ranges): 44px pill with a border. Selected = `aria-pressed="true"` and a 2px `--ink` ring.
- **Status count chip** (Overview): status icon in its color + bold count + word, e.g. `✓ 31 OK`. Tapping filters.
- **Fridge card:** branch as eyebrow, fridge name 17px / 600, status pill, then "Latest 7.1°C · Sun 20 Sep, 23:45" on
  the left and a sparkline on the right. The whole card is a link. Same border and hover design as the branch
  cards: a problem glows in its status color, an OK card turns teal on hover/focus.
- **Sparkline:** 112×36, last 7 days, `--muted` line, dashed 5°C line in `--alert`, end dot in the status color.
  Fixed scale 1–8°C so cards compare.
- **Branch row (phone):** collapsible `<details>`: name, "3 fridges", worst status pill, chevron. Opens to one row per fridge.
- **Branch card (desktop):** name, then the branch's state in words next to its worst status's icon
  ("1 alert, 1 gap · 3 fridges", "All OK · 2 fridges"). OK fridges are one quiet line (icon, word and
  value, no filled pill); a problem fridge gets its filled pill on its own line. All cards are the
  same size. A branch with a problem glows in its worst status's color: a gradient border and a soft
  outer halo (fainter in light mode, stronger on hover/focus); all-OK cards stay plain, and on
  hover/focus take the accent (the active sidebar item's teal) as border and glow.
- **Temperature chart:**
  - Line in `--accent`, broken where readings are missing (no line drawn across a gap).
  - Dashed 5°C line in `--alert`, labelled "5°C" at the left axis.
  - Time above 5°C shaded with `--band`, labelled "Above 5°C · 2d 9h 15m" when there's room.
  - Gaps: a short `--gap` bar with "Gap 2h 15m" (or "No file").
  - A single reading above 5°C: open circle in `--warm` with "Door opening, ignored".
  - Time before the logger was in this fridge: `--sunken` area, "No logger in this fridge yet".
  - Touch or hover shows a guide line, a dot and a readout line above the chart: "Thu 17 Sep, 10:45 · 3.8°C".
  - A legend under the chart repeats every mark with its name.
  - X axis: every 6 h for 24 h, each day for 7 days, Mondays for 30 days.
- **Excursion card:** "Above 5°C · duration" pill, then Started · Ended · Duration · Peak as label/value pairs.
  If it's still going at the last reading: "Still above 5°C at the last reading in the file."
- **Upload file card:** round status icon + uppercase word (Added · Added, with notes · Already uploaded ·
  Held back · Needs your help), file name in mono, branch · fridge, result lines, and one action button when
  needed (Choose logger · Open logger settings · Open fridge).
- **Dialog:** native `<dialog>`. On phones (≤640px) it's a bottom sheet with a grab handle and full-width
  buttons; on larger screens it's centred, max 520px. Primary action on the right.
- **Form field:** 14px / 600 label above a 46px input; optional hint under it in 13px `--muted`.
- **Timeline** (logger move history): vertical line with dots, newest first; the current place has a filled accent dot.
- **Toast:** dark pill near the bottom (above the tab bar), plain sentence, disappears after ~3 s, `role="status"`.

## Screens

### Overview
1. Title "Every fridge, this week" + "Readings for Mon 14 Sep to Sun 20 Sep · Last upload Mon 21 Sep, 09:12".
2. Status count chips (Alert, Warming, Gap, No file, OK). Tapping one shows only those fridges; tapping again clears.
   Under them, **Branch** and **Type of fridge** dropdowns (type = the fridge name with its number dropped, so
   Display 1 and Display 2 are "Display"). They narrow the chips' counts and both sections below; each list only
   offers what the other allows. All three filters live in the URL (`?status=&branch=&type=`).
3. **Needs attention:** fridge cards for every non-OK fridge, worst first. When a whole branch has no file, show
   one card for the branch ("All 3 fridges · No file this week").
4. **All branches:** collapsible list (phone) or card grid (desktop).

### Fridge detail
Back link, branch eyebrow, fridge name, status pill, "Logger TL-0388 · Latest …". Range chips
(Last 24h · 7 days · 30 days · Custom → two date inputs). Chart card. Door-opening note. **Time above 5°C**
(excursion cards, or "None in this range"). **Gaps in data** (gaps + count of ERR readings). Logger history
note. Primary button **Inspector report for this fridge**.

### Upload
Title + last upload. Drop area: upload icon, "Choose files" button, hint "CSV files from the loggers.
You can pick many at once."; on desktop also "Drop CSV files here". While reading: "Reading 6 files…".
After: summary line ("6 files · 2,004 readings added · 2 need your help") and one card per file.

### Assign logger (dialog)
"Which logger is this file from?", file name, preview of the first 3 rows (time + temperature, as in the
file), **Logger** select ("TL-0417 · Tel Aviv · Display 2"), buttons Cancel / **Assign and process**.

### Inspector report
Filters: Branch (or All branches), Fridge (or All fridges), From, To. **Answer card** with one sentence:
"Rishon LeZion · Cream cakes was above 5°C **1 time** between 1 Sep and 21 Sep, for a total of
**2 days 9 h 15 min**." Then the list: table ≥720px (Branch · Fridge · Started · Ended · Duration · Peak °C),
cards below. Note: "Single readings above 5°C, such as a door opening, are not counted. Gaps in the data
are listed separately." Gaps section. Buttons **Export CSV** and Share.

### Loggers
Title + **Add logger**. List: logger ID (mono), current fridge, "since 17 Sep", tags for non-default
settings (°F, date format). **Branches and fridges** section with **Add fridge** per branch.

### Logger detail
Back link, logger ID. Details: current fridge, in this fridge since, unit, date format. Buttons
**Move to another fridge** (dialog: branch, fridge, from date) and **Change file settings** (dialog:
unit, date format). **Move history** timeline.

## States

- **Loading:** skeleton blocks in `--sunken` with a slow pulse (off with `prefers-reduced-motion`).
- **Empty (first run):** upload icon in a circle, "No readings yet", one line of help, button
  **Upload your first files**.
- **Can't connect:** crossed-out wifi icon, "Couldn't load", "Check your connection, then try again.
  Nothing you uploaded is lost.", button **Retry**.

## Copy and formats

- Date and time: `Mon 14 Sep, 06:45` · date only: `14 Sep` · day: `Mon 14 Sep`. Always Israel time.
- Temperature: `7.1°C` · change: `+0.8°`.
- Durations: short `2d 9h 15m`, `2h 15m`, `45 min`; long (inspector sentence) `2 days 9 h 15 min`.
- Buttons say what happens ("Assign and process", "Move logger", "Save settings").
- Errors say what went wrong and what to do, with no apologies.

## Accessibility

- Visible focus ring: 2px `--accent`, 2px offset.
- Every chart has a text summary (`aria-label`) and the lists under it carry the same facts.
- Every form control has a label and a stable `id`.
- Active nav item uses `aria-current="page"`; filter and range chips use `aria-pressed`.
- Respect `prefers-reduced-motion`.
