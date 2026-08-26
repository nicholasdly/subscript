# Natural Language Parsing and Evaluation of Quantities

Research for `packages/subscript`: parsing/evaluating natural-language expressions for unit, currency, time zone conversion, and arithmetic. Read before design discussions — not a spec.

**Confidence:** `[verified]` primary source · `[secondary]` credible secondary · `[unverified]` not confirmed · `[design]` engineering judgment. §16 collects open items.

---

## 1. What the problem actually is

User types one line; system returns one value or nothing.

```
20 c to f | 100 usd in eur | 3pm PST in Tokyo | (2+3)*4 km in miles | 5 ft 11 in cm
```

**Not NLU.** Short arithmetic with English-spelled leaves + optional conversion target. Hard parts: alias equivalence (`lb`/`pounds`), homographs (`oz`, `IST`).

**Failure mode is confident wrongness**, not crashes. Imperial vs US fluid oz off by ~4% is harmful and undetectable. Justifies defensive engineering.

**Latency = keystroke budget.** No network in hot path; computation itself is trivial.

---

## 2. Central architectural finding

Every mature system converges on:

1. **Normalize** → 2. **Lex** (large alias dict) → 3. **Rewrite** (fuse phrases, implicit ops) → 4. **Parse** (small grammar) → 5. **Evaluate** (unified quantity type) → 6. **Format** (locale)

**Effort is counterintuitive:** parser + evaluator = days each, then done. Normalize, lex, format = never finished (data + locale). **[design]**

References: `solve-engine` (5-stage, normaliser between lex/parse) **[verified]**; SoulverCore (`TokenList` + `TokenListSemantics`) **[verified]**.

### 2.1 Duckling counterexample (ML does appear)

Meta Duckling: hand rules generate candidates → naive Bayes ranks them. Bottom-up stash-to-fixpoint parsing; negative corpus per dimension; fixed reference time for reproducible relative dates. **[verified]**

**For launcher calculators:** full-input consumption eliminates most ambiguity → deterministic parser viable. Duckling targets entity extraction from prose. Still worth stealing: candidate-then-rank fallback; negative corpus as test artifact. **[design]**

---

## 3. Prior art

### 3.1 SoulverCore — reference implementation

Closed-source `.xcframework`; free personal/non-commercial; commercial negotiable. 200+ units, 190+ currencies; 7k+ calc/s on Apple silicon; **zero third-party deps**. Localized (DE/RU/FR/ES/IT/JA/KO/ZH), non-English additive. Token types: numbers, dates, times, timespans, places, timezones, currencies, distances, temps, weights, areas, speeds, volumes, laptimes, timecodes, pitches, URLs, email, hashtags. **[verified]**

### 3.2 Raycast — deployment

Core calc/units offline; currency needs network. Rates via first-party proxy (`backend.raycast.com`), USD base; crypto separate endpoint. Lesson: base-currency normalization, separate crypto cadence, hide vendor behind proxy. **[verified/secondary]**

Soulver CLI: rates fetched once, cached `~/.config/soulver/currency-rates.json`. **[verified]**

### 3.3 TypeScript incumbents

- **`solve-engine`**: 5-stage pipeline; 22 feature packages; 1 dep (`@tanstack/query-core`); bytecode VM + 3 cache layers for per-keystroke workloads. **[verified]**
- **`@supercmd/calculator`**: intent order time→date→currency→unit→math; provider fallback chains; documents ambiguity (`m`→meter). **[verified]**
- **`pascalorg/lingo`**: adjacent (form/LLM boundaries); inverse humanization; explicit `now` for determinism. **[verified]**

### 3.4 Other engines

GNU Units: canonical dimensional analysis + `definitions.units` (~420KB, NIST/CRC/CODATA). **GPL — see §11.** libqalculate (GPL, shell-out path), Frink/Rink/Numbat (dimension typing), mathjs (JS incumbent). **[verified/unverified]**

### 3.5 `chrono-node`

`parsers[]` → `refiners[]` pipeline. `ParsingReference` = instant + timezone. Certainty tracking for partial dates. Refiner pattern = incremental disambiguation without touching parser. **[verified]**

---

## 4. Pipeline in detail

### 4.1 Normalization

