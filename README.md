# pi-wiki-skills

Evidence-backed project knowledge, dreaming, and skill evolution for [Pi](https://pi.dev).

This package is under active development.

## Current capabilities

- records each Pi session file, entry ID, and canonical SHA-256 content hash as a source anchor
- resolves and verifies anchors against Pi’s native session JSONL evidence
- exposes `/wiki-status` and `/wiki-verify`

[WIKI_SCHEMA.md](WIKI_SCHEMA.md) defines the minimal wiki format. Not implemented yet: wiki pages, `/wiki-dream`, skill proposals, evaluation, rollback, and automation.

## Install

```sh
pi install npm:pi-wiki-skills
```

## License

MIT
