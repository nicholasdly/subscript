# Plan

A working plan for `packages/subscript`, derived from [`research.md`](./research.md).
Section references like §5.1 point into the research document.

**This document is both design intent and a status tracker.** Settled behavior lives in
[`packages/subscript/README.md`](../packages/subscript/README.md) and in JSDoc on
`src/index.ts`. The sections below record what shipped, what was deliberately dropped, and
what could still be worked toward.

Where the research presents a fork, this document picks a side and says why. Where it presents an
open question, this document says whether that question blocks us now or later. A plan whose every
item is "it depends" is not a plan.

---

## 0. Current state

`@nicholasdly/subscript` 1.1.0 is published on npm. The package is synchronous, has zero runtime
dependencies, and covers arithmetic, unit conversion, and time zones. `apps/web` is a minimal
playground (input → JSON result); it is not yet the product demo described in §1.3.

| Area       | State                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------- |
| Public API | `evaluate`, `createSubscript`, `spans`, quantity helpers, `@nicholasdly/subscript/internals` |
| Pipeline   | normalize → lex → readings → rewrite → parse → eval → format                                 |
| Tests      | Vitest; accept/reject fixture corpora; fuzz (seeded); throughput smoke test                  |
| Publishing | Changesets; MIT `LICENSE` at repo root and in `packages/subscript`                           |
| Currency   | Removed; out of scope (see M4)                                                               |

**Progress metric going forward:** corpus pass rate and alias coverage, not parser elegance (§5.4).

---

## 1. Completed

Package milestones M0–M3 and M5 are done. M4 was cancelled. Exit criteria from the original plan
are met unless noted.

### M0 — Foundations ✓

- Vitest test runner; `test` task in `turbo.json`
- Accept and reject fixture corpora with a fixed reference instant for time queries
- Public API: `evaluate`, `createSubscript`, `Result` / `Failure` union
- Published as `@nicholasdly/subscript`; `package.json` exports resolve to `dist/`
- MIT `LICENSE`

### M1 — `Quantity`, dimensions, affine units ✓

- Rational-exponent dimension vector over seven SI base dimensions
- Absolute vs difference temperature as distinct affine kinds
- Typed `dimension-mismatch` failures; no throws for input-shaped errors
- Mixed-unit rules: assimilation, larger unit wins, named products only
- Hand-authored unit table (length, mass, time, temperature, area, volume, speed) with a cited
  source per entry

### M2 — Lexer, rewrite, parser ✓

- Leftmost-longest trie; `in` as converter vs inch via alternate readings and ranking
- Rewrite: `5 ft 11 in` → implicit `+`; multi-word aliases in the trie (`fluid ounce`,
  `nautical mile`, `pacific time`, …)
- Pratt parser; strict full-input consumption
- Input limits: 256 chars, parse depth 32, 64 AST nodes; no `eval` / `new Function`

### M3 — Formatting ✓

- `Intl.NumberFormat` with hoisted instances; six significant figures; Latin `.`, no grouping
- Near-zero collapse (`sqrt(2) - 2^0.5` → `0`); `precision-loss` refusal (`1e100 + 1 - 1e100`)
- Compact `k` / `M` / `G` / `T` / `P` on dimensionless output, disableable via `compact: false`
- Corpus asserts on `text`, not only numeric `value`

### M4 — Currency — cancelled ✓ (by design)

Currency conversion was built and reversed. `evaluate` stays synchronous with no network.
`100 usd in eur` is `not-an-expression`. See §3.5.

### M5 — Time zones ✓

- `3pm PST in Tokyo` and related shapes work
- Closed alias list documented in the package README (offsets, IANA zones, cities)
- `Intl` + `formatToParts`; runtime tzdata; no bundled tzdb
- `ambiguousClock` config (`literal24` vs `preferDaytime`)

### Design decisions — implemented as planned

| Decision                                 | Shipped behavior                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| §1.1 Strict consumption                  | Leftover tokens → `not-an-expression`                                   |
| §1.2 float64 + display predictability    | `numeric.ts` seam; format-time rounding; precision refusal              |
| §1.3 Units first, time last, no currency | Matches plan; currency reversed and dropped                             |
| §1.4 Hand-authored MIT data              | Cited entries in `units/table.ts`; no GPL vendoring                     |
| §2.1–2.3 Three API layers                | `evaluate` / `createSubscript` / `spans` + `internals`                  |
| §2.4 Result type                         | `Result`, `Failure`, `alternates` on success                            |
| §3.6 Time zone policy                    | Locale-biased closed list; PST/PDT vs `pacific time`; capital-city rule |

