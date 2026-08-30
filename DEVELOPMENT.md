# Development Ledger

Append one entry for every completed implementation milestone. Keep this ledger append-only: record the behavior delivered, evidence of verification, and any deliberate boundary. Add the entry before committing the milestone.

## 2026-08-30 — Provenance-backed foundation

Commit: [`6a4d598`](https://github.com/AnshulP14/pi-wiki-skills/commit/6a4d598)

- Created the standalone Pi extension package and public repository.
- Added an append-only JSONL claim ledger with source session/entry references, rejection, and atomic claim merges.
- Added the initial `agent_end` evidence capture hook and `/wiki-status`.
- Verified package checks, focused tests, and a live Pi run.

## 2026-08-30 — Remove duplicated trace content

Commit: [`4c5ead6`](https://github.com/AnshulP14/pi-wiki-skills/commit/4c5ead6)

- Replaced copied session-entry traces with source anchors containing session ID, entry ID, and a content hash.
- Kept Pi session JSONL as the only raw conversation evidence.
- Verified focused tests and the monorepo check.

## 2026-08-30 — Resolve and verify source anchors

Commit: [`070383c`](https://github.com/AnshulP14/pi-wiki-skills/commit/070383c)

- Added persisted session-file locations to anchors.
- Added a read-only resolver that validates the session header, entry ID, and canonical SHA-256 content hash.
- Added `/wiki-verify`.
- Verified five focused tests, the monorepo check, and a live GPT 5.6 Terra run with 4/4 anchors resolved and verified.
