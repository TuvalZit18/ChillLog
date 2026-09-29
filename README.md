# ChillLog

Fridge temperature monitor for Squanchy Bakery's 12 branches. Upload the week's logger files and see
how every fridge is doing, and answer the health inspector's question: _"when did this fridge go
above 5°C, and for how long?"_

## You need

- **Node.js 22.13 or newer** (24 LTS recommended). Check with `node -v`; get it from
  [nodejs.org](https://nodejs.org).
- **git**.

Nothing else: no database server, Docker, accounts, paid services or internet connection while it
runs. The same commands work on Windows, macOS and Linux.

## Run it (about 3 minutes)

**1. Get the code**

```sh
git clone https://github.com/TuvalZit18/ChillLog.git
cd ChillLog
```

**2. Install**

```sh
npm install
```

Takes about a minute. It ends with `found 0 vulnerabilities`.

**3. Load the demo data**

```sh
npm run seed
```

Creates 12 branches, 30 fridges and 3 weeks of readings, ending with `Demo data ready…`. The latest
week's 28 files are left in `samples/upload-me/` for you to upload yourself in step 5, the way Summer
would. Two notices are normal: `../.env not found. Continuing without it.` and a warning that SQLite
is an experimental feature in Node.

**4. Start the app**

```sh
npm start
```

Builds the screens, then prints `ChillLog running at http://127.0.0.1:3000`. Open
**http://127.0.0.1:3000** in your browser. Leave the terminal open; `Ctrl+C` stops the app.

**5. See it work (2 minutes)**

1. The **Overview** shows every branch as "No file this week": the week it shows (last Monday to
   Sunday) hasn't been uploaded yet.
2. Go to **Upload**, click **Choose files**, open the `samples/upload-me` folder and select **all 28
   files**. You get one card per file saying what happened.
3. One card says **Needs your help**: `export_….csv` has no logger ID. Click **Choose logger**, pick
   **TL-0602 · Netanya · Drinks** and click **Assign and process**.
4. Back on the **Overview**: an alert, a fridge warming up, two gaps and a branch that sent nothing.
5. Open **Rishon LeZion · Cream cakes**: the fridge "slowly dying for two days", above 5°C for 1 day
   10 hours. Then click **Inspector report for this fridge** for the one-sentence answer and the CSV
   for Excel.

## Where each case from Summer's email shows up

After step 5, every messy case from the email can be seen in the app:

| From the email                                  | Where to look                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The old logger in Haifa shows the numbers differently" | Loggers → **TL-0231** is tagged **°F**; its file (Haifa · Dairy) is converted to °C. Its upload card also counts 2 ERR readings.                                |
| "We moved one of the Tel Aviv loggers into the new display fridge" | Loggers → **TL-0417** → move history: Walk-in, then Display 2 from Wednesday. Each fridge's chart gets the readings from its own dates.       |
| "The files don't look quite the same… the columns move around" | The 28 files use six layouts: commas, semicolons with decimal commas, tabs, different date formats, the logger ID in the name or on the first line. All read the same. |
| "Sometimes there's a gap of a couple of hours"   | **Jerusalem · Dairy**: "Gap · 2h 15m" on the Overview (on Monday; pick **30 days** on its page to see the break in the chart). **Ashdod · Dairy**: the file stops on Thursday ("the battery ran out"). |
| "someone opens the door… a jump for one reading, which is fine" | Any fridge's page: single high readings are orange circles on the chart ("Door opening") and listed as "ignored as a door opening"; they never count as time above 5°C. |
| "A fridge that's slowly warming up is not fine" | **Rishon LeZion · Cream cakes** crossed 5°C (Alert). **Petah Tikva · Display 1** is still below 5°C but rising (Warming).                                              |
| A branch that forgot to send its file            | **Beersheba**: "No file this week".                                                                                                                                     |
| A file with no logger ID                         | `export_….csv` on the Upload screen: "Needs your help" until you choose the logger.                                                                                    |
| The same file uploaded twice                     | Upload any file again: "Already uploaded. Nothing added."                                                                                                               |

## Stopping and starting again

- `Ctrl+C` in the terminal stops the app. `npm start` starts it again; your data is kept in
  `server/data/`.
- Run `npm run seed -- --reset` to start over with fresh demo data (it deletes what's in
  `server/data/`). Do this too **if a new Monday has passed**: the demo is dated from the day you
  seeded it, so a week later the Overview moves on to a week with no files.

## Optional: try it on your phone

1. Copy `.env.example` to `.env` (`copy .env.example .env` on Windows, `cp .env.example .env`
   elsewhere) and change `HOST=127.0.0.1` to `HOST=0.0.0.0`.
2. Run `npm start` again.
3. On a phone on the same Wi-Fi, open `http://<your-computer's-IP>:3000`. Find the IP with
   `ipconfig` (Windows), `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).

There is no login, so only do this on a network you trust.

## If something goes wrong

- **Port 3000 is already in use:** create `.env` as above and set another `PORT`, e.g. `PORT=3001`.
- **`npm run seed` says the database already has data:** use `npm run seed -- --reset`.
- **Errors mentioning `node:sqlite`:** Node is too old. Check `node -v` (needs 22.13 or newer).
- **Every branch says "No file this week" days later:** a new week started; run
  `npm run seed -- --reset` and upload `samples/upload-me/` again.

## For developers

```sh
npm run dev       # API + Vite dev server with hot reload (http://localhost:5173)
npm test          # server and client tests (Vitest)
npm run lint      # ESLint
npm run rebuild   # re-derive every reading from the stored raw files
```

- `client/`: React + Vite screens. `server/`: Express API, SQLite (built into Node), detection.
  `shared/`: thresholds and validation used by both.
- Decisions and the questions for Summer: [NOTES.md](NOTES.md). Every architecture and tool choice:
  [docs/architecture-and-stack.md](docs/architecture-and-stack.md). UI spec:
  [docs/design/ui.md](docs/design/ui.md). API reference with real examples:
  [docs/api.html](docs/api.html).
- How the AI tools were used: [docs/ai-log.md](docs/ai-log.md), [docs/ai-sessions/](docs/ai-sessions/)
  and the instructions they followed, [CLAUDE.md](CLAUDE.md).
