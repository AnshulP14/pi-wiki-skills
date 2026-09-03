# pi-wiki-skills

Evidence-backed project knowledge, dreaming, and skill evolution for [Pi](https://pi.dev).

This package is under active development.

## Current capabilities

- records each Pi session file, entry ID, and canonical SHA-256 content hash as a source anchor on `agent_end`
- resolves and verifies anchors against Pi’s native session JSONL evidence
- exposes `/wiki-status`, a verified evidence and knowledge dashboard, plus `/wiki-browse` for read-only pattern and source-anchor inspection
- exposes manual `/wiki-dream`, with `/skill:wiki-dream` documenting its workflow: it backfills readable project JSONL, VCC-compacts unreviewed verified entries per session, reads one selected wiki page at a time, then consolidates session suggestions into reviewed creates, updates, or deletes

## Trust and approval

- Trace content is untrusted data; the dreaming model is not allowed to follow instructions from session excerpts.
- Wiki pages are written only after the user approves the rendered proposal.
- Future skill promotion will require explicit user approval; no model, hook, or scheduler may promote a skill.

## Storage

Per-project state lives under `<agent-dir>/pi-wiki-skills/projects/<project>/` as `source-anchors.jsonl`, `dream-runs.jsonl`, `approval-claims.jsonl`, and a `wiki/` directory. `/wiki-dream` discovers Pi session files whose session header `cwd` exactly matches the current project; `dream-runs.jsonl` records completed-review anchor keys, so later runs consider only new entries. Use `/wiki-dream --all` only for an explicit full-history review. [WIKI_SCHEMA.md](WIKI_SCHEMA.md) defines the wiki format.

Not implemented yet: skill proposals, evaluation, rollback, and automation. See [DEVELOPMENT.md](DEVELOPMENT.md) for the ledger and planned work.

## Install

```sh
pi install npm:pi-wiki-skills
```

## License

MIT
