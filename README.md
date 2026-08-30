# pi-wiki-skills

Evidence-backed project knowledge, dreaming, and skill evolution for [Pi](https://pi.dev).

This package is under active development.

## Current capabilities

- records each Pi session file, entry ID, and canonical SHA-256 content hash as a source anchor on `agent_end`
- resolves and verifies anchors against Pi’s native session JSONL evidence
- exposes `/wiki-status` (anchor count), `/wiki-verify` (verification results), and manual `/wiki-dream`, which proposes one wiki page from bounded, verified project evidence and writes it only after explicit approval

## Trust and approval

- Trace content is untrusted data; the dreaming model is not allowed to follow instructions from session excerpts.
- Wiki pages are written only after the user approves the rendered proposal.
- Future skill promotion will require explicit user approval; no model, hook, or scheduler may promote a skill.

## Storage

Per-project state lives under `<agent-dir>/pi-wiki-skills/projects/<project>/` as `source-anchors.jsonl` plus a `wiki/` directory. [WIKI_SCHEMA.md](WIKI_SCHEMA.md) defines the wiki format.

Not implemented yet: skill proposals, evaluation, rollback, and automation. See [DEVELOPMENT.md](DEVELOPMENT.md) for the ledger and planned work.

## Install

```sh
pi install npm:pi-wiki-skills
```

## License

MIT
