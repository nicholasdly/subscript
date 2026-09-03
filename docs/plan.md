# Plan

A working plan for `packages/subscript`, derived from [`research.md`](./research.md).
Section references like §5.1 point into the research document. Numbered headings
in this file (`3.1`, `2.2`, …) are local.

**This document is both design intent and a status tracker.** Settled behavior lives in
[`packages/subscript/README.md`](../packages/subscript/README.md) and in JSDoc on the
public entry points (`src/index.ts`, `src/create.ts`, `src/types.ts`). The sections
below record what shipped, what was deliberately dropped, and what could still be
worked toward.

Where the research presents a fork, this document picks a side and says why. Where it
presents an open question, this document says whether that question blocks us now or
later. A plan whose every item is "it depends" is not a plan.

---

## 0. Current state

`@nicholasdly/subscript` 1.1.0 is published on npm. The package is synchronous, has
zero runtime dependencies, and covers arithmetic, unit conversion, and time zones.
Queries and aliases are English. `locale` only selects US vs imperial volume
(`en-GB` → imperial gallon, pint, cup, quart, tablespoon, and fluid ounce;
everything else → US).

| Area       | State                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Public API | `evaluate`, `createSubscript` (including `.spans`), quantity helpers, `@nicholasdly/subscript/internals` |
| Pipeline   | normalize → lex → readings → parse → eval → format                                                       |
| Tests      | Vitest; accept/reject fixture corpora                                                                    |
| Publishing | Changesets; MIT `LICENSE` at repo root and in `packages/subscript`                                       |
| Currency   | Removed; out of scope (see M4)                                                                           |

**Progress metric going forward:** corpus pass rate and alias coverage, not parser
elegance (§14).

---

## 1. Completed

Package milestones M0–M3 and M5 are done. M4 was cancelled. Exit criteria from the
original plan are met unless noted.

### M0 — Foundations ✓

- Vitest test runner; `test` task in `turbo.json`
- Accept and reject fixture corpora with a fixed reference instant for time queries
- Public API: `evaluate`, `createSubscript`, `Result` / `Failure` union
- Published as `@nicholasdly/subscript`; `package.json` exports resolve to `dist/`
- MIT `LICENSE`

### M1 — `Quantity`, dimensions, affine units ✓

- Rational-exponent dimension vector over seven SI base dimensions plus
  information (ISO 80000-13)
- Absolute vs difference temperature as distinct affine kinds
- Typed `dimension-mismatch` failures; no throws for input-shaped errors
- Mixed-unit rules: assimilation, larger unit wins, named products only
- Hand-authored unit table (length, mass, time, temperature, area, volume, speed,
  force, energy, power, pressure, information) with a cited source per entry

### M2 — Lexer and parser ✓

- Leftmost-longest trie; `in` as converter vs inch via alternate readings and ranking
- Multi-word aliases live in the trie (`fluid ounce`, `nautical mile`,
  `light year`, `pacific time`, …). Adjacent quantities add (`5 ft 11 in`,
  `5 m 11 cm`), same binding as `+`.
- Pratt parser; strict full-input consumption
- Input limits: 256 chars, parse depth 32, 64 AST nodes, `|exponent|` 1000; no
  `eval` / `new Function`

### M3 — Formatting ✓

- `Intl.NumberFormat` with hoisted instances; six significant figures; Latin `.`,
  no grouping
- Near-zero collapse (`sqrt(2) - 2^0.5` → `0`); `precision-loss` refusal
  (`1e100 + 1 - 1e100`)
- Compact `k` / `M` / `G` / `T` / `P` on dimensionless output, disableable via
  `compact: false`
- Corpus asserts on `text`, not only numeric `value`

### M4 — Currency — cancelled ✓ (by design)

Currency conversion was built and reversed. `evaluate` stays synchronous with no
network. `100 usd in eur` is `not-an-expression`. See 3.3 and 5.5.

### M5 — Time zones ✓

- `3pm PST in Tokyo` and related shapes work
- Closed alias list documented in the package README (offsets, IANA zones, cities)
- `Intl` + `formatToParts`; runtime tzdata; no bundled tzdb
- `ambiguousClock` config (`literal24` vs `preferDaytime`)

### Design decisions — implemented as planned

