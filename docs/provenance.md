# Provenance

Running history of implementation plans. Destination: `docs/plan.md`. Steps: `docs/plans/`.

## How to update

When a plan in `docs/plans/` is done, add an entry at the top of the log:

- Date
- Link to the plan
- What landed (files, API, tests)
- Decisions that later work should treat as given
- Anything deferred or reversed

## Log

### 2026-08-25 — M0 Foundations

Plan: [`docs/plans/m0-foundations.md`](./plans/m0-foundations.md)

**What landed**

- Public API stub: `evaluate`, `createSubscript`, `Result` / `Failure` union, `spans` (always `[]`).
- Every `evaluate` call returns `{ ok: false, reason: { kind: "not-an-expression" } }` and never throws.
- `node:test` runner, `npm test` at the repo root, table-driven fixtures under `packages/subscript/test/`.
- Package `exports.default` points at `dist/index.js`. Workspace name stays `@repo/subscript`.

**Treat as given**

- Layer 1 is a free `evaluate(input)`; configure via `createSubscript`, not extra arguments on the free function.
- Tests inject `now`; they never read the ambient clock. Default instance may use `Date.now`.
- Reject fixtures must keep failing after later milestones. Accept fixtures are todos until the milestone that implements them.
- `Quantity` is a typed hole (`value` + `unit`) until M1.

**Deferred**

- Units, lexer, parser, formatting, currency, time zones, wiring `apps/web`, publishing, LICENSE.
