# pi-wiki-skills

Evidence-backed project knowledge, dreaming, and skill evolution for [Pi](https://pi.dev).

This package is under active development.

## Current capabilities

- records each Pi session file, entry ID, and canonical SHA-256 content hash as a source anchor
- resolves and verifies anchors against Pi’s native session JSONL evidence
- records claims in an append-only JSONL ledger
- preserves source session and entry IDs when claims are merged
- applies a merge as one atomic ledger event
- exposes `/wiki-status` for current claim and source-anchor counts
- exposes `/wiki-verify` to verify every anchor’s session file, session ID, entry ID, and hash

Not implemented yet: wiki pattern pages, `/wiki-dream`, skill proposals, evaluation, rollback, and automatic promotion.

## Install

```sh
pi install npm:pi-wiki-skills
```

## License

MIT