---

## 2. Could still be worked toward

Nothing below blocks the library as shipped. These are the items the plan called continuous,
deferred, or incomplete.

### 2.1 Quality and regression safety

| Item                                 | Plan reference | Status                                                                     |
| ------------------------------------ | -------------- | -------------------------------------------------------------------------- |
| Executable documentation             | §4 continuous  | README examples are not run by the test suite                              |
| Differential testing vs last release | §4 continuous  | Not started                                                                |
| Fuzzing with committed corpus        | §4 continuous  | Seeded 1000-string pass exists; no shrink-to-minimal or committed findings |
| Benchmark with a stored baseline     | §5.9           | Throughput smoke test only (~3k eval loops under 2s)                       |
| CI (test, typecheck, lint on push)   | —              | Not configured                                                             |

**Suggested order:** executable README examples → differential testing → CI.

### 2.2 Data and alias growth

The parser is done; perceived quality is mostly the alias table (§5.4). Gaps worth filling as
corpus cases are added:

- **Common kitchen units** — cup, pint, quart, tablespoon (with US vs imperial policy)
- **Astronomical / colloquial length** — `light year` (named in §3.4; not in catalog yet)
- **Percent** — `%` as operator or unit (Soulver does both; policy needed)
- **SI derived units** — newton, watt, joule, pascal, byte (and `G`/`B` ambiguity with compact)
- **Everyday mass** — stone, hundredweight (locale-biased)
- **Timezone aliases** — grow the closed list as users report misses; airports explicitly deferred

Track progress by corpus pass rate, not by feature count.

### 2.3 API and engine gaps

Small inconsistencies between the documented contract and runtime behavior:

- **`Failure.kind: "ambiguous"`** — in the public type but never returned; ambiguity is handled by
  ranking (`in`) or documented defaults (`oz`, `IST`). Either wire it up for true multi-candidate
  failures or remove it from the public union.
- **`alternates`** — implemented for `in` (converter vs inch) but not covered by fixture tests
- **Exponent magnitude budget** — length, depth, and node caps exist (§5.6); `^` still uses
  unchecked `numeric.pow` (two legal operands can exponentiate into overflow/hang)
- **Bundle measurement** — never done (§5.7); `evaluate` pulls the full catalog; no per-domain
  entry points or `splitting` in the build

### 2.4 Application and repo

| Item                      | Notes                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| `apps/web` product demo   | §1.3: units-and-arithmetic calculator with `spans` highlighting, not a JSON dump |
| `goal.md`                 | Still says the package "will eventually" publish; update when convenient         |
| `solve-engine` comparison | §5.8: close read still worth doing to validate the alias-table bet               |

### 2.5 Explicitly deferred (not oversights)

Documented decisions — easy to add later, not on the critical path:

- Comment-word tolerance (`$10 for lunch + 15% tip`)
- Inverted conversion (`meters in 10 km`) and bare two-unit shorthand (`km m`)
- Grouping / comma decimals; compact **input** (`2.5k` as 2500 — output compact exists)
- `Temporal` backend (Intl implementation works today)
- Airport codes, date literals, clock arithmetic, bare `now`, `time in Paris`
- Default `timeZone` config; non-English input; logarithmic units (dB, pH)
- Variables and multi-line documents; bytecode / VM

### 2.6 Research questions — closed vs open

**Closed by shipping:**

- Hand-authored unit data from NIST / SI Brochure (no permissive bulk database needed)
- US/imperial volume figures re-derived in `units/table.ts`
- Formatting without `Intl` `style: "unit"`; own symbol table via `Unit.symbol`
- Runtime tzdata over shipping `vvo/tzdb`; DST fixtures use 2026 transitions in corpus

**Still worth answering if the relevant deferred item moves:**

- Numbat / Pint / Boost.Units affine modeling (informative, not blocking)
- CLDR `unitPreferenceData` (only if locale-driven output units matter)
- `Temporal` `ZonedDateTime` disambiguation semantics (only if we add a Temporal backend)
- Dataset licenses (CLDR, GeoNames, IATA) before touching those sources
- Close read of `solve-engine` source (§5.8)

---

## 3. Decisions taken

These four were resolved before implementation because each one changes the shape of everything
below. All four shipped as written.

### 3.1 Strict input consumption, with tolerance as a possible later mode

The parser must consume the entire input. Any leftover token is a failure, and a failure returns
"not an expression" rather than a partial answer. Comment-word tolerance (Soulver's
`$10 for lunch + 15% tip`) is explicitly **not** a v1 feature.

