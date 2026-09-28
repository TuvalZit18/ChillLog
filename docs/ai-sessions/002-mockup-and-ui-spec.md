# AI Session 002: Clickable mockup and UI spec

- **Date:** 2026-09-28 ~02:55 → 09:30 (Israel time)
- **Tool:** Claude Code (VS Code extension), Claude Opus 5.5
- **Outputs:** `docs/design/stitch-prompt.md` (mockup brief, written before this session, committed here),
  `docs/design/chilllog-mockup.html` (clickable prototype, also published as a private Claude artifact),
  `docs/design/ui.md` (UI spec)
- **Branches / PRs:** `docs/mockup` → PR #1 · `docs/ui-spec` → PR #2 · `docs/ai-session-002` (this file)
- **Next:** start the feature branches in the order of `docs/architecture-and-stack.md` §16

## What I asked for
1. "Are we good?": a status check after the scaffold merge.
2. Continue the mockup build that stopped after the Stitch brief.
3. No settled palette or components yet: just a general **clickable** mockup with sample data, to see how the app will feel.
4. Move the work off `main` onto its own branch, commit, push and merge.
5. Explain why the app needs logger moves: is it a requirement or an assumption? Then check it against `brief.md`.
6. On a new branch, write an overall UI doc from the mockup's look and colors, and add a light/dark theme switch in the doc only.
7. Write this session log on a new branch.

## What the AI did (short)
- Checked the repo: `main` clean except the untracked brief; tests and lint passed (client has no tests yet).
- Loaded the design canvas skill first, then switched to a single self-contained HTML prototype after my correction.
- Built the prototype: all 6 screens + logger detail, phone (bottom tabs) and desktop (sidebar) layouts, 37 sample fridges
  with every messy case from the email (slow warm-up in Rishon, door spike, Haifa gap + ERR, moved Tel Aviv logger,
  Netanya with no file), a scrubbable chart, working dialogs, and a "Mockup" menu for empty / loading / error states and phone width.
- Left freezers out of the sample data (5°C doesn't apply to them) and said so.
- Stashed the files, created `docs/mockup`, restored them, ran lint and committed. **The push failed**: git had no stored
  GitHub credentials and couldn't prompt, and the `gh` CLI isn't installed. Stopped before merging so CI could run first; I pushed and merged via PR #1.
- Explained logger moves, then confirmed them in `brief.md`: Summer wrote "We moved one of the Tel Aviv loggers into the new
  display fridge", and her files only hold time + temperature, so the app has to know which logger was in which fridge *when*.
- Wrote `docs/design/ui.md`: principles, light and dark tokens, status colors, type scale, spacing, breakpoints, theme switch
  (System / Light / Dark, `data-theme`, `localStorage`), shell, status system, components, screens, states, copy, accessibility.

## Where I overrode or corrected the AI
| AI proposed | I said | Result |
|---|---|---|
| Design canvas of static artboards | There's no settled design yet; I want a general clickable mockup with sample data | One clickable HTML prototype with placeholder colors |
| Wrote the mockup files straight into the `main` working tree | Every change goes on its own branch; we never touch `main` | Moved to `docs/mockup`; later branches created before writing |
| (CLAUDE.md says the AI never commits) Asked whether to break the rule | Do it all, just this once | AI committed; push blocked by credentials, so I pushed and merged myself |
| Ran a check of `main` after I said "all good" | I didn't ask you to do anything | Stopped; waits for instructions |
| Suggested fixing the mockup's move time to match the email's sample row | The mockup data is only illustrative | No mockup change |

## What I didn't like
- **The AI didn't branch before writing files**, even though CLAUDE.md says one branch per piece of work.
- **The AI acted when I hadn't asked:** it re-checked `main` after I said everything was done.
- It first answered the logger-move question without reading `brief.md`. It did say it hadn't checked, but it should have read the source first.

## Deferred / open
- **Fonts:** `ui.md` says to self-host IBM Plex, but the architecture doc names no font package. Decide: font files in the repo, a package, or the system font stack.
- **Theme switch** placement and storage in `ui.md` are the AI's proposal; confirm when building the shell.
- **NOTES.md:** add the logger-move decisions Summer didn't ask for (a full move history and move form; any number of moves, not just the one she mentioned).
- **Question for Summer:** do freezers exist, and what's their limit?
- The mockup's detection rule (2+ readings above 5°C = excursion) is a placeholder; the real rule is decided in `feat/detection`.
- Tooling: install the `gh` CLI and store GitHub credentials if the AI should ever open PRs.
