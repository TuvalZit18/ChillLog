# ChillLog: mockup brief for Google Stitch

## The app

ChillLog is a web app that monitors fridge temperatures for **Squanchy Bakery**, a chain of 12 bakery branches in Israel. Each fridge has a small temperature logger inside. Once a week the branch managers send the logger files to Summer, who runs operations. She uploads them here to see how every fridge is doing, spot problems, and answer the Ministry of Health inspector's question: *"When did this fridge go above 5°C, and for how long?"*

**The user:** Summer. She isn't technical, is between branches most of the day, and **mostly uses her phone**, sometimes outdoors in bright sunlight. She checks the app quickly several times a day.

## Design direction

- **Mobile-first.** Design every screen for a phone (about 390px wide) first, then a desktop version of the same screen.
- **Calm, clean, trustworthy.** It's a food-safety tool, not a marketing site. Plenty of whitespace, clear hierarchy, large readable numbers.
- **Readable in sunlight:** strong contrast, a body font size of at least 16px, big touch targets (at least 44px).
- **Color palette: leave it neutral.** Use a simple placeholder palette (greys plus one accent). The palette will be chosen later, so don't commit to brand colors.
- **Status is never shown by color alone.** Every status has an **icon + a word + a value**, for example "⚠ Alert · 7.1°C · 45 min". Keep this pattern consistent everywhere.
- **Native-feeling controls:** the phone's own date picker, simple dropdowns, simple file picker. No fancy custom widgets.
- **Times** always in Israel time, 24-hour format, e.g. "Mon 14 Sep, 06:45". Temperatures in °C with one decimal.

## Status vocabulary (use exactly these)

| Status | Meaning | Example label |
|---|---|---|
| OK | All readings at or below 5°C | "✓ OK · 3.9°C" |
| Alert | Above 5°C for longer than a door opening | "⚠ Alert · 7.1°C · 45 min" |
| Warming | Slowly rising trend, not above 5°C yet | "↗ Warming · 4.6°C, +0.8° in 24h" |
| Gap | Logger recorded nothing for a while | "⋯ Gap · 2h 15m missing" |
| No file | This week's file hasn't been uploaded | "✕ No file this week" |

Order of severity: Alert > Warming > Gap > No file > OK.

## Navigation

- **Phone:** bottom tab bar with 4 tabs: **Overview**, **Upload**, **Inspector**, **Loggers**.
- **Desktop:** the same 4 items in a left sidebar.
- App name "ChillLog" in a small top bar.

## Sample data (use it for realistic mockups)

Branches: Jerusalem, Tel Aviv, Haifa, Rishon LeZion, Be'er Sheva, Netanya, Herzliya, Ashdod, Petah Tikva, Ramat Gan, Holon, Kfar Saba.

Fridges per branch (2–4 each): Dairy, Walk-in, Cream cakes, Display 1, Display 2, Freezer.

Loggers are named like **TL-0512**, **TL-0417**, **TL-0231**, **TL-0388**.

Notable fridges this week:
- **Rishon LeZion · Cream cakes** (TL-0388): ⚠ Alert. It warmed slowly from 4.6°C to 7.1°C and has been above 5°C for 2 days.
- **Tel Aviv · Walk-in** (TL-0417): ✓ OK. One door-opening spike to 9.4°C for a single reading, which is ignored and not an alert.
- **Tel Aviv · Display 2**: ✓ OK. Logger TL-0417 was moved here from the Walk-in on 17 Sep.
- **Haifa · Dairy** (TL-0231): ⋯ Gap. 2h 15m missing on 14 Sep; some readings were "ERR".
- **Netanya · all fridges**: ✕ No file this week.
- **Jerusalem · Dairy** (TL-0512): ✓ OK · 3.9°C.

---

## Screen 1: Overview (home)

**Purpose:** "How is every fridge doing, and where is something wrong?" in 5 seconds.

- **Summary strip** at the top: counts per status, e.g. "1 Alert · 1 Warming · 1 Gap · 1 No file · 38 OK". Each count can be tapped to filter.
- **"Needs attention" section first:** cards for only the problem fridges, sorted by severity. Each card shows the branch, the fridge name, the status (icon + word + value), the latest reading and when it was taken ("latest 7.1°C · Sun 20 Sep, 23:45"), and a tiny sparkline of the last 7 days with the 5°C line.
- Then **"All branches"**: a list grouped by branch, collapsed by default. Each branch row shows its worst status and "3 fridges". Expanding it lists the fridges with their status.
- "Last upload: today 09:12" in small text.
- **Desktop:** the summary strip on top, then a grid of branch cards (3–4 columns), with problem fridges highlighted.