| Decision                                | Shipped behavior                                                          |
| --------------------------------------- | ------------------------------------------------------------------------- |
| 3.1 Strict consumption                  | Leftover tokens → `not-an-expression`                                     |
| 3.2 float64 + display predictability    | format-time rounding; checked add/sub; operators elsewhere                |
| 3.3 Units first, time last, no currency | Matches plan; currency reversed and dropped                               |
| 3.4 Hand-authored MIT data              | Cited entries in `units/table.ts`; no GPL vendoring                       |
| 4.1–4.3 Three API layers                | `evaluate` / `createSubscript` / `.spans` + `internals`                   |
| 4.4 Result type                         | `Result`, `Failure`, `alternates` on success; corpus covers `in`          |
| 5.6 Time zone policy                    | Closed list; PST/PDT vs `pacific time`; capital-city rule; `IST` is India |

---

## 2. Could still be worked toward

Nothing below blocks the library as shipped. These are the items the plan called
continuous, deferred, or incomplete.

### 2.1 Data and alias growth

The parser is done; perceived quality is mostly the alias table (§14). Gaps worth
filling as corpus cases are added:

- **Everyday mass** — stone, hundredweight
- **Timezone aliases** — grow the closed list as users report misses; airports
  explicitly deferred

Astronomical / colloquial length (`light year`, au, parsec, fathom, …) and SI
derived units (newton, watt, joule, pascal, byte) are in the catalog. `G`/`B`
policy is in the package README: typed `G` is gram, compact `G` is display-only,
`B` is byte, `GB` is 10⁹ bytes, `GiB` is 2³⁰ bytes.

Track progress by corpus pass rate, not by feature count.

### 2.2 Explicitly deferred (not oversights)

Documented decisions — easy to add later, not on the critical path:

- Comment-word tolerance (`$10 for lunch + 15% tip`)
- Inverted conversion (`meters in 10 km`) and bare two-unit shorthand (`km m`)
- Thousands grouping in input (`1,000`); compact **input** (`2.5k` as 2500 —
  output compact exists, and `2.5k` as input is 2.5 kelvin)
- `Temporal` backend (Intl implementation works today)
- Airport codes, date literals, clock arithmetic, bare `now`, `time in Paris`
- Default `timeZone` config; logarithmic units (dB, pH)
- Variables and multi-line documents; bytecode / VM
- Close read of `solve-engine` source

### 2.3 Research questions — closed vs open

**Closed by shipping:**

- Hand-authored unit data from NIST / SI Brochure (no permissive bulk database
  needed)
- US/imperial volume figures re-derived in `units/table.ts`
- Formatting without `Intl` `style: "unit"`; own symbol table via `Unit.symbol`
- Runtime tzdata over shipping `vvo/tzdb`; DST fixtures use 2026 transitions in
  the corpus
- Stay on float64; no decimal or bigint numeric backend (currency out of scope)

**Still worth answering if the relevant deferred item moves:**

- Numbat / Pint / Boost.Units affine modeling (informative, not blocking)
- `Temporal` `ZonedDateTime` disambiguation semantics (only if we add a Temporal
  backend)
- Dataset licenses (GeoNames, IATA, UDUNITS) before touching those sources

---

## 3. Decisions taken

These four were resolved before implementation because each one changes the shape
of everything below. They shipped as written, except the numeric-backend seam in
3.2, which was later dropped.

### 3.1 Strict input consumption, with tolerance as a possible later mode

