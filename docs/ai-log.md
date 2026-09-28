# AI log

Things the AI got wrong, or that I rejected, and how I caught them.
Each entry follows the same trail: a failing test committed first → the fix committed → an entry here.

| # | Date | What the AI did | How I caught it | Failing test commit | Fix commit |
|---|---|---|---|---|---|
| 1 | 2026-09-28 | In `feat/ingest`, a re-uploaded file returned its first report with only the status changed, so it still claimed readings were added (e.g. `added: 4`). The upload summary would have told Summer "4 readings added" when nothing was. The AI's own test only checked the database row count, not the report. | Caught by the AI while writing the upload-summary API test in `feat/api` (`says so when the same file is uploaded again`), after `feat/ingest` was already merged. The AI stopped, wrote a focused failing test, and asked for it to be committed before touching the code. | `1c7c018` (`reports no readings added for a file that was already uploaded` in `server/test/ingest.test.js`). By mistake this commit also carried the unfinished upload-routes work of `feat/api` piece 2; kept as is, since history isn't rewritten. | `a7f81ea` (`fix(ingest): report no readings added for a repeated upload`) |
