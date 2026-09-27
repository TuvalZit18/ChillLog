# CLAUDE.md

Instructions for AI tools working in this repo.

## What this is

ChillLog: a fridge-temperature monitor for Squanchy Bakery (12 branches), built as a Triolla take-home.
Summer (ops, non-technical, mostly on her phone) uploads weekly logger files and needs to see how every
fridge is doing and answer a health inspector: "when did this fridge go above 5°C, and for how long?"

## Source of truth: read before working

- [docs/brief.md](docs/brief.md): the assignment and Summer's email (the whole spec).
- [docs/architecture-and-stack.md](docs/architecture-and-stack.md): every architecture and tool decision. **These are decided.** Don't reopen them or swap tools. If something in the code seems to need a different call, stop and ask; don't work around it.
- [NOTES.md](NOTES.md): decisions Summer didn't ask for, questions for her, deferred items.

## Hard constraints

- Clone → `npm install` → `npm start` must work on a laptop: **one runtime (Node ≥22.13), no Docker, no accounts, no paid services, no native addons**.
- **JavaScript, not TypeScript.** ES modules everywhere. JSDoc on core shapes (`Reading`, `Excursion`, `FridgeStatus`); Zod schemas in `shared/` at the boundaries.
- SQLite via built-in `node:sqlite`, **raw parameterized SQL only**, numbered migration files. No ORM or query builder.
- **Times are UTC on the server**; the client always displays them in `Asia/Jerusalem` via `Intl.DateTimeFormat`.
- **Detection is deterministic, with no AI**: same file → same answer. Thresholds live in one config in `shared/`.
- **Raw uploads are never modified.** Everything derived must be rebuildable from them.
- Mobile-first UI; status is never shown by color alone (icon + word + value).
- Add a dependency only if the architecture doc names it, and only in the branch whose feature needs it.

## Layout

- `server/`: Express 5 app. Modules: `ingest`, `registry`, `normalize`, `detection`, `reporting`. `createApp()` in `src/app.js` is separate from `src/index.js` so tests can use Supertest.
- `client/`: React + Vite SPA, feature-based folders, CSS Modules + design tokens.
- `shared/`: code used by both (Zod schemas, thresholds).
- Runtime data goes in `server/data/` (git-ignored, created on startup, overridable via `DATA_DIR`).

## Commands

- `npm run dev`: server (`node --watch`) + Vite with an `/api` proxy.
- `npm start`: build the client, then serve everything on one port (default http://127.0.0.1:3000).
- `npm test` · `npm run lint` · `npm run format`

## Working process

- **One branch per module/feature**, in the order in docs/architecture-and-stack.md §16. Names are `type/scope`. **Don't write code that belongs to a later branch.**
- **Conventional Commits.** Never rewrite history (no amend, no force-push, no squash). PRs are self-merged with merge commits after CI passes, using the PR template.
- **Tests:** one named test per messy case in the email, with test names quoting the email. Write detection rules test-first. Use the named CSV fixtures listed in §13.
- **When the AI gets something wrong:** commit the failing test first, then the fix, then add an entry to [docs/ai-log.md](docs/ai-log.md).
- **Session summaries:** at the end of each AI conversation (not before), write `docs/ai-sessions/NNN-<topic>.md` in the format of [001](docs/ai-sessions/001-architecture-and-tech-stack.md).
- **Don't act before being asked.** When the user states a rule or convention, record it; don't carry it out on the spot.
- New open questions for Summer go in NOTES.md under "What I'd ask Summer".
- Development machine is Windows. Keep scripts cross-platform (no bash-only syntax in npm scripts).
