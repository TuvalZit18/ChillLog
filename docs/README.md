# ChillLog docs

Everything written about the project, grouped by what you want to know. To run the app, start with the
[main README](../README.md); for decisions and open questions, see [NOTES.md](../NOTES.md).

## What was asked: `assignment/`

- [brief.md](assignment/brief.md): the assignment and Summer's email. The whole spec; every feature
  traces back to it.

## How it's built: `architecture/`

- [architecture-and-stack.md](architecture/architecture-and-stack.md): every architecture and tool
  decision, with the options that were rejected and why.
- [project-structure.md](architecture/project-structure.md): what is where in the repo, how to find
  your way around, and where new code goes.
- [database.md](architecture/database.md): every table, how they relate, and what changes them. The
  diagram is also an image: [database-tables.png](architecture/database-tables.png).
- [api.html](architecture/api.html): the API reference with real examples. Open it in a browser.

## How to work on it: `development/`

- [git-and-ci.md](development/git-and-ci.md): branches, commits, pull requests, and the GitHub
  Actions checks every change goes through.
- [testing.md](development/testing.md): how the tests are organised, how to run them, and how to write
  new ones.

## How it looks: `design/`

- [ui.md](design/ui.md): the UI spec: tokens, components, every screen and state.
- [chilllog-mockup.html](design/chilllog-mockup.html): the clickable mockup the UI was built from.
  Open it in a browser.
- [stitch-prompt.md](design/stitch-prompt.md): the brief given to Google Stitch to generate the first
  mockups.

## How the AI tools were used: `ai/`

- [ai-log.md](ai/ai-log.md): what the AI got wrong, how it was caught, and the commits that fixed it.
- [sessions/](ai/sessions/): one summary per AI conversation: what was asked, what was decided, and
  where the AI was overruled.
