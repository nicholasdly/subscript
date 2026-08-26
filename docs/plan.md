# Plan

A working plan for `packages/subscript`, derived from [`research.md`](./research.md) and
[`goal.md`](./goal.md). Section references like §5.1 point into the research document.

The package has since shipped. Treat this document as design intent, not a
status report. Settled facts live in [`history.md`](./history.md). The public
API lives in [`packages/subscript/README.md`](../packages/subscript/README.md)
and in JSDoc on `src/index.ts`.

Where the research presents a fork, this document picks a side and says why. Where it presents an
open question, this document says whether that question blocks us now or later. A plan whose every
item is "it depends" is not a plan.

---

## 0. Current state

- `packages/subscript` is a single empty `parse()` stub. No tests, no test runner, no data.
- Zero runtime dependencies today, which is the target end state too (§13, `goal.md`).
- Node ≥ 24, npm workspaces, Turborepo, oxlint/oxfmt at the root.
- `apps/web` is a Next.js 16 app with shadcn primitives wired up and nothing using the library yet.

Effectively greenfield. That is an advantage: the two decisions the research says are painful to
retrofit — affine unit types (§7.2) and the trigger philosophy (§5.1) — can both be made correctly
on the first commit instead of migrated into later.

---

## 1. Decisions taken

These four were resolved before planning because each one changes the shape of everything below.

### 1.1 Strict input consumption, with tolerance as a possible later mode

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

### 1.2 float64 now, predictability handled at the display layer

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

### 1.3 Units and arithmetic first; time zones last. Currency is out of scope.

Matches §15 except we drop currency. Units are the core. Time zones reuse almost none of
the quantity machinery and carry the largest data and maintenance tail (§9), so they go
last.

Currency is a unit whose scale loads at runtime (§8.1). That is either a network call
inside `evaluate` or a `RateProvider` the host must supply. The first makes the engine
async and ties a free library to a third-party API. The second is configuration the 95%
path was never supposed to need. Neither fits `goal.md`. Historical rates, crypto, and an
injected provider are the same tradeoff deferred; they are not later work.

When application work begins, `apps/web` should demo a units-and-arithmetic calculator
first. A demo that does one domain convincingly is a better artifact than one that does
four badly. Application integration is planned separately from the package milestones
below.

### 1.4 Hand-authored unit data, cited per entry; `subscript` stays MIT

The GNU Units database is GPL-3.0-or-later and the license header is in the data file itself
(§11). We cannot vendor it, convert it, or reformat it. So we hand-author our table from the same
primary sources GNU Units cites — NIST SP 811 and CODATA — and record the source on each entry.
The underlying facts are not copyrightable; the compilation is.

This is real, boring work, and it is also the moat. The alias table _is_ the product (§14), and
building it ourselves is the only way we control it.

---

## 2. How developers interact with the library

Three layers, in order of how many people use them.

### 2.1 Layer 1 — one function

```ts
import { evaluate } from "subscript";

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

### 2.2 Layer 2 — a configured instance for the hot path

```ts
import { createSubscript } from "subscript";

const subscript = createSubscript({
  locale: "en-US",
  now: () => Temporal.Now.instant(), // injected, never read from the ambient clock
});

subscript.evaluate("3pm PST in Tokyo");
```

This exists for two reasons beyond configuration. First, per-keystroke evaluation means the alias
trie and the `Intl` formatter instances must be built once and reused (§4.6, §7.4) — the factory is
where that caching lives. Second, determinism: `now` is injected, never ambient, so a
test or a retried tool call cannot drift (`lingo`).

`evaluate(input, options?)` from layer 1 is a thin wrapper over a lazily-created default instance.

### 2.3 Layer 3 — staged access, for hosts

Editors and launchers need more than an answer: they need to syntax-highlight the input and
re-evaluate incrementally. SoulverCore learned this the hard way — consumers reached for its
evaluation-oriented `TokenList` to do syntax coloring, and it had to add a separate semantics layer
because the internal token types change between releases (§13).

So we design that surface deliberately and separately from the start:

```ts
subscript.spans("20 c to f");
// [{ start: 0, end: 2, kind: "number" }, { start: 3, end: 4, kind: "unit" }, ...]
```

`spans()` is a stable, documented, semantic view. The raw pipeline stages (`normalize`, `lex`,
`rewrite`, `parse`) are exported from `subscript/internals` and explicitly **not** covered by
semver. Anyone reaching into them is on notice.

### 2.4 The result type

Errors are values, not exceptions (§5.3). Nothing in the public API throws for
input-shaped reasons.

```ts
type Result =
  | { ok: true; value: Quantity; text: string; alternates?: Alternate[] }
  | { ok: false; reason: Failure };

