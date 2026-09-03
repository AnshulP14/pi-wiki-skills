# Development Ledger

Append one entry for every completed implementation milestone. Keep completed entries append-only: record the behavior delivered, evidence of verification, and any deliberate boundary. Add the entry before committing the milestone. Keep the planned-work list current; move completed work into a dated entry below rather than deleting it.

## Planned Work

1. **Inactive skill proposals** — derive candidate skill changes from accepted wiki patterns without activation.
2. **Evaluation and approval** — add a project-specific evaluator, rollback, and explicit promotion approval.
3. **Automation** — opt-in scheduling only after the manual flow proves useful; it never bypasses approval.

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

- Defined `CYCLE_POLICY.md` (later removed during the Ponytail simplification): trace content is untrusted data, evidence requires a configured outcome oracle, and cycle state must be recoverable and locked per project.
- Made manual reviewer approval a mandatory promotion gate; evaluation success alone can never activate a candidate skill.
- Extended [WIKI_SCHEMA.md](WIKI_SCHEMA.md) with cycle artifacts and page maintenance metadata.
- Deliberate boundary: this is a policy and schema milestone. No dream, proposal, evaluator, or promotion command exists yet.

## 2026-08-30 — Ponytail simplification

- Removed the unused generic claim ledger and its merge/rejection machinery; the Markdown wiki will be the only derived-knowledge layer.
- Removed `CYCLE_POLICY.md`; its manual-approval and trust-boundary rules remain the intended contract for the deferred skill-proposal, evaluation, and automation milestones.
- Retained Pi-native source anchors, exact-file verification, `/wiki-status`, and `/wiki-verify`.
- Replaced the premature cycle, outcome, and promotion schema with a minimal reviewed-wiki contract in [WIKI_SCHEMA.md](WIKI_SCHEMA.md).
- Deliberate boundary: manual `/wiki-dream` is the next feature; outcome oracles, evaluators, and automation remain deferred.

## 2026-08-30 — Manual wiki dream

- Added `/wiki-dream`: it reads up to eight verified project anchors, bounds trace and existing-wiki context, and asks the selected Pi model for one JSON pattern proposal.
- The proposal is rendered as a Markdown page and requires explicit user approval before a new pattern page and append-only evolution entry are written.
- Deliberate boundary: it creates one new page only. It does not update pages, classify outcomes, propose skills, or run automatically.

## 2026-09-02 — Project-wide reviewed dream batches

- `/wiki-dream` now discovers every readable Pi session JSONL whose header `cwd` matches the project, anchors previously unseen entries, and considers all newly verified entries rather than the newest eight.
- Added deterministic VCC-style, source-preserving digest batches and required proposed pages to cite one to twelve exact source references from those batches.
- Added append-only `dream-runs.jsonl`; approval, rejection, and explicit `null` outcomes advance the reviewed-anchor cursor, while model failures and invalid proposals remain eligible for retry.
- Deliberate boundary: this is deterministic compression, not a dependency on Blackhole internals; it does not yet merge/update patterns or add multi-reviewer policy.

## 2026-09-03 — Staged Dream review and final-claim ledger

- Reworked `/wiki-dream` into per-session VCC analysis, with one selected full wiki page loaded at a time and further page selection available after each step.
- Added final-only append-only approval claims, recording each consolidated claim and its explicit approve/reject outcome without retaining per-session suggestions.
- Added approval-gated create, update, and delete wiki actions; deletions remain visible in the append-only evolution log.
- Expanded assistant VCC excerpts to 2,000 characters while retaining the 180-character limit for ordinary entries.
- Verified package checks, eight focused tests, and an interactive all-history Dream run.
- Deliberate boundary: no merge operation, no multi-reviewer policy, and no automatic promotion.