Case fold, Unicode NF, whitespace, superscripts (`100²`→`100^2`), typographic ops (`−×÷→`), fraction chars, locale number syntax (`1.234` US vs DE). Soulver exposes locale conversion explicitly — no automatic answer is correct. **[verified]**

### 4.2 Lexing

Longest dictionary match over tens of thousands of aliases. Use trie or Aho-Corasick.

- **Leftmost-first:** priority by registration order — trap: `m` before `min` makes `min` unreachable.
- **Leftmost-longest:** safer default for units; layer explicit priority for ties. **[design]**

Core conflict: `1 min` (minute) vs `1 m in ft` (`m` + `in` preposition/inch). Needs context or ambiguity-tolerant parse. **[design]**

### 4.3 Rewrite

**Phrase fusion:** `light year`, `fluid ounce`, `New York`, `nautical mile`. **Implicit ops:** `5 ft 11 in` = addition; `$30 × 4 days` = rate; `2.5k` = multiply.

### 4.4 Parsing

Pratt/precedence climbing for arithmetic. Conversion grammar:

```
query := expr (converter target)?
converter := "to" | "in" | "as" | "→"
target := unit | currency | timezone | base | format
```

Also: inverted form (`meters in 10 km`), bare two-unit (`km m`). **[verified]**

**Deterministic vs ambiguity-tolerant:** deterministic = inspectable; ambiguity-tolerant = better UX for `oz`/`$`/`IST`. Middle ground: deterministic parse + lexer alternatives for known-ambiguous tokens, small cross-product, rank. **[design]**

### 4.5 Evaluation

Unified `Quantity`: value + dimension vector + scale + offset (affine). Operate in base units; dimensional mismatch = typed error (§5.3). Currency: runtime scale. Time zones: separate machinery (§9).

### 4.6 Formatting

Output string is the product. `Intl.NumberFormat` / `Intl.DateTimeFormat`; hoist formatter instances.

---

## 5. Trigger problem

Hardest product problem; best implementations disagree.

### 5.1 Two philosophies

**Soulver:** unrecognized words = comments. `$10 for lunch + 15% tip` works; `time` in timezone phrases is comment. Great for notepad calculators; loses full-input consumption as correctness signal. **[verified]**

**`solve-engine`:** ordinary words never keywords. Multi-word phrases only in complete-expression positions; function names only before `(`. Unparseable lines left alone — no guess, no partial eval. Right for launchers/editors over arbitrary text. **[verified]**

**Opposite defaults, not a slider.** Choice determines architecture. Decide early. **[design]**

### 5.2 Rejection metric

Out-of-scope detection: even best systems ~66% OOS recall while 96%+ in-scope accuracy (EMNLP-IJCNLP 2019). Recall matters — false positives = confident wrong answers.

**Negative corpus as important as positive.** Duckling institutionalizes this. **[design]**

### 5.3 Errors as values

`solve-engine`: errors and pending propagate through arithmetic, never coerced to numbers. "An error, never a guess." Critical for async currency (pending ≠ zero; stale ≠ fresh). **[verified/design]**

### 5.4 Untrusted input

No `eval`/`new Function`. Caps on length, depth, stack, allocation, recursion. Allocation budget because per-op limits don't compose. **[verified]**

---

## 6. Mixed-unit arithmetic (Soulver rules)

**[verified]** — de facto reference:

- Bare number adopts nearest unit: `300 + 20 km` → `320 km`; `$20 + 30` → `$50`
- Larger unit wins within dimension: `1km + 1,000m` → `2 km`
- Last unit wins across scales: `$200 + €200` → `€308.84`
- Multiplication restricted to known compound units: `10m × 10m` → `100 m²`; `3 kg × 3 L` → nothing (GNU Units would give `kg·L`)
- Implicit rate when multiply can't produce unit: `$30 × 4 days` → `$120`
- Rate division cancels unless requested: `3 hours / 3 days as hour/day` → `1 hour/day`
- Calendar units need explicit constants: year = 365.2425 days implied in examples; month is context-dependent

---

## 7. Units

### 7.1 Dimensional analysis

Rational exponents over 7 SI base dimensions. Convert to base, operate, convert out. Support rational exponents upfront. **[design]**

### 7.2 Affine units