type Failure =
  | { kind: "not-an-expression" } // strict consumption failed
  | { kind: "dimension-mismatch"; from: Unit; to: Unit }
  | { kind: "unknown-unit"; token: string }
  | { kind: "ambiguous"; token: string; candidates: Candidate[] }
  | { kind: "precision-loss" } // §10, refusing rather than lying
  | { kind: "limit-exceeded"; limit: LimitName }; // §5.4
```

`not-an-expression` is the common case and must be cheap — a launcher calls this on every
keystroke and discards most results.

`alternates` is where we honor §7.3: when a token is genuinely ambiguous (`oz`, `IST`), pick
the locale-biased default _and_ return the alternative, so a host can offer it. Silently choosing is
the confident-wrongness failure mode; refusing to choose is unhelpful. Returning both is neither.

---

## 3. How to approach each kind of parsing

The pipeline is settled — every mature system in the space converges on it (§2): normalize → lex →
rewrite → parse → evaluate → format. What follows is per-domain, and the recurring theme is that
each domain contributes a _lexer vocabulary_ and an _evaluation rule_, not its own parser.

### 3.1 Arithmetic

Pratt parsing (precedence climbing). This is a solved problem, roughly a page of code, and it
extends cleanly because each token type owns its own binding power (§4.4). Expect this to be
finished and never seriously revisited.

Grammar on top of it stays tiny:

```
query     := expr (converter target)?
converter := "to" | "in" | "as" | "→"
target    := unit | timezone | base
```

Deliberately deferred: the inverted form (`meters in 10 km`) and the bare two-unit shorthand
(`km m`) that Soulver supports (§4.4). Both are easy additions once the forward form is solid.

### 3.2 Units — the core, and the one to get right first

Dimension vector of **rational** exponents over the seven SI base dimensions (§7.1). Rational
rather than integer costs almost nothing now and is annoying to retrofit when someone types
`sqrt(m^2)`.

Absolute and difference temperatures are **distinct types**, not one type with an offset field
(§7.2). `20°C + 5°C` is meaningless; `20°C + 5ΔC` is 25°C. GNU Units models both explicitly, and
retrofitting the distinction changes the type of every temperature value in the system. This is the
single strongest "do it now" item in the research.

Mixed-unit arithmetic follows Soulver's published rules (§6), because they are the de facto
reference and because they are chosen for user comprehension rather than mathematical closure:
bare numbers assimilate the nearest unit, the larger unit wins within a dimension, and
multiplication only produces units that actually exist (`10m × 10m` → `100 m²`; `3kg × 3L` →
nothing, because "kg·L" is not a unit anyone recognizes).

Calendar-unit lengths (how many days in a year, in a month) are named, documented constants, not
values buried in a conversion table (§6). Any answer is wrong somewhere; an undocumented answer is
wrong _and_ unexplainable.

### 3.3 Lexing — where the actual difficulty is

Trie with **leftmost-longest** match semantics, plus an explicit priority mechanism for real ties
(§4.2). Leftmost-first is a trap: if `m` is registered before `min`, `min` becomes permanently
unreachable.

Longest-match alone is still insufficient, and the canonical case is worth stating because we will
hit it on day one: `1 min` must lex `min` as minute, while `1 m in ft` must lex `m` as metre and
`in` as a preposition — and `in` is simultaneously the symbol for inch. Pure longest-match on a flat
dictionary cannot resolve this.

Our answer, per §4.4's middle ground: the lexer may return **alternative interpretations** for
tokens we have flagged as ambiguous. The parser runs deterministically over each candidate reading,
and we rank the small cross-product with a simple scoring function. The number of ambiguous tokens
in a real query is almost always zero or one, so this stays cheap. It also gives us `alternates` in
the result type for free.

Cheap disambiguation tricks worth adopting: case sensitivity as a signal (Soulver requires uppercase
for ambiguous airport codes so `bus` doesn't match `BUS`, §8.3), and locale as a tiebreaker.

### 3.4 The rewrite stage

The stage most implementations don't name and the one doing the actual natural-language work (§4.3).
Two jobs, both token-stream pattern matches rather than unbounded lexer lookahead:

- **Phrase fusion** — `light year`, `fluid ounce`, `nautical mile`, `pacific time` become single
  tokens.
- **Implicit operator insertion** — `5 ft 11 in` is an addition.

Keeping this separate is what lets the grammar stay small enough to reason about.

### 3.5 Currency — out of scope

A currency is a unit whose scale factor loads at runtime and changes daily (§8.1). That is
the whole problem, and it has no shape that fits this library:

- A built-in fetch makes `evaluate` async, adds a third-party network dependency, and
  silently fails offline. `solve-engine` is candid that its defaults fetch unprompted
  with no host configuration (§13); for a library that is the less defensible choice.
- An injected `RateProvider` keeps the package offline, but every consumer then has to
  supply rates. The one-function path in §2.1 stops being the whole quickstart.

So we do not parse ISO codes, `$`, or money arithmetic. `100 usd in eur` is
`not-an-expression`. No rate failure kinds, no `currency` span kind, no dimension `C`.
`evaluate` stays a pure synchronous function of `(input, config)`.

Historical rates, crypto, a hard-coded rate floor, and a separate rates package are the
same tradeoff under other names. They are not v1 and they are not a later milestone.

### 3.6 Time zones

The only domain that does not fit `Quantity` and needs its own machinery (§4.5). Two separable
problems, and the interesting one is not the one that looks hard:

**Arithmetic is solved.** `Temporal` reached Stage 4 and is in ECMAScript 2026, but Safari stable
has not shipped it (§9.1). Rather than take a polyfill dependency or gate on runtime support, we
define a narrow internal interface for the handful of operations we need and implement it on
`Intl.DateTimeFormat` + `formatToParts()`, which works everywhere today because browsers already
ship tzdata for `Intl`. If a host has `Temporal`, we can back the same interface with it later.

**The lookup is the actual work**, and it is a product decision dressed as a data problem (§9.2).
Resolving `sf` → `America/Los_Angeles` is not solved by any library. Our positions:

- A **closed, published, locale-biased list** of abbreviations rather than pretended general
  coverage (§9.3). `IST` is three zones and `CST` is three zones; Soulver's answer is to document
  that `CST` means US Central and that Chinese Standard Time is simply not reachable by
  abbreviation. That is better than a complete but ambiguous mapping.
- Distinguish `PST` from `PDT` and _also_ offer `pacific time` as a zone-valued third option, so the
  user can say which they meant (§9.3).
- For countries spanning zones, use the capital city, and say so in the docs (§9.2). Arbitrary but
  documented beats failing.
- The top few hundred hand-curated aliases are the product, and no dataset ships them (§9.2).
- Name the clock-time ambiguity, pick a default, expose the switch: `3:00` means 03:00 by default
  (§9.4).

Rely on the runtime's tzdata rather than shipping our own. Shipping our own means owning a
multiple-release-per-year update treadmill where staleness produces silently wrong answers — the
worst failure class in the whole research document (§9.5).

---

## 4. Priorities

Milestones with exit criteria. The ordering follows §15, with one change: the test corpus moves to
M0 because it is what makes everything after it safe.

### M0 — Foundations

Cheap, and everything else depends on it.

- Pick and wire a test runner. Recommendation: built-in `node:test` + `node:assert` — Node 24
  supports it, and since a data-driven corpus harness is ours to write regardless, a framework buys
  us little. Add a `test` task to `turbo.json`.
- Build the **corpus harness**: tables of `input → expected` read from data files, one case per row,
  with a fixed reference instant so relative dates are reproducible (§12, Duckling).
- Build the **negative corpus** alongside it, in the same harness. Per §5.2, out-of-scope recall is
  the metric that actually matters — the best systems in the literature manage 66% — and the corpus
  of things that must _not_ parse is at least as important as the corpus of things that must.
- Public API skeleton: `evaluate`, `createSubscript`, the `Result` union. Every input returns
  `{ ok: false, reason: { kind: "not-an-expression" } }`. This makes the contract reviewable before
  any behavior exists.
- Fix `packages/subscript/package.json`: `exports.default` points at `./dist/parse.ts`, which is a
  `.ts` path in a build output and will not resolve. Also decide the published name now and check
  npm availability — `@repo/subscript` is a workspace-internal name and `goal.md` intends to publish
  as `subscript`.
- Add `LICENSE` (MIT) and a `docs/history.md` stub, so per-entry data sourcing has a home from
  the first unit we add (§1.4, §11).

**Exit:** `npm test` runs, the corpus harness executes both corpora, the API shape is committed.

### M1 — `Quantity`, dimensions, affine units

No natural language at all. Programmatic construction and conversion only.

- Rational-exponent dimension vector over the seven SI base dimensions.
- Absolute vs difference temperature as distinct types.
- Dimensional mismatch as a typed failure, never a thrown exception.
- Mixed-unit arithmetic rules from §6.
- A first hand-authored unit table — length, mass, time, temperature, area, volume, speed — with a
  cited source per entry.

**Exit:** every conversion in the corpus that does not require parsing passes, and the affine
distinction is enforced by the type system rather than by convention.

### M2 — Lexer, rewrite, parser

Where natural language enters, and where the trigger philosophy of §1.1 becomes real code.

- Leftmost-longest trie with priority overrides; alternates for flagged-ambiguous tokens.
- Rewrite stage: phrase fusion, implicit operators.
- Pratt parser; strict full-input consumption.
- Candidate ranking across the lexer's alternates.
- Input limits from §5.4 — length, parse depth, node count. No `eval`, no `new Function`, anywhere,
  ever.

**Exit:** `20 c to f`, `5 ft 11 in cm`, and `(2 + 3) * 4 km in miles` all evaluate. The negative
corpus passes, including the `m` / `min` / `in` cases.

### M3 — Formatting

Earlier than instinct suggests, for two reasons from §4.6: the output string is the entire product
from the user's point of view, and formatting decisions constrain the numeric representation, so
making them late means revisiting M1.

- `Intl.NumberFormat` for numbers and units, with hoisted formatter instances (§7.4).
- Our own display-name table for units outside `Intl`'s sanctioned list.
- Significant-figure rounding; the near-zero collapse and precision-loss refusal from §1.2.
- Compact notation (`300k`, `3.3M`) as Soulver defaults to, disableable (§10).

**Exit:** every positive corpus case asserts on the formatted string, not just the numeric value.

### M4 — Currency — cancelled

Currency conversion is out of scope. See §3.5. The work that landed here (Frankfurter, async
`evaluate`, dimension `C`, an ISO catalog) was reversed so the engine is synchronous and
has no network.

### M5 — Time zones

Per §3.6. Last because it reuses the least and carries the most maintenance.

**Exit:** `3pm PST in Tokyo` works; the supported alias list is published as documentation rather
than discovered by trial and error.

### Continuous, from M2 onward

- **Executable documentation** — every example in the README and docs is run by the test suite, so
  documentation for a system this data-driven cannot rot invisibly (§12, `solve-engine`).
- **Fuzzing with a committed corpus** — a seeded fuzzer asserting three invariants: nothing crashes,
  nothing hangs, every failure is a well-formed `Result` rather than a raw exception. Shrink findings
  to minimal reproducers and commit them so a fixed bug cannot come back quietly (§12).
- **Differential testing against the previous release** — compare the whole corpus against the last
  published version and classify every difference, so behavior changes are deliberate rather than
  discovered (§12). Unusually high-value for a library whose entire output surface is numbers and
  strings.

### Explicitly not now

Documented as out of scope so they are decisions rather than oversights: comment-word tolerance,
currency conversion, historical rates, non-English input, logarithmic units (dB, pH), variables and
multi-line documents, bytecode compilation or a VM (`solve-engine` justifies its VM by a
per-keystroke-on-a-whole-document workload we do not have yet, §3.3).

---

## 5. Concerns this project brings

### 5.1 Confident wrongness is the whole risk

A converter that returns nothing is mildly annoying. One that is quietly off by 4% because it picked
the imperial fluid ounce is actively harmful, and the user has no way to detect it (§1). Every other
concern on this list is downstream of this asymmetry, and it justifies defensive engineering that
would be excessive in most libraries: the negative corpus, refusing rather than guessing, typed
failures, differential testing, `alternates` instead of silent choice.

The operating rule: **when in doubt, return nothing.** A blank result costs a retry. A wrong number
costs trust, and possibly more than trust.

### 5.2 Data licensing is a real legal exposure

The best unit database in existence is GPL-3.0 and cannot be used (§11). This is not a
technicality — derived-work rules apply to data files bundled with a program, and the precedent runs
the other way: `mcp-gnu-units` vendored the file and became GPL itself. Reformatting or converting
it does not help.

Mitigation: cite the primary source on every data entry from the first commit, never copy a
compilation, and keep `docs/history.md` current. The `§16` license questions — CLDR, GeoNames,
IATA, UDUNITS — need answers before those datasets are touched, not after.

### 5.3 Every ambiguity has no correct answer

`oz`, `IST`, `m`, `%`, `G`, US vs imperial gallons, `PST` in July, whether `3:00` is 3am or 3pm.
The research is unambiguous that these cannot be resolved by cleverness — they are resolved by
policy. The discipline: **name it, pick a locale-biased default, document it publicly, expose the
switch, and surface the alternative in the result.** Any ambiguity we resolve silently and don't
document becomes a bug report we cannot explain.

### 5.4 The work never finishes, and it finishes in the wrong order

The parser and evaluator — the parts that feel like real computer science — are days of work each
and then done. Normalization, the alias dictionary, and formatting are where perceived quality
lives, and they never finish, because they are data and locale problems (§2). The failure mode is
spending months on parser elegance and shipping something that doesn't know `lbs` is `lb`.

Guard: track corpus pass rate as the progress metric, not code written.

### 5.5 A permanent maintenance tail

IANA publishes tzdata multiple times a year and stale rules produce silently wrong answers (§9.5).
The alias table grows forever. Deciding to rely on runtime tzdata (§3.6) is partly a decision to
push that tail onto platforms that already carry it.

### 5.6 Untrusted input on every keystroke

The library evaluates whatever was typed, possibly inside someone else's editor. Treat it as a
security boundary (§5.4): no `eval`, no `new Function`, no code generation. Caps on expression
length, parse depth, and node count, each raising a named recoverable failure. Note the compositional
trap: per-operation limits do not compose, because two individually legal numbers can exponentiate
into a fatal one, so a total budget is needed alongside per-step ones.

### 5.7 Bundle weight

Tens of thousands of aliases across units, cities, and timezones is real weight (§13).
This is why layer 1 is free functions rather than a class (§2.1), why domain modules must be
independently importable, and why locale data should be separate entry points. Measure the bundle
from M2 rather than discovering it at publish time.

### 5.8 `solve-engine` already exists

It is MIT, TypeScript, architecturally sound, one runtime dependency, and does most of this. The
research names it as the strongest argument against building `subscript` at all (§14), and that
deserves a real answer rather than a shrug.

The honest answer: the reasons to build are control over the alias table, control over trigger
behavior, and control over the ambiguity policy — which is to say, control over the three things
that _are_ the product. Zero dependencies and a smaller, more opinionated surface are the
differentiators. The reason _not_ to build is that the parser looks interesting, and the parser is
the part that finishes. If in six months our alias table and ambiguity policy are not visibly better
than `solve-engine`'s, the project has no reason to exist and we should say so out loud.

### 5.9 Performance is a constraint, not a goal

The budget is a keystroke (§1), and the computation is trivial, so this is mostly about not doing
anything stupid: hoist `Intl` formatters, build the trie once, keep the `not-an-expression` path
cheap. SoulverCore's published 7k calculations/second is a useful reference point. Add a benchmark
at M2 so regressions are visible, and resist caching layers until a measurement asks for them.

---

## 6. Questions that block us soon

From §16, the subset that has to be answered on the current path. The rest can wait for the
milestone that needs it.

**Before M1 (unit data):**

- Is there _any_ permissively-licensed, actively-maintained unit database? If yes, M1's data work
  shrinks considerably.
- Re-derive the US/imperial volume divergence figures from primary sources rather than repeating
  them.
- How do Numbat, Pint, and Boost.Units model affine units? Numbat's static dimension typing is the
  most interesting unexamined lead in the research, and M1 is exactly when it is cheap to learn from.

**Before M3 (formatting):**

- Exact contents of the `Intl.NumberFormat` sanctioned unit list, and the behavior of
  `Intl.supportedValuesOf("unit")` — this determines how large our own display-name table must be.
- Does CLDR `unitPreferenceData` exist, and does it answer "what unit should the result be in" by
  locale and usage?

**Before M5 (time zones):**

- What `vvo/tzdb` actually contains, how it is generated, its size and license.
- Exact semantics of `ZonedDateTime`'s `disambiguation` and `offset` options, for whenever we back
  the internal interface with `Temporal`.
- Confirm real 2026 DST transition dates before using any as test fixtures.

**Worth doing regardless:**

- A close read of `solve-engine`'s source, per §5.8.