The reason is not that tolerance is worse — for a notepad calculator it is clearly better. It is
that full consumption is a free, extremely strong correctness signal, and once you give it up you
have to build a confidence mechanism to replace it (§5.1). Starting strict means we can add
tolerance later behind a flag with the strict path as our reference oracle. Starting tolerant means
we never get the oracle at all.

Consequence: unrecognized words are errors. Ordinary English words are never keywords on their own;
`in`, `to`, `for`, `at` are recognized only in positions where nothing else parses (§5.1,
`solve-engine`'s position).

### 3.2 float64 now, predictability handled at the display layer

Two mature projects reached opposite conclusions here (§8.5), which means neither is wrong. We take
float64 because the zero-dependency constraint makes a decimal type our own code to write and
maintain, and because a displayed conversion rounded to 2–6 significant figures is nowhere near
float64's 15–17 digit boundary.

The real argument for decimals is legibility, not accuracy, so we address legibility directly:

- Round to significant figures at format time, never display raw float residue.
- Follow Soulver's two documented behaviors (§10): collapse near-zero residues so
  `sqrt(2) - 2^0.5` shows `0`, and **refuse** calculations that cannot retain accuracy
  (`1e100 + 1 - 1e100`) rather than silently returning `0`.

`Quantity.value` stays `number`, but every arithmetic operation goes through a single module so
swapping the numeric backend later is a contained change rather than a rewrite. Revisit if the
corpus produces a case where float64 is genuinely visible.

### 3.3 Units and arithmetic first; time zones last. Currency is out of scope.

Matches §15 except we drop currency. Units are the core. Time zones reuse almost none of
the quantity machinery and carry the largest data and maintenance tail (§9), so they went last.

Currency is a unit whose scale loads at runtime (§8.1). That is either a network call
inside `evaluate` or a `RateProvider` the host must supply. The first makes the engine
async and ties a free library to a third-party API. The second is configuration the 95%
path was never supposed to need. Neither belongs in the library. Historical rates, crypto, and an
injected provider are the same tradeoff deferred; they are not later work.

When application work begins, `apps/web` should demo a units-and-arithmetic calculator
first. A demo that does one domain convincingly is a better artifact than one that does
four badly. **This is the main remaining application milestone** (see §2.4).

### 3.4 Hand-authored unit data, cited per entry; `subscript` stays MIT

The GNU Units database is GPL-3.0-or-later and the license header is in the data file itself
(§11). We cannot vendor it, convert it, or reformat it. So we hand-author our table from the same
primary sources GNU Units cites — NIST SP 811 and CODATA — and record the source on each entry.
The underlying facts are not copyrightable; the compilation is.

This is real, boring work, and it is also the moat. The alias table _is_ the product (§14), and
building it ourselves is the only way we control it. **The table is seeded, not finished** (see
§2.2).

---

## 4. How developers interact with the library

Three layers, in order of how many people use them. All three shipped.

### 4.1 Layer 1 — one function

```ts
import { evaluate } from "@nicholasdly/subscript";

const result = evaluate("20 c to f");
// { ok: true, value: { ... }, text: "68 °F" }
```

Synchronous. No network. No configuration required. This is what 95% of consumers use and it should
be the entire README quickstart.

**A function, not a class.** A class is the wrong default here for a specific reason: a
`new Subscript()` that owns the unit table and the timezone aliases cannot be
tree-shaken, and the data tables are the bulk of the bundle (§13). Free functions importing only
what they need let a bundler drop the domains a consumer never touches. A class also implies
mutable instance state, and there is none — the engine is a pure function of `(input, config)`.
Per-domain entry points are still a future optimization (§2.3).

### 4.2 Layer 2 — a configured instance for the hot path

```ts
import { createSubscript } from "subscript";

const subscript = createSubscript({
  locale: "en-US",
  now: () => ({ epochMilliseconds: Date.UTC(2026, 0, 15, 18, 0, 0) }),
});

subscript.evaluate("3pm PST in Tokyo");
```

This exists for two reasons beyond configuration. First, per-keystroke evaluation means the alias
trie and the `Intl` formatter instances must be built once and reused (§4.6, §7.4) — the factory is
where that caching lives. Second, determinism: `now` is injected, never ambient, so a
test or a retried tool call cannot drift.

`evaluate(input)` from layer 1 is a thin wrapper over a lazily-created default instance.

### 4.3 Layer 3 — staged access, for hosts

Editors and launchers need more than an answer: they need to syntax-highlight the input and
re-evaluate incrementally. SoulverCore learned this the hard way — consumers reached for its
evaluation-oriented `TokenList` to do syntax coloring, and it had to add a separate semantics layer
because the internal token types change between releases (§13).

```ts
subscript.spans("20 c to f");
// [{ start: 0, end: 2, kind: "number" }, { start: 3, end: 4, kind: "unit" }, ...]
```

`spans()` is a stable, documented, semantic view. The raw pipeline stages (`normalize`, `lex`,
`rewrite`, `parse`) are exported from `@nicholasdly/subscript/internals` and explicitly **not**
covered by semver.

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
  | { kind: "ambiguous"; token: string; candidates: Candidate[] } // never returned today
  | { kind: "precision-loss" }
  | { kind: "limit-exceeded"; limit: LimitName };
```

`not-an-expression` is the common case and must be cheap — a launcher calls this on every
keystroke and discards most results.

`alternates` is where we honor §7.3: when a token is genuinely ambiguous (`in`), pick the
locale-biased default _and_ return the alternative. Silently choosing is the confident-wrongness
failure mode; refusing to choose is unhelpful. Returning both is neither.

---

## 5. How to approach each kind of parsing

The pipeline is settled — every mature system in the space converges on it (§2): normalize → lex →
rewrite → parse → evaluate → format. What follows is per-domain design reference; the engine
matches this shape.

### 5.1 Arithmetic

Pratt parsing (precedence climbing). Finished; not expected to be revisited except for deferred
grammar extensions.

```
query     := expr (converter target)?
converter := "to" | "in" | "as" | "→"
target    := unit | timezone | base
```

Deliberately deferred: inverted form (`meters in 10 km`) and bare two-unit shorthand (`km m`).

### 5.2 Units

Dimension vector of **rational** exponents over seven SI base dimensions (§7.1). Absolute and
difference temperatures are **distinct types** (§7.2). Mixed-unit arithmetic follows Soulver's
published rules (§6). Calendar-unit lengths (year, month) are named, documented constants in the
catalog.

### 5.3 Lexing

Trie with **leftmost-longest** match; ambiguous tokens (`in`) expand into alternate readings; the
conductor ranks readings and prefers `in` as converter when that reading evaluates. Case and locale
are tiebreakers.

### 5.4 The rewrite stage

Phrase fusion (multi-word aliases in the trie) and implicit operator insertion (`5 ft 11 in`).
Not every phrase from the research is in the catalog yet — see §2.2.

### 5.5 Currency — out of scope

No ISO codes, `$`, or money arithmetic. `evaluate` stays a pure synchronous function of
`(input, config)`. See M4.

### 5.6 Time zones

`ZonedTime` is separate from `Quantity`. Internal clock math on `Intl`; closed published alias list;
runtime tzdata. Shipped per M5.

---

## 6. Concerns this project brings

### 6.1 Confident wrongness is the whole risk

A converter that returns nothing is mildly annoying. One that is quietly off by 4% because it picked
the imperial fluid ounce is actively harmful. Mitigations in place: negative corpus, typed failures,
`alternates`, precision refusal. Still missing: differential testing (§2.1).

**Operating rule:** when in doubt, return nothing.

### 6.2 Data licensing is a real legal exposure

Hand-authored, cited data only. No GPL vendoring. Before touching CLDR, GeoNames, IATA, or UDUNITS,
answer the license questions in §2.6.

### 6.3 Every ambiguity has no correct answer

Resolved by policy, documentation, config switches, and `alternates` where applicable. Any new
alias must name the tradeoff publicly.

### 6.4 The work never finishes, and it finishes in the wrong order

The parser and evaluator are done. Normalization, the alias dictionary, and formatting are where
perceived quality lives. **This is the current phase** (§2.2).

### 6.5 A permanent maintenance tail

Timezone rules change via runtime tzdata; alias table grows forever. Relying on `Intl` pushes tzdata
maintenance onto platforms.

### 6.6 Untrusted input on every keystroke

No code generation. Length, depth, and node caps are in place. **Remaining:** exponent magnitude
budget (§2.3).

### 6.7 Bundle weight

Architecture supports tree-shaking (free functions, side-effect-free). **Remaining:** measure bundle,
consider per-domain entry points (§2.3).

### 6.8 `solve-engine` already exists

The reasons to build are control over the alias table, trigger behavior, and ambiguity policy. The
parser was never the moat. **Remaining:** validate that bet with a close read of `solve-engine`
(§2.4).

### 6.9 Performance is a constraint, not a goal

Hoisted formatters, trie built once, cheap `not-an-expression` path. Throughput smoke test exists;
stored baseline benchmark does not (§2.1).
