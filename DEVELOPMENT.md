# Development Ledger

Append one entry for every completed implementation milestone. Keep completed entries append-only: record the behavior delivered, evidence of verification, and any deliberate boundary. Add the entry before committing the milestone. Keep the planned-work list current; move completed work into a dated entry below rather than deleting it.

## Planned Work

0. **Trust, outcome, and cycle contract** — implement the policy in [CYCLE_POLICY.md](CYCLE_POLICY.md): untrusted-data handling, configured success/failure oracles, persistent recoverable cycle state, and a project lock.
1. **Persistent wiki store** — implement the schema in [WIKI_SCHEMA.md](WIKI_SCHEMA.md), including pattern maintenance, contradiction handling, and stale-page retirement.
2. **Evidence selection** — bounded sampling of verified, non-ambiguous successful and failed traces for a dream cycle.
3. **Manual `/wiki-dream`** — an LLM maintainer that creates reviewable, minimal, evidence-backed wiki patches.
4. **Versioned inactive skill proposals** — derive candidate skill changes from wiki patterns without activation.
5. **Deterministic evaluation and safety gate** — baseline, held-out tasks, thresholds, time/cost limits, regression tolerance, and static safety checks.
6. **Manual promotion and rollback** — show the reviewer the evidence, patches, diff, evaluation, and rollback target; activate only explicit approvals.
7. **Observability, governance, and tests** — status metrics, migration/export/reset/retention, security and failure tests, and package documentation.
8. **Opt-in automation** — only after the manual evaluator and approval flow are reliable; scheduling never bypasses the approval gate.

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

## 2026-08-30 — Wiki store schema

- Defined the v1 Markdown layout, pattern-page metadata, provenance references, and append-only evolution and skill-impact log formats in [WIKI_SCHEMA.md](WIKI_SCHEMA.md).
- Deliberate boundary: this documents the storage contract only; no wiki writer or LLM behavior exists yet.

## 2026-08-30 — Manual approval and cycle policy

- Defined [CYCLE_POLICY.md](CYCLE_POLICY.md): trace content is untrusted data, evidence requires a configured outcome oracle, and cycle state must be recoverable and locked per project.
- Made manual reviewer approval a mandatory promotion gate; evaluation success alone can never activate a candidate skill.
- Extended [WIKI_SCHEMA.md](WIKI_SCHEMA.md) with cycle artifacts and page maintenance metadata.
- Deliberate boundary: this is a policy and schema milestone. No dream, proposal, evaluator, or promotion command exists yet.