The parser must consume the entire input. Any leftover token is a failure, and a
failure returns "not an expression" rather than a partial answer. Comment-word
tolerance (Soulver's `$10 for lunch + 15% tip`) is explicitly **not** a v1
feature.

The reason is not that tolerance is worse — for a notepad calculator it is
clearly better. It is that full consumption is a free, extremely strong
correctness signal, and once you give it up you have to build a confidence
mechanism to replace it (§5.1). Starting strict means we can add tolerance later
behind a flag with the strict path as our reference oracle. Starting tolerant
means we never get the oracle at all.

Consequence: unrecognized words are errors. Ordinary English words are never
keywords on their own; `in`, `to`, `for`, `at` are recognized only in positions
where nothing else parses (§5.1, `solve-engine`'s position).

### 3.2 float64 now, predictability handled at the display layer

Two mature projects reached opposite conclusions here (§8.5), which means neither
is wrong. We take float64 because the zero-dependency constraint makes a decimal
type our own code to write and maintain, and because a displayed conversion
rounded to 2–6 significant figures is nowhere near float64's 15–17 digit
boundary.

The real argument for decimals is legibility, not accuracy, so we address
legibility directly:

- Round to significant figures at format time, never display raw float residue.
- Follow Soulver's two documented behaviors (§10): collapse near-zero residues so
  `sqrt(2) - 2^0.5` shows `0`, and **refuse** calculations that cannot retain
  accuracy (`1e100 + 1 - 1e100`) rather than silently returning `0`.

`Quantity.value` stays `number`. Operand `+`/`−` goes through `addChecked` /
`subChecked` in `quantity/numeric.ts`: refuse a lost addend, snap cancellation
residue to 0. Scale math, multiply, divide, power, and roots use operators
directly.

The original write-up routed every arithmetic call through that module so a
later decimal backend would be a contained change. That seam is gone. Currency
is out of scope, and magnitudes float64 cannot represent are `precision-loss`,
not a reason to change the type.

### 3.3 Units and arithmetic first; time zones last. Currency is out of scope.

Matches §15 except we drop currency. Units are the core. Time zones reuse almost
none of the quantity machinery and carry the largest data and maintenance tail
(§9), so they went last.

Currency is a unit whose scale loads at runtime (§8.1). That is either a network
call inside `evaluate` or a `RateProvider` the host must supply. The first makes
the engine async and ties a free library to a third-party API. The second is
configuration the 95% path was never supposed to need. Neither belongs in the
library. Historical rates, crypto, and an injected provider are the same tradeoff
deferred; they are not later work.

### 3.4 Hand-authored unit data, cited per entry; `subscript` stays MIT

The GNU Units database is GPL-3.0-or-later and the license header is in the data
file itself (§11). We cannot vendor it, convert it, or reformat it. So we
hand-author our table from the same primary sources GNU Units cites — NIST SP 811
and CODATA — and record the source on each entry. The underlying facts are not
copyrightable; the compilation is.

This is real, boring work, and it is also the moat. The alias table _is_ the
product (§14), and building it ourselves is the only way we control it. **The
table is seeded, not finished** (see 2.1).

---

## 4. How developers interact with the library

Three layers, in order of how many people use them. All three shipped.

### 4.1 Layer 1 — one function

```ts
import { evaluate } from "@nicholasdly/subscript";

const result = evaluate("20 c to f");
// { ok: true, value: { ... }, text: "68 °F" }
```

Synchronous. No network. No configuration required. This is what 95% of consumers
use and it should be the entire README quickstart.

**A function, not a class.** A class is the wrong default here for a specific
reason: a `new Subscript()` that owns the unit table and the timezone aliases
cannot be tree-shaken, and the data tables are the bulk of the bundle (§13). Free
functions importing only what they need let a bundler drop the domains a
consumer never touches. A class also implies mutable instance state, and there is
none — the engine is a pure function of `(input, config)`.

### 4.2 Layer 2 — a configured instance for the hot path

```ts
import { createSubscript } from "@nicholasdly/subscript";

const subscript = createSubscript({
  locale: "en-US",
  now: () => ({ epochMilliseconds: Date.UTC(2026, 0, 15, 18, 0, 0) }),
});

subscript.evaluate("3pm PST in Tokyo");
```

This exists for two reasons beyond configuration. First, per-keystroke evaluation
means the alias trie and the `Intl` formatter instances must be built once and
reused (§4.6, §7.4) — the factory is where that caching lives. Second,
determinism: `now` is injected, never ambient, so a test or a retried tool call
cannot drift.

`evaluate(input)` from layer 1 is a thin wrapper over a lazily-created default
instance.

`locale` is a BCP 47 tag used only to pick volume aliases. `en-GB` treats
gallon, pint, cup, quart, tablespoon, and fluid ounce as imperial; every other
value, including the default `"en-US"`, treats them as US. `pt` is Pacific Time,
not pint.

### 4.3 Layer 3 — staged access, for hosts

Editors and launchers need more than an answer: they need to syntax-highlight the
input and re-evaluate incrementally. SoulverCore learned this the hard way —
consumers reached for its evaluation-oriented `TokenList` to do syntax coloring,
and it had to add a separate semantics layer because the internal token types
change between releases (§13).

```ts
subscript.spans("20 c to f");
// [{ start: 0, end: 2, kind: "number" }, { start: 3, end: 4, kind: "unit" }, ...]
```

`spans()` is a stable, documented, semantic view. The raw pipeline stages
(`normalize`, `lex`, `parse`) are exported from
`@nicholasdly/subscript/internals` and explicitly **not** covered by semver.

### 4.4 The result type

Errors are values, not exceptions (§5.3). Nothing in the public API throws for
input-shaped reasons.

```ts
type Result =
  | { ok: true; value: Quantity | ZonedTime; text: string; alternates?: Alternate[] }
  | { ok: false; reason: Failure };

type Failure =
  | { kind: "not-an-expression" }
  | { kind: "dimension-mismatch"; from: Unit; to: Unit }
  | { kind: "unknown-unit"; token: string }
  | { kind: "precision-loss" }
  | { kind: "limit-exceeded"; limit: LimitName };
```

`not-an-expression` is the common case and must be cheap — a launcher calls this
on every keystroke and discards most results.

`alternates` is where we honor §7.3: when a token is genuinely ambiguous (`in`),
pick the documented default _and_ return the alternative. Silently choosing is
the confident-wrongness failure mode; refusing to choose is unhelpful. Returning
both is neither.

---

## 5. How to approach each kind of parsing

The pipeline is settled — every mature system in the space converges on it (§2):
normalize → lex → parse → evaluate → format. What follows is per-domain
design reference; the engine matches this shape.

### 5.1 Arithmetic

Pratt parsing (precedence climbing). Finished; not expected to be revisited
except for deferred grammar extensions.

```
query     := expr (converter target)?
converter := "to" | "in" | "as" | "→"
target    := unit | timezone | base
```

Deliberately deferred: inverted form (`meters in 10 km`) and bare two-unit
shorthand (`km m`).

### 5.2 Units

Dimension vector of **rational** exponents over seven SI base dimensions plus
information (§7.1, ISO 80000-13). Absolute and difference temperatures are
**distinct types** (§7.2). Mixed-unit arithmetic follows Soulver's published
rules (§6). Calendar-unit lengths (year, month) are named, documented constants
in the catalog. A light year uses the Julian year, not that catalog year.

### 5.3 Lexing

Trie with **leftmost-longest** match; ambiguous tokens (`in`) expand into
alternate readings; the conductor ranks readings and prefers `in` as converter
when that reading evaluates. Matching is ASCII case-folded. `locale` selects
which volume aliases are in the trie, not a ranking tiebreaker.

### 5.4 Adjacent quantities

A quantity beside another quantity is `+` (`5 ft 11 in`, `5 m 11 cm`), at the
same binding power as explicit `+`. Bare numbers beside each other (`2 3`) are
not an expression. Phrase fusion is not implicit addition — multi-word aliases
are keys in the trie (`light year`, `fluid ounce`, `nautical mile`, `pacific time`).

### 5.5 Currency — out of scope

No ISO codes, `$`, or money arithmetic. `evaluate` stays a pure synchronous
function of `(input, config)`. See M4.

### 5.6 Time zones

`ZonedTime` is separate from `Quantity`. Internal clock math on `Intl`; closed
published alias list; runtime tzdata. Shipped per M5.

---

## 6. Concerns this project brings

### 6.1 Confident wrongness is the whole risk

A converter that returns nothing is mildly annoying. One that is quietly off by
4% because it picked the imperial fluid ounce is actively harmful. Mitigations in
place: negative corpus, typed failures, `alternates`, precision refusal.

**Operating rule:** when in doubt, return nothing.

### 6.2 Data licensing is a real legal exposure

Hand-authored, cited data only. No GPL vendoring. Before touching GeoNames, IATA,
or UDUNITS, answer the license questions in 2.3.

### 6.3 Every ambiguity has no correct answer

Resolved by policy, documentation, config switches, and `alternates` where
applicable. Any new alias must name the tradeoff publicly.

### 6.4 The work never finishes, and it finishes in the wrong order

The parser and evaluator are done. Normalization, the alias dictionary, and
formatting are where perceived quality lives. **This is the current phase**
(2.1).

### 6.5 A permanent maintenance tail

Timezone rules change via runtime tzdata; alias table grows forever. Relying on
`Intl` pushes tzdata maintenance onto platforms.

### 6.6 Untrusted input on every keystroke

No code generation. Length, depth, node, and exponent-magnitude caps are in
place (`2^1001` is `limit-exceeded`).

### 6.7 Bundle weight

Architecture supports tree-shaking (free functions, side-effect-free). The data
tables are the bulk of the bundle.

### 6.8 `solve-engine` already exists

The reasons to build are control over the alias table, trigger behavior, and
ambiguity policy. The parser was never the moat. A close read of `solve-engine`
is deferred (2.2).

### 6.9 Performance is a constraint, not a goal

Hoisted formatters, trie built once, cheap `not-an-expression` path.