## Screen 2: Fridge detail

**Purpose:** see one fridge's history and exactly when it went wrong.

- Header: "Rishon LeZion · Cream cakes", logger "TL-0388", and a status badge.
- **Date range picker** with quick chips (Last 24h · 7 days · 30 days · Custom).
- **Line chart** of temperature over time:
  - a horizontal dashed **5°C limit line**, labelled "5°C";
  - **shaded bands** where the fridge was above 5°C (excursions);
  - **gaps shown as breaks in the line** (no line drawn across missing data), with a small "Gap 2h 15m" label;
  - a single door-opening spike visible but marked "door opening, ignored".
- Below the chart: **excursion list**, one card per excursion: "Started Fri 18 Sep 14:30 → Ended Sun 20 Sep 23:45 · Duration 2d 9h 15m · Peak 7.1°C".
- Small "Logger history" note: "TL-0417 moved from Walk-in to Display 2 on 17 Sep".
- Button: **"Inspector report for this fridge"**.

## Screen 3: Upload

**Purpose:** upload this week's logger files (one or many) and see what came in.

- A large **upload area**: "Choose files" button (phone) or drag-and-drop area (desktop). Hint: "CSV files from the loggers. You can pick many at once."
- After upload, a **per-file report list**, one card per file:
  - ✓ "TL-0512_2026-09-21.csv · Jerusalem · Dairy · 672 readings added"
  - ✓ with a warning: "TL-0231_2026-09-21.csv · Haifa · Dairy · 660 added · 3 ERR readings skipped · 1 gap (2h 15m)"
  - ↺ "TL-0417_2026-09-21.csv · 96 duplicates skipped (already uploaded)"
  - ⚠ "Temperatures look like °F. Check this logger's settings"
  - ❓ "export_0921.csv · **Needs logger assignment**" with a **"Choose logger"** button
- A summary line on top: "6 files · 3,410 readings added · 1 needs your help".

## Screen 4: Assign logger (dialog / bottom sheet)

**Purpose:** a file arrived without a logger ID; Summer picks it once.

- Bottom sheet on phone, centered dialog on desktop.
- File name, a preview of the first 3 rows (time + temperature).
- Dropdown: **Logger** (shows "TL-0417 · Tel Aviv · Display 2").
- Buttons: "Assign and process" (primary), "Cancel".

## Screen 5: Inspector report

**Purpose:** answer "when did this fridge go above 5°C, and for how long?". Summer might show this screen to the inspector on her phone.

- Filters: **Branch**, **Fridge** (or "All fridges"), **From** / **To** dates.
- A clear **answer sentence** at the top: "Rishon LeZion · Cream cakes was above 5°C **1 time** between 1 Sep and 21 Sep, for a total of **2 days 9 h 15 min**."
- **Table of excursions** (it becomes stacked cards on phone): Branch · Fridge · Started · Ended · Duration · Peak °C.
- A note under the table: "Single readings above 5°C (e.g. a door opening) are not counted. Gaps in data are listed separately."
- Buttons: **"Export CSV"** and "Share".

## Screen 6: Loggers (registry)

**Purpose:** a one-time setup of which logger is in which fridge. It replaces Summer typing branch and fridge by hand on every row.

- List of loggers: "TL-0417 · Tel Aviv · Display 2 · since 17 Sep", "TL-0231 · Haifa · Dairy · °F · date format DD/MM".
- Tapping a logger opens its **details**: current fridge, unit (°C / °F), date format, and **move history** (a timeline: "Walk-in → Display 2 on 17 Sep").
- A **"Move to another fridge"** action with a form: new branch, new fridge, "from date".
- An "Add logger" button.
- Secondary section: **Branches & fridges** list with an "Add fridge" action.

## States to include

- **Empty state** (first run, no data): friendly message plus an "Upload your first files" button.
- **Loading:** skeleton cards.
- **Error / weak signal:** "Couldn't load. Check your connection." with a **Retry** button.

## Deliverables

For each of the 6 screens: **one phone version + one desktop version**, in light mode. A dark mode version of the Overview is optional.
