# pi-wiki-skills

Evidence-backed project knowledge, dreaming, and skill evolution for [Pi](https://pi.dev).

This package is under active development.

## Current capabilities

- captures immutable snapshots of completed Pi session entries
- records claims in an append-only JSONL ledger
- preserves source session and entry IDs when claims are merged
- applies a merge as one atomic ledger event
- exposes `/wiki-status` for current claim and trace counts

Not implemented yet: wiki pattern pages, `/wiki-dream`, skill proposals, evaluation, rollback, and automatic promotion.

## Install

```sh
pi install npm:pi-wiki-skills
```

## License

MIT
