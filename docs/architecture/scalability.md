# ChillLog: scalability

> The decisions are in [architecture-and-stack.md](architecture-and-stack.md) §2 (Data storage) and §9
> (Caching & performance). This page is about size: how big the data gets, what stays fast, and what
> to change as the bakery grows.

## Today's size

| | Now | Per year |
| --- | --- | --- |
| Branches / fridges / loggers | 12 / ~30 / ~35 | |
| Readings (every 15 minutes per logger) | up to ~25,000 a week | **~1.3 million** |
| Uploaded files | ~40 a week, ~20 KB each | ~2,000 files, ~40 MB |

For SQLite this is small: it handles many millions of rows. The hard requirement is a **fast phone
screen**, not volume.

## Why it stays fast

- **Detection runs once, when data changes**, not on every page load. Results are stored in their own
  tables ([database.md](database.md)), so screens read small tables.
- **Screens only load the range they show:** the Overview loads the chosen week, the fridge chart its
  date range, **downsampled on the server** (min/max per time bucket, so peaks survive) for long ranges.
- **Every query is bounded** by fridge and time, using the `(logger_id, ts_utc)` primary key.
- **The client caches** each answer (RTK Query) and refetches only what an upload or change affects.

## Where it would slow down first, and what to do

| If… | What happens | What to change |
| --- | --- | --- |
| **Years of history** (5+ M readings) | Queries stay bounded, but the join from readings to fridges scans more | Add indexes on the derived tables' time columns; archive old years |
| **Many more branches** (100+) | The Overview works out each fridge's week per request | Store the week's status per fridge too, or page the Overview |
| **Files every day, or live loggers** | Uploads are processed in the request, one file at a time | Move ingest to a background queue; recompute only the affected days |
| **Several users at once** | SQLite allows one writer at a time | **Move to Postgres** (raw SQL keeps this mostly a driver swap) |
| **Hosted for many bakeries** | One process, one database, no login | Multi-tenant data, login, several app instances behind a load balancer |

None of these is needed at 12 branches, so none was built (NOTES.md, "Deferred on purpose").
