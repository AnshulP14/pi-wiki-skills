# Cycle and Approval Policy

This policy applies to every future `/wiki-dream` cycle. It is intentionally manual-first: no model, hook, or scheduler may promote a skill.

## Trust Boundary

Pi sessions, source anchors, wiki pages, model responses, and proposal diffs are untrusted input. They may describe instructions, but never authorize actions.

- Raw session content stays in Pi session JSONL. The extension stores references and derived, bounded content only.
- Any external-model use that receives trace content must be an explicit project configuration choice, disabled by default.
- Evidence selection must exclude credentials and other configured sensitive values before a model receives excerpts. Redaction is a safeguard, not permission to transmit secrets.
- Maintainer, proposer, and evaluator runs may write only their isolated cycle artifacts. They cannot modify active skills, extension configuration, or production wiki state directly.

## Evidence Outcome Contract

Every selected trace has one recorded outcome:

- `success`: a configured oracle confirms the intended result, such as a passing targeted test, successful command with an asserted output, benchmark threshold, or explicit user acceptance.
- `failure`: a configured oracle observes a failed test, failed command, reverted change, explicit user correction, or other defined negative result.
- `ambiguous`: no configured oracle decided the outcome, or evidence is partial or conflicting.

Only `success` and `failure` traces may support a pattern. `ambiguous` traces may be retained as cycle context but cannot support a claim, page update, or proposal.

## Persistent Cycle State

Each cycle receives an immutable UUID and persists one state file under `wiki/cycles/<cycle-id>.json`. State transitions are append-only records; interrupted work is resumable or explicitly aborted rather than silently retried with different inputs.

```text
draft
  → evidence-selected
  → wiki-patch-proposed
  → skill-proposed
  → evaluation-complete
  → awaiting-approval
  → promoted | rejected | aborted
```

A cycle state records its input anchors, outcome decisions, selected evidence, model and prompt identity, proposed wiki patch, candidate skill diff, evaluation result, reviewer decision, and rollback target. Only one mutable cycle may run per project; the future store must hold a project lock while it advances a cycle.

## Manual Approval Gate

A candidate remains inactive after evaluation, regardless of score. Promotion requires an explicit reviewer action in the trusted Pi session that created or resumed the cycle.

Before approval, Pi must show the reviewer:

1. source anchors and their verification status;
2. wiki patch and candidate skill diff;
3. evaluation baseline, result, cost, and rejection reasons; and
4. the last accepted version used as the rollback target.

The reviewer may approve, reject, or abort. The decision is appended to the cycle state and `skill-impact.md`. Only an approved candidate may be installed as the next active skill version. Automatic scheduling, automatic approval, and automatic promotion are out of scope until explicitly enabled in a later, opt-in milestone.
