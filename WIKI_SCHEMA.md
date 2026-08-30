# Wiki Store Schema

The wiki compiles verified Pi session evidence into concise project knowledge. `/wiki-dream` proposes changes; the user accepts or rejects them.

## Location

```text
<agent-dir>/pi-wiki-skills/projects/<sanitized-project-id>/wiki/
├── patterns/
│   └── <pattern-id>.md
└── evolution.md
```

`<pattern-id>` is a generated UUID.

## Pattern Page

```md
---
title: "Use the recorded source file"
sources:
  - sessionId: "01a..."
    entryIds: ["a1b2c3d4"]
---

## Rule

Use the recorded source file.

## Why

It identifies the original Pi session evidence.

## Exceptions

None.
```

Sources reference `source-anchors.jsonl`. Each must resolve and verify before it supports a page. Do not copy raw session content into the wiki just for archival.

## Evolution Log

`evolution.md` starts with `# Wiki Evolution Log`. Every accepted page change appends an entry:

```md
## 2026-08-30T00:00:00.000Z

- Pattern: `018f...`
- Sources: `session-id/entry-id`
- Change: Created the pattern page.
```

## Invariants

- Pattern pages change only through a reviewed wiki patch.
- The evolution log is append-only.
- Missing or unverifiable anchors cannot support a page.
- Future skill promotion requires explicit user approval.
