# AI Session 001: Understanding the brief, architecture, tech stack

- **Date:** 2026-09-27 14:33 → 2026-09-28 02:00 (Israel time)
- **Tool:** Claude (claude.ai cloud session), using my own `architecture-advisor` skill
- **Outputs:** `docs/brief.md`, `docs/architecture-and-stack.md`, `NOTES.md` (draft)
- **Next:** continue in VS Code (Claude Code extension), branch `chore/scaffold`

## What I asked for
1. Read the assignment (pasted in chunks) and only confirm understanding, with no plan yet.
2. Run `/architecture-advisor` to decide the architecture **before** choosing any tools.
3. Pick tools topic by topic (my `technology-advisor` skill isn't built yet), adding each topic to the md as it's locked.
4. Combine architecture + tech into one doc so tools visibly follow from the architecture; draft NOTES.md with what's known.
5. Name the project, reassemble the brief, write this summary.

## What the AI did (short)
- Summarized the brief and extracted the hidden data problems (°F Haifa logger, moved logger, varying columns, gaps, ERR, duplicates, out-of-order rows, door spike vs slow warming).
- Ran the 8 context questions, then 4 clusters of architecture decision tables (options → pros/cons → recommendation → approve).
- Ran 12 tool topics in the same format.
- Flagged conflicts with the brief's constraints: free AI APIs still need an account; MySQL needs a server.
- Raised non-obvious risks: row-count mismatch in Summer's email (~3k vs ~25k/week), daylight-saving hour silently dropping readings, DD/MM ambiguity, averaging hiding spikes in charts, CSV formula injection in Excel exports, showing times in Israel time for reviewers abroad, weekly data making notifications useless.
- Wrote `docs/architecture-and-stack.md` (16 sections: architecture → stack) and a NOTES.md draft with [TO FILL] placeholders.
- Looked up in the Claude Code docs how to resume this cloud session in the VS Code extension.

## Where I overrode or corrected the AI
| AI proposed | I said | Result |
|---|---|---|
| Asked about stack (React/Supabase) during the context questions | Architecture first, tools later | Stack parked until all architecture decisions were done |
| "Performance is not a real concern" | Summer must see data fast with no glitches | Split into data scale (fine) vs perceived phone speed (hard requirement) → precomputed tables, downsampling |
| Report export / audit trail "not required" | It would help Summer answer the inspector | Export = should-have; raw files kept + upload record = must |
| (Missed it) | Summer merges logger data by hand, so we must help | Logger registry with move history, automatic logger detection, bulk upload |
| No AI, fully deterministic | Add an "AI Assistant" with tools + guardrails on a free tier | AI designed it; **I then deferred it** and will ask the reviewers first |
| TypeScript | I'm not strong in TS; use JavaScript | JS + shared Zod schemas + JSDoc |
| Server-state library, no Redux | Redux, even if overkill | Redux Toolkit + RTK Query; AI pushed back on my "scalability" justification and gave a stronger one |
| (I asked) Pull or notify? | — | AI showed weekly files make notifications useless now → pull-only, question for Summer |
| Upload destination unspecified | Must be inside the project so a fresh clone can't fail | Path from code location, created on startup |
| (I asked) Single vs bulk upload? | — | One pipeline, batch of one; bulk edge cases handled in the loop |
| (I asked) Why SQLite and not MySQL? / Why not Jest? | — | Explanations added to the doc (no DB server to install; project is ESM) |
| Commit straight to `main` | Feature branches + self-merged PRs | Adopted: merge commits, no squash, PR template |
| Two separate docs (architecture, tech stack) | Combine: tech chosen based on architecture | One doc, each section architecture → stack |
| Put questions for Summer / deferred items in the architecture doc | Those belong in NOTES.md | Moved to a NOTES.md draft |
| Repo name `squanchy-fridge-monitor` | **ChillLog** | Docs renamed |

## What I didn't like
- The AI went one question at a time without showing where the 21 decisions were; I had to ask to see the whole process.
- Some early answers labeled things "not needed" too quickly (performance, export) before thinking about Summer's actual day.
- **The AI acted before I asked:** when I set the rule "summarize each conversation at the end", it wrote a summary immediately instead of recording the rule. I had it deleted and recorded as a convention only.

## Deferred / open
- Detection parameters (minimum excursion duration, spike rule, warming-trend rule): decide in `feat/detection`.
- Deferred features: AI Assistant (ask reviewers), login, hosting, automated backups, Excel history import, email ingestion.
- Next: create the public GitHub repo, add `docs/` + `NOTES.md`, start `chore/scaffold` (workspaces, `CLAUDE.md`, `.gitignore`, `.nvmrc`, `.env.example`, PR template, CI).
