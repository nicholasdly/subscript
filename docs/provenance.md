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

### 2026-08-25 — M2 Lexer, rewrite, parser

Plan: [`docs/plans/m2-parser.md`](./plans/m2-parser.md)

**What landed**

- Pipeline: normalize → lex → rewrite → Pratt parse → evaluate via `quantity` / `convert` / `add` / …
- Alias trie (leftmost-longest) with locale `gallon` / `fl oz`; `in` is converter vs inch.
- `evaluate` and `spans` are wired. Input caps: 256 / depth 32 / 64 AST nodes.
- `text` is still the M1 stub formatter. `apps/web` remains untouched.

**Treat as given**

- Strict full-input consumption. Leftover prose is `not-an-expression`.
- `in` ranks as converter when that reading evaluates; inch is the fallback (mixed `ft`/`in`).
- `oz` is avoirdupois mass. Fluid ounce is a different phrase. `en-GB` is imperial gallon / fl oz; every other locale is US.
- Canonical ids stay SI spellings. The parser produces them from aliases.
- `spans()` colors the winning parse; failures return `[]`.
- Pipeline stages are `@repo/subscript/internals`, not semver.

**Deferred**

- `Intl` formatting, currency, time zones, comment-word tolerance, inverted conversion, `apps/web`, LICENSE.

### 2026-08-25 — M1 Quantity, dimensions, affine units

Plan: [`docs/plans/m1-quantity.md`](./plans/m1-quantity.md)

**What landed**

- Programmatic API: `quantity`, `convert`, `add`, `sub`, `mul`, `div`, `sqrt`. All return `Result`; none throw.
- Rational-exponent dimension vector over the seven SI base dimensions; float64 arithmetic isolated in `numeric.ts`.
- Hand-authored unit table (length, mass, time, temperature, area, volume, speed) with a citation on every row.
- Affine temperatures as distinct units (`celsius` / `delta-celsius`, `fahrenheit` / `delta-fahrenheit`). Kelvin is linear.
- `evaluate` still always returns `not-an-expression`. NL accept fixtures remain todos.

**Treat as given**

- Public `Quantity` is still `{ value, unit }` with no `offset` field. Affine kind lives on the internal unit record.
- Canonical ids are SI spellings (`metre`, `litre`, `celsius`). Aliases are M2.
- Mixed-unit multiplication only yields a named unit in the table (or dimensionless); `kg × L` is `unknown-unit`.
- Larger unit wins on addition; a dimensionless operand assimilates the other unit.
- Year is the mean Gregorian year (365.2425 days); month is year / 12.
- US gallon is 231 in³; imperial gallon is 4.54609 L. Locale-default `gallon` / `oz` is M2.
- Sources used: SI Brochure 9, NIST SP 811 Appendix B.8, NIST Handbook 44 Appendix C, 1959 International Yard and Pound Agreement.

**Deferred**

- Lexer, parser, wiring `evaluate`, aliases, `Intl` formatting, currency, time zones, `apps/web`, LICENSE.

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
