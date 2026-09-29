# ChillLog: security

> The decisions are in [architecture-and-stack.md](architecture-and-stack.md) §7 (Auth) and §12
> (Security). This page is the whole picture: what is protected today, what isn't, and what must
> happen before real use.

## The starting point

ChillLog is built to run **on one laptop, for one user**, as the brief asks (no accounts, no paid
services). Security is sized for that: no login, reachable only from the laptop itself.

## What is protected today

| Risk | Protection | Where |
| --- | --- | --- |
| Someone else on the network opening the app | The server listens on `127.0.0.1` only (this computer) | `server/src/config.js` (`HOST`) |
| Bad or oversized uploads | Server-side checks: CSV only, max 5 MB per file, a cap on files per upload; clear rejection reasons. The client repeats them only as a courtesy. | `shared/src/uploads.js`, `server/src/api/upload-routes.js` |
| SQL injection | Raw SQL with **parameters only**; no user text is ever pasted into a query | Every module (see [database.md](database.md)) |
| Invalid API input | Every input validated with Zod schemas before it reaches the code | `shared/src/schemas.js`, `server/src/api/errors.js` |
| Excel running a formula from the CSV export | Cells starting with `=`, `+`, `-` or `@` are escaped | `server/src/reporting/csv.js` (tested in `csv.test.js`) |
| Lost or altered evidence | Raw files kept unchanged, named by their SHA-256 hash; every number can be rebuilt from them | [database.md](database.md) |
| Uploaded files being served to the web | Raw files are never served as static files; only the API reads them | `server/data/raw/` |
| Secrets in the repo | There are none: no keys or passwords are needed. Settings go in `.env` (git-ignored); `.env.example` has safe defaults | `.env.example` |

## What is not protected (known and accepted for this version)

- **No login.** Anyone who can reach the app can do everything. Acceptable only while it stays on
  `127.0.0.1`. An auth slot is ready in `server/src/app.js` (one middleware).
- **LAN mode (`HOST=0.0.0.0`) is open to the whole Wi-Fi.** It exists to try the app on a real phone;
  the README warns about it. Use it on a trusted network only, then switch back.
- **No HTTPS.** Fine on `127.0.0.1`; on a network, traffic can be read.
- **No audit trail of who changed what** (moves, settings). With one user there is no "who".
- **No automated backups.** Copy the data folder by hand ([database.md](database.md)).
- **Dependencies** are checked only by `npm audit` when you run it; there's no automated alert.

## Before real use, in this order

1. **Login** (Summer, and later branch managers with access to their own branch only).
2. **Hosting behind HTTPS**, never exposing the app directly.
3. **Automated backups** of the database and raw files.
4. **An audit log** of registry changes (moves, unit and date settings), since they change past answers.
5. **Rate limiting** on uploads and login, and automated dependency alerts (e.g. Dependabot).

These are listed in [NOTES.md](../../NOTES.md) under "Deferred on purpose".
