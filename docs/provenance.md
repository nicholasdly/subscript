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

### 2026-08-25 — Post-M2 review: three bug fixes and a simplification pass

No plan. A read of `packages/subscript` after M2 landed. `apps/web` untouched.

**Bugs fixed**

- Unary minus produced `dimension-mismatch` on absolute temperatures. `-20 c to f` refused;
  it is now `-4 °F`. `m2-parser.md` §4.5 spells unary `-` as `mul(quantity(-1), inner)`, but
  `mul` rejects absolute operands by design, so every negative Celsius or Fahrenheit literal
  failed. Unary minus now negates the literal and keeps the unit. A side effect: failures
  downstream of a negated value now report the real operands instead of `1` vs the unit.
- The `+` that `rewrite` inserts into `5 ft 11 in` spanned the whitespace between the two
  quantities, so `spans()` coloured it as an operator. Invented tokens now span nothing and
  `spansFor` drops empty spans.
- `formatQuantity`'s near-integer nudge used an absolute `1e-12`, so any value within `1e-12`
  of zero printed as `0` (`0.0000000000001 m` was `0 m`) while large values kept their float
  noise. The tolerance is relative now: `1e-13 m` prints, and `9270.999999999998 L` is `9271 L`.

**Simplified**

- `Token` is a discriminated union instead of a bag of optionals, replacing the `alt?: Token`
  sketch in `m2-parser.md` §3. The two readings of `in` are a separate `ambiguous` lex token
  that `enumerateReadings` splits, so `parse` cannot receive one; `withoutAlt` is gone. This
  removed every `unitId !== undefined` re-check and the unchecked `token.op as BinaryOp` cast.
- New `chars.ts` owns `charAt` / `isWhitespace` / `isLetter` / `isMark` / `isAllLetters` /
  `foldChar` / `skipWhitespace`, which were duplicated across `lex.ts`, `units/trie.ts`, and
  `units/aliases.ts`. `charAt` returns `""` past the end, which retired the `?? 32` sentinels.
- `Normalized.map` is now `starts`, with one entry per UTF-16 unit plus a terminator, so
  `origSpan`'s four fallbacks collapse to one lookup. `normalize` uses one rewrite table.
- `matchTrie` keeps the best match instead of collecting every hit and scanning backwards, and
  returns `{ value, length }` rather than four variants carrying an unread `allLetters`.
- The trie's hand-listed `SKIP_SYMBOLS` / `SKIP_IDS` are derived: skip an empty symbol, a
  `difference` unit, or a unit with locale-scoped aliases. `buildTrie` is now `trieFor`, which
  caches the two possible tries.
- `quantity.ts` lost `resolve` / `isDef`, which discriminated `UnitDef | Result` by probing for
  a `"scale"` property. Operand resolution goes through `withUnit` / `withUnits`, and the
  "name the derived result" tail is one `derived` helper. `div`'s dimensionless-numerator branch
  was equivalent to the general path; the three `lookupUnit("1") === undefined` branches were
  unreachable and now use an exported `DIMENSIONLESS`.
- `findResultUnit` moved to `units/lookup.ts` as one allocation-free pass, replacing
  `unitsMatching(dim).filter(...).find(...)`. `unitsMatching` is gone.
- `parse` builds the `convert` node inside the parser, so `wrapConvert`, `countNodes`, and the
  `new Parser([])` used only to borrow a node counter are gone.
- Ranking is a preference, not a score: `readsInAsConverter` picks the winner directly instead
  of `+10` / `0` / `-1` magic numbers fed through a sort.
- Deleted dead code: `aliases.foldKey`, the unread `_ast` parameter on `scoreReading`, and the
  `void now; void rates;` statements in `createSubscript`.

**Treat as given**

- Unary minus negates the literal. `-20 °C` is a temperature, not `20 × -1`.
- Tokens the rewriter invents span nothing, and `spans()` never returns an empty span.
- `Token` is closed over its payloads. Anything the parser must not see (today, an ambiguous
  reading) belongs in `LexToken`, not as an optional field on `Token`.
- `numeric.ts` stays. `plan.md` §1.2 and `m1-quantity.md` §1.5 make it a deliberate seam, so
  the review left it and its test alone even though every function is one operator.
- `^` stays dimensionless-only per `m2-parser.md` §4.4. `10 ft^2` is still `dimension-mismatch`
  (`10 m^2` works only because `m^2` is an alias). Worth revisiting when exponents get attention.

**Verified**

- 120 tests (was 107), typecheck, lint, and `oxfmt` green. Added `format.test.ts`, a
  `negative-celsius` accept fixture, and span, offset, and locale-symbol regression tests.
- Differential run of the pre-review build against the new source over 17,988 inputs × 2
  locales, comparing `evaluate` and `spans`: the only differences are the three fixes above.

**Not done**

- `apps/web`, and the deferred M3–M5 items below.

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