Absolute vs difference temperatures are **distinct types**. `20°C × 2` meaningless; `20°C + 5ΔC` = 25°C. GNU Units defines both explicitly. Painful to retrofit. **[verified/design]**

### 7.3 Unresolvable without context

`oz` (mass/fluid), US vs imperial volumes (~20% gallon gap), `ton` variants, `lb` vs `lbf`, `m` (metre/minute), `G`/`B` (billion vs giga/byte/bel), `%` (modulo/percent).

Pattern: locale default + surface alternative; never silent choice. **[design]**

### 7.4 Formatting

`Intl.NumberFormat` `style: "unit"` — sanctioned list only or throws; `Intl.supportedValuesOf("unit")`. CLDR `unitPreferenceData` may help output-unit selection. **[unverified]**

---

## 8. Currency

### 8.1 Model

Currency = unit with runtime-loaded scale. One evaluator; complications are operational.

### 8.2 Refresh architecture

Never fetch on keystroke. Background snapshot, single base currency, triangulation, stale-with-timestamp on failure, crypto separate.

Soulver: hourly refresh + hard-coded floor rates; Raycast proxies; CLI disk cache; `@supercmd/calculator` provider chain. Hard-coded floor = "slightly wrong with warning" not "broken". **[verified]**

Triangulation ≠ tradeable rate. **[design]**

### 8.3 Symbol ambiguity

`$` → many currencies; Soulver resolves from OS region + disambiguating prefixes (`US$`, `C$`, …). ISO codes collide with English words (`IN`, `TO`, `IS`, `ALL`, `TRY`, …). Soulver: `requireUppercaseForAmbiguousTimezones` for airport codes — case as disambiguation signal. **[verified/design]**

### 8.4 Beyond spot

Historical rates and custom rates change architecture (time series vs snapshot). Explicit in/out decision. **[verified/design]**

### 8.5 Minor units / decimal choice

ISO 4217 minor-unit exponents; `Intl` handles JPY/Gulf currencies. Float64 sufficient for display precision; decimals buy predictability (`0.1+0.2`). Soulver uses `Decimal`; `solve-engine` uses doubles + big-int where needed. **[verified]**

---

## 9. Time zones and dates

### 9.1 Temporal (Aug 2026)

TC39 Stage 4 → ECMAScript 2026. Firefox 139+, Chrome/Edge 144+ shipped; **Safari stable not yet** (TP 249 only). Node/Deno/Bun **[unverified]**. Polyfill bundle sizes **[unverified]** — re-measure, don't repeat stale "50KB" claim.

Key types: `Instant`, `ZonedDateTime`, `PlainDateTime`, `PlainTime`, `Duration`. `ZonedDateTime.disambiguation` for DST gaps/overlaps.

Fallback: `Intl.DateTimeFormat` + `formatToParts()` for conversion (tzdata via runtime); awkward for arithmetic.

### 9.2 Lookup (product decision)

Soulver: city names (large populations), abbreviations, GMT offsets, airport codes, countries → **capital city's zone**. Wrong for multi-zone countries; better than failing.

Data candidates (license review needed): `vvo/tzdb`, CLDR, GeoNames, IATA. Top ~100 hand-curated aliases (`nyc`, `sf`, …) are the product. **[design]**

### 9.3 Abbreviations

`IST` = India/Ireland/Israel; `CST` = US/China/Cuba. Soulver publishes closed, locale-biased list (EST/EDT/… + "pacific time"). Distinguish `PST` (offset) vs `PDT` vs "pacific time" (zone). **[verified/design]**

### 9.4 Clock ambiguity

SoulverCore: `.literal24Hour` (`3:00`→03:00) vs `.preferDaytimeForAmbiguous12HourTimes` (`3:00`→3pm). Affects range duration. Name it, default it, expose switch. **[verified]**

### 9.5 DST / edge cases

Spring-forward gaps, fall-back duplicates, non-hour offsets (+5:30, +5:45), recent DST abolitions, date-line changes, month arithmetic, tzdata staleness. Stale tzdata = silently wrong — worst failure class. Runtime vs shipped tzdata = major maintenance decision. **[verified/unverified]**

---

## 10. Numerics

Soulver behaviors worth copying **[verified]**:

- `sqrt(2) - 2^0.5` → exactly `0` (no visible float residue)
- `1e100 + 1 - 1e100` → error (refuse rather than lie) — same principle as §5.3

