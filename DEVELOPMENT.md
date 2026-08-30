# Development Ledger

Append one entry for every completed implementation milestone. Keep completed entries append-only: record the behavior delivered, evidence of verification, and any deliberate boundary. Add the entry before committing the milestone. Keep the planned-work list current; move completed work into a dated entry below rather than deleting it.

## Planned Work

1. **Persistent wiki store** — Markdown pattern pages plus append-only evolution and skill-impact logs.
2. **Evidence selection** — bounded sampling of verified successful and failed traces for a dream cycle.
3. **`/wiki-dream`** — an LLM maintainer that makes minimal, evidence-backed wiki patches.
4. **Versioned skill proposals** — derive candidate skill changes from wiki patterns without activating them.
5. **Evaluation gate** — sandbox tasks, regression checks, scores, and safety validation for each candidate.
6. **Promotion and rollback** — activate only accepted candidates and retain the last accepted skill version.
7. **Automation and retention** — threshold/scheduled cycles, observability, and evidence/wiki maintenance rules.

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