Formatting: sig figs vs fixed decimals; `Intl` `maximumSignificantDigits`/`roundingMode`; compact notation (`300k`, `3.3M`) disableable.

---

## 11. Data sources and licensing

**Most consequential finding.**

GNU Units `definitions.units` is **GPL-3.0-or-later** (license in data file). Permissive `subscript` **cannot use it** — not vendored, converted, or reformatted. Facts (mile = 1609.344 m) aren't copyrightable; the compilation is. Build from NIST SP 811 / CODATA instead — real work, ask a lawyer. **[verified/design]**

Leads: pre-1997 FreeBSD `units` fork (permissive but stale); UDUNITS (UCAR, license TBD). Other datasets need review: CLDR (Unicode, generally permissive), UCUM, QUDT, IANA tzdb (public domain), ISO 4217, GeoNames (CC-BY?), IATA.

---

## 12. Testing

Golden `input → output` corpus on every commit — non-local failures, no type system catches wrong numbers.

1. **Negative corpus** (Duckling) — measures what matters (§5.2)
2. **Executable docs** (`solve-engine`) — doc examples are tests
3. **Fuzzing with committed corpus** — never crash/hang; failures → minimal reproducers
4. **Differential testing vs last release** — behavior changes must be deliberate

---

## 13. API and packaging

- **One function vs pipeline:** `calculate()` friendly; staged API needed for highlighting. Design highlighting surface separately (Soulver added `TokenListSemantics` after consumers abused internal tokens). **[verified]**
- **Sync vs async:** only currency async; pending as value type composes better. **[design]**
- **Bundle size:** tens of thousands of aliases; tree-shakeable domain modules + separate locale entry points (`solve-engine` pattern). **[verified]**
- **Network defaults:** inject rate provider; default-no-network safer for library. **[design]**
- **Dependency budget:** SoulverCore zero deps; `solve-engine` one — both deliberate. **[verified]**

---

## 14. Build vs buy

| Option         | Notes                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| SoulverCore    | Best engine; Swift/closed — not for TS npm lib                                     |
| libqalculate   | GPL; shell-out only                                                                |
| `solve-engine` | MIT, TS, architecturally serious — strongest "why build?" question                 |
| Build          | Math easy; moat = alias table + trigger policy + ambiguity policy — not the parser |

---

## 15. Plausible ordering

1. `Quantity` + dimension vector, units only — affine types now (§7.2)
2. Alias lexer + Pratt parser — decide trigger philosophy (§5.1); surfaces `m`/`min`/`in` conflicts
3. Golden + negative corpus from first commit
4. Formatting (early — perceived quality + constrains numerics)
5. Currency (runtime scale, injected provider, pending/stale values)
6. Time zones last (least reuse, most data, tzdata maintenance)

---

## 16. Open questions

Priority checklist — research tasks, not facts.

**Licensing (blocks data)**

- [ ] Any permissive use of GNU Units data? Pre-1997 FreeBSD fork? UDUNITS/CLDR/UCUM/QUDT/GeoNames/ISO 4217/IATA licenses?
- [ ] Permissively-licensed maintained unit database exists?

**Units**

- [ ] `Intl` sanctioned unit list size/behavior; CLDR `unitPreferenceData`
- [ ] US/imperial volume figures (re-derive)
- [ ] Numbat/Pint affine modeling; nonlinear units (dB, pH) in scope?
- [ ] JS libs in detail: mathjs, unitmath, js-quantities, convert

**Currency**

- [ ] Frankfurter + free provider terms (caching/redistribution)
- [ ] ISO 4217 minor units authoritative source; TC39 Decimal status
- [ ] ISO-code vs English-word collision severity; historical rates in scope?

**Time**

- [ ] Node/Deno/Bun Temporal support; polyfill bundle sizes (re-measure)
- [ ] `ZonedDateTime` disambiguation semantics; `vvo/tzdb` contents/license
- [ ] Runtime vs shipped tzdata; 2026 DST fixtures; recent DST changes

**Prior art**

- [ ] Numbat/Frink/Rink/Kalker; libqalculate fault-tolerant parsing; Recognizers-Text; mathjs `Unit` class; Duckling license; close read of `solve-engine` source
