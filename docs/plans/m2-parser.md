# M2 — Lexer, rewrite, parser

Implementation plan for the third milestone in [`docs/plan.md`](../plan.md). That document
is _why_. This one is _what_, _where_, and _in what order_.

M0 committed a typed `evaluate` that refuses everything. M1 filled `Quantity` without
parsing. M2 is where natural language enters, and where the trigger philosophy of
`plan.md` §1.1 becomes real code: **strict full-input consumption**. Unrecognized words
are errors. `in` / `to` / `as` are recognized only in positions where a parse succeeds.
A leftover token is `not-an-expression`, not a partial answer.

The evaluator does not grow a second copy of unit math. After a successful parse, call
`quantity` / `convert` / `add` / `sub` / `mul` / `div` / `sqrt`. Affine rules, named-product
multiplication, and larger-unit-wins are already enforced.

**Exit:** `20 c to f`, `5 ft 11 in cm`, and `(2 + 3) * 4 km in miles` all evaluate; `1 min`
is a minute and `1 m in ft` is metres-to-feet; every reject fixture is still
`not-an-expression`; `spans()` returns a semantic coloring of the winning parse.

---

## 0. Current state

| Item          | Today                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Public API    | `evaluate`, `createSubscript`, `quantity` / `convert` / `add` / `sub` / `mul` / `div` / `sqrt` |
| `evaluate`    | always `{ ok: false, reason: { kind: "not-an-expression" } }`, never throws                    |
| `spans`       | always `[]`                                                                                    |
| `Quantity`    | `{ value, unit }`; no `offset` field; affine kind lives on the internal unit record            |
| Unit table    | length, mass, time, temperature, area, volume, speed; canonical SI ids; no aliases             |
| NL fixtures   | reject cases assert; accept cases are `todo: true`                                             |
| `api.test.ts` | asserts every seed input, including future accepts, is `not-an-expression`                     |
| Runtime deps  | zero (keep it that way)                                                                        |
| Provenance    | M0 and M1 logged                                                                               |

Treat as given, from [`docs/provenance.md`](../provenance.md):

- Layer 1 is a free `evaluate(input)`; configure via `createSubscript`.
- Tests inject `now`; they never read the ambient clock.
- Canonical ids stay SI spellings (`metre`, `litre`, `celsius`). The parser produces those
  ids from aliases; `quantity()` never has to accept `"c"`.
- Mixed-unit multiplication only yields a named unit in the table (or dimensionless).
- US gallon is 231 in³; imperial gallon is 4.54609 L. Locale-default `gallon` / `fl oz` is
  this plan.
- Year is the mean Gregorian year; month is year / 12.
- Reject fixtures must keep failing. After this plan ships, drop `todo` on the accept rows
  that now parse — do not invent a milestone gate.

---

## 1. Decisions

These close the forks that would otherwise leak into every token.

### 1.1 Strict consumption, no comment words

`plan.md` §1.1. The parser must consume the entire token stream. Unknown words, leftover
prose, and incomplete converters (`20 c to`) are `not-an-expression`.

Do not skip tokens. Skipping is comment-word tolerance, which is not v1, and it destroys
the free correctness signal that full consumption is.

Consequence: `how many ounces in a cup of coffee near me` stays `not-an-expression` even
though it contains `ounces` and `in`. The reject fixtures are the regression test for this.

### 1.2 Deterministic Pratt parse over lexer alternates

`plan.md` §3.3 / research §4.4. The parser is not a chart parser. The lexer may attach
**alternative readings** to tokens we have flagged as ambiguous. The pipeline runs the
parser (and, on success, the evaluator) over each reading in the small cross-product and
ranks the results.

The only M2 token that carries alternates is `in` (converter vs inch). The number of
ambiguous tokens per query is zero or one, so the cross-product is one or two.

Do not return `{ kind: "ambiguous" }` as a failure in M2. Rank, pick a winner, and if a
losing reading also evaluated to a **different** quantity, put it on `alternates`. If no
reading parses and evaluates, `not-an-expression`. Typed eval failures
(`dimension-mismatch`, `unknown-unit`, `precision-loss`) win over `not-an-expression`
only when that reading consumed the whole input — a well-typed-looking conversion to the
wrong dimension is information, a failed parse is not.

### 1.3 Ranking `in`

Documented default: **`in` is a converter**. Inch is the fallback.

| Input           | Converter reading               | Inch reading                         | Winner                                |
| --------------- | ------------------------------- | ------------------------------------ | ------------------------------------- |
| `1 m in ft`     | convert metre → foot            | `1 × m × in × ft` does not parse     | converter                             |
| `1 min`         | n/a (`min` is not `in`)         | n/a                                  | minute                                |
| `5 ft 11 in`    | `11` with no target             | `5 ft + 11 in` after rewrite         | inch                                  |
| `5 ft 11 in cm` | `11` with no target before `cm` | mixed length, then bare target `cm`  | inch                                  |
| `11 in`         | `11` with no target             | 11 inches                            | inch                                  |
| `11 in cm`      | convert inch → centimetre       | `11 in` then leftover `cm` as target | converter if both succeed — see below |

When **both** readings consume the input and evaluate:

1. Prefer the reading that used `in` as a converter **if and only if** a unit target
   follows it (explicit `to`/`in`/`as`/`→`, or a bare trailing unit).
2. Otherwise prefer inch.
3. Tie on score with different values: still pick by (1), attach the other as an
   alternate. Do not refuse.

`11 in cm` is convert-11-inches-to-cm under (1). That is the intended reading.

### 1.4 Locale picks gallon and fluid ounce; `oz` is mass

M1 ids stay unambiguous. Aliases are where locale matters.

| Locale prefix                                      | `gallon` / `gal` / `gallons` | `fl oz` / `fluid ounce` |
| -------------------------------------------------- | ---------------------------- | ----------------------- |
| `en-GB`                                            | `imperial-gallon`            | `imperial-fluid-ounce`  |
| everything else, including `en-US` and the default | `us-gallon`                  | `us-fluid-ounce`        |

Match on the BCP 47 language-region prefix, case-insensitive: `en-GB`, `en-GB-oxendict`
both imperial; `en`, `en-US`, `en-AU`, `de-DE` all US. Australia using US gallons is
wrong for some users and documented rather than clever. The switch is `createSubscript({
locale })`. The free `evaluate` uses `en-US`.

`oz` / `ounce` / `ounces` always map to avoirdupois `ounce`. They do **not** alternate
with fluid ounce. Fluid ounce is a different phrase (`fl oz`, `fluid ounce`). Silently
picking a fluid ounce for `oz` is the 4% confident-wrongness case in `plan.md` §5.1;
refusing to conflate them is the point of having distinct M1 ids.

Explicit `us gallon` / `imperial gallon` / `us fl oz` / `imp fl oz` ignore locale.

### 1.5 Aliases live in a separate table

Do not hang alias strings on `UnitDef`. `table.ts` stays the cited catalog. Aliases are
`units/aliases.ts`: `{ alias, id, locale?: "us" | "gb" }` plus a small set of
non-unit aliases (converters, `sqrt`). M1 ids remain the keys.

No prefix-composition engine. `km` is an alias of `kilometre`, not kilo + metre. M1
already authored the prefixed rows we need.

No inflection engine. Plurals are explicit rows in the alias list. Do not exceed §5.

### 1.6 Grammar: forward conversion, including a bare trailing unit

```
query     := expr (converter unit | unit)?
converter := "to" | "in" | "as" | "→"
expr      := Pratt expression
```

The bare trailing unit is what makes `5 ft 11 in cm` a conversion without a converter
word. It is **not** the deferred Soulver shorthand `km m` (one kilometre in metres with
no number). A query that is only two unit tokens, or a unit with no number, is
`not-an-expression`.

Deferred, still: inverted form (`meters in 10 km`), `km m` with an implicit 1.

`at` and `for` are not converters.

### 1.7 Rewrite inserts mixed-length addition; phrases live in the trie

Research §4.3 names two rewrite jobs. Split them:

- **Phrase fusion** is dictionary work. Multi-word aliases (`nautical mile`, `fluid ounce`,
  `square feet`, `miles per hour`) are trie entries that include spaces. The lexer matches
  leftmost-longest across spaces. Bounded by max alias length (32 code units). This is not
  unbounded lookahead.
- **Implicit operators** are the rewrite stage. The one M2 rule: a token sequence
  `number, foot-unit, number, inch-unit` becomes `number, foot-unit, +, number, inch-unit`.
  That is `5 ft 11 in` and `5 ft 11 in cm` (the trailing `cm` is then the query-level
  target).

Do not infer rates (`$30 × 4 days`). No currency. Do not turn `2.5k` into `2.5 * 1000`
in M2 — `k` is not a unit we have, and inventing a dimensionless kilo is a formatting
concern (M3 compact notation) more than a parse concern.

Juxtaposition `2km` / `2(3+4)` is lexer + Pratt, not rewrite: after a number, the next
token may be a unit (postfix) or `(`.

### 1.8 Postfix unit is multiplication / assimilation, not conversion

In the Pratt expression, a unit after an expr binds as a postfix operator:

- Dimensionless expr + unit → that quantity (`20` + `celsius` → `20 °C`).
- Expr with a unit + unit → `mul` (`10 m` × `m` → `100 m²` if the tokens are `10`, `m`,
  `m`; `10 m * 10 m` is infix `*`).

Conversion happens only at query level (`to` / `in` / `as` / `→` / bare trailing unit).
`20 c f` is therefore convert-20-celsius-to-fahrenheit via the bare-target production,
not a postfix product. Rank-wise this is the same shape as `20 c to f`.

If postfix `mul` would yield `unknown-unit` (`3 kg` postfix-`L`), that reading fails
evaluation. A query-level convert of the same tokens (`3 kg L`) is
`dimension-mismatch`. Prefer the query-level convert reading when the last token is a
unit and the prefix parses as a complete quantity — i.e. treat a final unit as a bare
target first, and only if that convert fails with `dimension-mismatch` while a postfix
`mul` would succeed, keep the product. For M2 the accept fixtures never hit this fork;
implement the “final unit is a target if the prefix is a complete quantity” rule so
`20 c f` and `5 ft 11 in cm` are conversions.

### 1.9 Temperature words are absolute

`20 c` / `20 °C` / `20 celsius` → `celsius`, never `delta-celsius`. Difference units
keep their M1 ids for the programmatic API. Do not add NL aliases for `delta-celsius`
or `delta-fahrenheit` in M2. `20 c + 5 c` is `dimension-mismatch` because the evaluator
already says so.

### 1.10 Case folding is for matching, not for the string

Do not lowercase the whole input (span offsets would lie, and M4 needs ISO-code case).

- Unit aliases and converter words match case-insensitively (`C` = `c` = celsius,
  `TO` = `to`).
- Operators are the characters themselves.
- The original slice is what `spans` reports.

`M` = metre in M2. We do not have molarity or a mega- prefix engine. Document it.

### 1.11 Decimal point is `.` regardless of locale

Locale in M2 affects unit defaults only. `1.234` is always one-and-a-bit. `,` is not a
thousands separator and not a decimal. `1,000` is `not-an-expression` (comma is not an
operator, `000` is not a legal continuation). Locale-dependent number syntax is M3
territory if it happens at all; do not smuggle it in here.

### 1.12 `text` stays the M1 stub; fixtures grow a numeric expect

`formatStub` remains `` `${value} ${symbol}` `` with `String(value)`. M3 replaces it.
`20 c to f` happens to format as `68 °F`; `1 m in ft` does not format as `3.2808 ft`.

So the fixture harness must stop requiring `text` equality for newly passing accepts.
Add `unitId` and `value` (with optional `eps`) on `{ ok: true }` expects. Assert those
in M2. Keep `text` on the row as the M3 target; assert `text` only when
`checkText: true`. Set `checkText: true` only on rows whose stub already matches
(`temp-c-to-f`, `lex-min-not-m`). M3 flips the rest.

### 1.13 Caps are named failures; nothing evals

`plan.md` §5.6. No `eval`, no `new Function`, no `new Function`-shaped code generation,
anywhere, ever. Caps:

| `LimitName`    | Budget                          | Applied                                     |
| -------------- | ------------------------------- | ------------------------------------------- |
| `input-length` | 256 code units of the raw input | before normalize                            |
| `parse-depth`  | 32                              | Pratt recursion / paren depth               |
| `node-count`   | 64 AST nodes                    | increment on every node; fail when exceeded |

Over budget → `{ ok: false, reason: { kind: "limit-exceeded", limit } }`. Empty and
whitespace are still `not-an-expression`, not a limit. 256 is plenty for a keystroke
query and cheap to reject.

### 1.14 Pipeline stages are not public API

`plan.md` §2.3. `spans()` is the stable coloring surface. Export `normalize`, `lex`,
`rewrite`, `parse` from `@repo/subscript/internals` so tests and a future host can
reach them, with a file comment that they are **not** covered by semver. Do not export
them from the package root.

### 1.15 Factory builds the trie once

`createSubscript` builds the locale-resolved alias trie and holds it in the closure.
`evaluate` / `spans` reuse it. The free `evaluate` keeps its lazy default instance.

`spans(input)` may re-run the pipeline; do not cache across calls. Return spans for the
**winning** reading, original-string offsets, half-open `[start, end)`. On failure,
return `[]` — a launcher that got `not-an-expression` should not paint a guess.

## 2. Target layout

```
packages/subscript/src/
  index.ts                 # unchanged public barrel (no internals)
  internals.ts             # unstable: normalize, lex, rewrite, parse
  types.ts                 # Fixture-facing types unchanged; Token lives next to the lexer
  create.ts                # builds trie; evaluate / spans run the pipeline
  evaluate.ts              # unchanged wrapper
  numeric.ts               # unchanged
  dimension.ts             # unchanged
  quantity.ts              # unchanged; pipeline is a caller
  pipeline.ts              # normalize → lex → rewrite → parse×readings → eval → rank
  normalize.ts
  lex.ts                   # trie, tokenize, alternates for `in`
  rewrite.ts               # mixed ft/in → insert +
  parse.ts                 # Pratt + query grammar
  rank.ts
  format.ts                # move formatStub here so M3 has one place to replace
  units/
    kinds.ts               # unchanged
    table.ts               # unchanged
    lookup.ts              # unchanged (by id)
    aliases.ts             # the M2 dictionary
    trie.ts                # leftmost-longest trie over aliases

packages/subscript/test/
  api.test.ts              # no longer claims every input is not-an-expression
  fixtures.test.ts         # unitId / value / checkText
  fixtures/accept.ts       # drop todo on M2 rows; add a few more
  fixtures/reject.ts       # unchanged rows; add incomplete converter
  aliases.test.ts          # uniqueness, locale gallon, oz is mass
  lex.test.ts              # min vs m, in alternates, 2km, offsets
  rewrite.test.ts          # 5 ft 11 in
  pipeline.test.ts         # ranking table in §1.3
  spans.test.ts
  limits.test.ts
  fuzz.test.ts             # seeded; never throws; well-formed Result
  bench.test.ts            # 1000× three exit inputs, elapsed < 2s
  quantity.test.ts         # unchanged
  units.test.ts            # unchanged
  numeric.test.ts          # unchanged
  dimension.test.ts        # unchanged

packages/subscript/package.json   # add "./internals" export
```

Do not add a VM, a bytecode compiler, or a third-party parser / lexer package.

---

## 3. Types (internal)

Public `Unit`, `Quantity`, `Result`, `Failure`, `Span`, `SpanKind` stay as they are.
Do not add `offset` or `dimension` to public `Quantity`.

```ts
export type TokenKind = "number" | "unit" | "converter" | "operator" | "function" | "unknown";

export type ConverterWord = "to" | "in" | "as" | "→";

export type Token = {
  readonly kind: TokenKind;
  readonly start: number; // original input
  readonly end: number;
  readonly raw: string;
  readonly value?: number; // number
  readonly unitId?: string; // unit reading
  readonly converter?: ConverterWord;
  readonly op?: "+" | "-" | "*" | "/" | "^" | "(" | ")";
  readonly name?: "sqrt"; // function
  readonly alt?: Token; // other reading; only `in` in M2
};

export type Ast =
  | { kind: "number"; value: number }
  | { kind: "quantity"; value: number; unitId: string }
  | { kind: "unary"; op: "-"; inner: Ast }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Ast; right: Ast }
  | { kind: "sqrt"; inner: Ast }
  | { kind: "convert"; expr: Ast; toId: string };
```

`spans` maps tokens (post-rewrite, winning reading) to `SpanKind`:

| Token       | SpanKind      |
| ----------- | ------------- |
| number      | `number`      |
| unit        | `unit`        |
| converter   | `converter`   |
| `+ - * / ^` | `operator`    |
| `( )`       | `punctuation` |
| `sqrt`      | `operator`    |
| unknown     | `unknown`     |

Do not emit `currency` or `timezone` spans in M2. Those kinds stay on the union.

---

## 4. Pipeline

### 4.1 Normalize

Input: raw string. Output: `{ text: string, map: number[] }` where `map[i]` is the
original index of `text[i]`. `map` is the same length as `text`.

Do, in order:

1. NFC.
2. Map operators: `−` (U+2212) → `-`, `×` (U+00D7) and `⋅` (U+22C5) → `*`, `÷` → `/`,
   `→` and `⟶` stay a converter word (replace with a single `→` so the lexer has one
   spelling).
3. Map `℃` → `°C`, `℉` → `°F` (compatibility characters).
4. Do **not** collapse whitespace here — the lexer skips it and the map stays 1:1 after
   the character replacements above (replacements that change length must update `map`).

Do not fold case. Do not rewrite superscripts (`100²`) in M2. Do not touch curly quotes
for feet/inches (`5′11″`).

### 4.2 Lex

Skip whitespace (Unicode Pattern_White_Space plus ordinary space/tab/newline).

At each position, try in order:

1. Number: ASCII digits with a single `.` (`20`, `20.5`, `.5`). No sign (unary minus is
   Pratt). No exponent (`1e3` is M2-out: `e` would be unknown or a unit). No `_`
   separators.
2. Trie, leftmost-longest, case-insensitive for `[A-Za-z]`, exact for non-letters
   (`°C`, `m/s`, `m²`). If the longest hit is flagged ambiguous (`in`), attach `alt`.
3. Single-character operator from the set `+-*/^()`.
4. Otherwise consume a maximal run of letters / marks as `unknown` and continue. Do not
   halt the lexer — the parser rejects the stream.

Trie match must not run through a letter that continues an identifier: after matching
`m` at the start of `min`, leftover `in` means we should have taken `min`. That is
exactly leftmost-longest: from that position the longest alias wins, so `min` beats
`m`. From `m in ft`, longest at `m` is `m` because `min` does not match. Word boundary
after a match: if the alias is all letters and the next char is a letter, **reject that
alias** (so `minimum` does not silently become `min` + `imum`). Aliases that contain
spaces or symbols (`fl oz`, `m/s`, `°C`) use their own end.

`sqrt` is a function token **only** when the next non-whitespace char is `(`. A bare
`sqrt` is `unknown`. Same positional rule `plan.md` quotes from solve-engine.

Build the trie at `createSubscript`. Insert converters `to`, `in`, `as`, `→` and every
alias from §5. `in` is inserted twice (converter + inch) and marked ambiguous.

### 4.3 Rewrite

One pattern, greedy left-to-right, no overlapping:

`number, unit(foot), number, unit(inch)` → insert operator `+` between the two
quantities.

Foot means unit id `foot`; inch means unit id `inch` (the inch reading of `in`, not the
converter reading). If the `in` token still has a converter alt, keep the alt on the
inch token so ranking can still try converter — but after a successful mixed-length
rewrite, the converter reading of that `in` will fail to parse (`11` with no target,
or `+` where a converter cannot sit), so inch wins. That is the table in §1.3.

Do not insert `+` between arbitrary same-dimension units (`5 m 11 cm` stays unparsed
unless we add it later). Mixed **feet and inches** is the M2 rule because it is the
exit case and the usual English compound.

### 4.4 Parse (Pratt)

Binding powers:

| Form             | Power | Assoc |
| ---------------- | ----- | ----- |
| infix `+` `-`    | 10    | left  |
| infix `*` `/`    | 20    | left  |
| infix `^`        | 30    | right |
| prefix unary `-` | 40    |       |
| prefix `sqrt(`   | 40    |       |
| postfix unit     | 50    |       |

`^` is dimensionless-only at evaluation time. `(3 km)^2` is `dimension-mismatch` (or
`unknown-unit` if someone implements it as mul by accident — do not). Integer powers of
dimensionless numbers are repeated `mul` or `numeric` exponentiation; non-finite →
`precision-loss`.

Parentheses. No implicit multiply between two numbers (`2 3` fails). Implicit multiply
between number and `(` : `2(3+4)` is `2 * (3+4)` — implement as a prefix/infix nudge in
Pratt when a `(` follows a completed primary, binding power 20.

Query wrap: after parsing `expr`, if the next token is a converter then a unit, or a
bare unit that is the last token, wrap `convert`. Anything left over → parse failure.

A unit token in prefix position (start of expr) is parse failure. `km in m` is the
deferred inverted form, not M2.

### 4.5 Evaluate

Straightforward walk:

| AST             | Call                          |
| --------------- | ----------------------------- |
| number          | `quantity(n)`                 |
| quantity        | `quantity(n, unitId)`         |
| unary `-`       | `mul(quantity(-1), inner)`    |
| `+` `-` `*` `/` | `add` / `sub` / `mul` / `div` |
| `^`             | see §4.4                      |
| `sqrt`          | `sqrt(inner)`                 |
| convert         | `convert(expr, toId)`         |

First `!ok` result is the pipeline result. Do not catch exceptions around this — those
functions do not throw.

### 4.6 Rank

Enumerate readings: tokens with `alt` fork the stream (alt first or second is
irrelevant if scoring is explicit). Cap forks at 4; more → `not-an-expression` (cannot
happen with one ambiguous token).

Score a successful eval: `+10` if every `in` that was taken as converter had a unit
target after it; `+1` for using leftmost-longest already implicit; `0` otherwise.
Highest score wins. Eval typed-failure that fully consumed still beats parse-failure.

`text` comes from `format.ts` on the winning `Quantity`.

---

## 5. Alias list (do not exceed)

All aliases are NFC. Matching is case-insensitive for Latin letters. Each alias maps to
exactly one id except `in` (inch + converter). Duplicate aliases that would collide
across units fail `aliases.test.ts` at load.

Do not add `nm` (nanometre is not in the table; nautical mile would be a silent lie).
Do not add `c` as cup, `f` as farad, `m` as minute, `g` as g-force, `t` as long ton.

### 5.1 Units

**metre:** `m`, `meter`, `meters`, `metre`, `metres`

**kilometre:** `km`, `kilometer`, `kilometers`, `kilometre`, `kilometres`

**centimetre:** `cm`, `centimeter`, `centimeters`, `centimetre`, `centimetres`

**millimetre:** `mm`, `millimeter`, `millimeters`, `millimetre`, `millimetres`

**inch:** `in` (ambiguous), `inch`, `inches`

**foot:** `ft`, `foot`, `feet`

**yard:** `yd`, `yard`, `yards`

**mile:** `mi`, `mile`, `miles`

**nautical-mile:** `nmi`, `nautical mile`, `nautical miles`

**kilogram:** `kg`, `kilogram`, `kilograms`, `kilo`, `kilos`

**gram:** `g`, `gram`, `grams`

**milligram:** `mg`, `milligram`, `milligrams`

**pound:** `lb`, `lbs`, `pound`, `pounds`

**ounce:** `oz`, `ounce`, `ounces`

**tonne:** `t`, `tonne`, `tonnes`, `metric ton`, `metric tons`

**second:** `s`, `sec`, `secs`, `second`, `seconds`

**millisecond:** `ms`, `msec`, `millisecond`, `milliseconds`

**minute:** `min`, `mins`, `minute`, `minutes`

**hour:** `h`, `hr`, `hrs`, `hour`, `hours`

**day:** `d`, `day`, `days`

**week:** `wk`, `week`, `weeks`

**month:** `mo`, `month`, `months`

**year:** `yr`, `year`, `years`

**kelvin:** `k`, `kelvin`, `kelvins`

**celsius:** `c`, `°c`, `degc`, `celsius`, `centigrade`

**fahrenheit:** `f`, `°f`, `degf`, `fahrenheit`

**rankine:** `°r`, `rankine`

**metre-squared:** `m²`, `m2`, `m^2`, `sq m`, `square meter`, `square meters`,
`square metre`, `square metres`

**kilometre-squared:** `km²`, `km2`, `km^2`, `sq km`, `square kilometer`,
`square kilometers`, `square kilometre`, `square kilometres`

**foot-squared:** `ft²`, `ft2`, `sq ft`, `square foot`, `square feet`

**inch-squared:** `in²`, `in2`, `sq in`, `square inch`, `square inches`

**hectare:** `ha`, `hectare`, `hectares`

**acre:** `ac`, `acre`, `acres`

**metre-cubed:** `m³`, `m3`, `m^3`, `cu m`, `cubic meter`, `cubic meters`,
`cubic metre`, `cubic metres`

**litre:** `l`, `liter`, `liters`, `litre`, `litres`

**millilitre:** `ml`, `milliliter`, `milliliters`, `millilitre`, `millilitres`, `cc`

**us-gallon:** `us gallon`, `us gallons`, `us gal`, `united states gallon` — plus
locale `us`: `gallon`, `gallons`, `gal`

**imperial-gallon:** `imperial gallon`, `imperial gallons`, `imp gal`, `uk gallon`,
`uk gallons` — plus locale `gb`: `gallon`, `gallons`, `gal`

**us-fluid-ounce:** `us fl oz`, `us fluid ounce`, `us fluid ounces` — plus locale `us`:
`fl oz`, `fluid ounce`, `fluid ounces`

**imperial-fluid-ounce:** `imp fl oz`, `imperial fluid ounce`, `imperial fluid ounces`
— plus locale `gb`: `fl oz`, `fluid ounce`, `fluid ounces`

**metre-per-second:** `m/s`, `mps`, `meters per second`, `metres per second`

**kilometre-per-hour:** `km/h`, `kph`, `kilometers per hour`, `kilometres per hour`

**mile-per-hour:** `mph`, `mile per hour`, `miles per hour`

**knot:** `kn`, `kt`, `knot`, `knots`

Also register each unit’s `symbol` from `table.ts` if it is not already in the list
(`°C`, `Δ°C` is **not** registered — difference temps are programmatic-only; `imp gal`,
`fl oz` symbols are locale-sensitive and already covered). Skip symbol `""` and skip
`Δ°C` / `Δ°F`. Register `K`, `°F`, `°R`, `mL`, `L` via the case-insensitive Latin
rules (`k` is kelvin **and** would collide with kilometre’s `k` in `kilo` — `k` alone
is kelvin; `km` is longer). **`k` as a bare alias is kelvin, not kilo.** `kilo` is the
word for kilogram. This is documented and tested.

Collision check: `m` is metre, not milli-anything. `min` is minute. `ms` is
millisecond, not metres. `c` is celsius, not cup.

### 5.2 Non-units

| Alias  | Token                     |
| ------ | ------------------------- |
| `to`   | converter                 |
| `in`   | converter (alt: inch)     |
| `as`   | converter                 |
| `→`    | converter                 |
| `sqrt` | function, only before `(` |

---

## 6. Tests

### 6.1 Harness

`fixtures/types.ts` — extend the ok expect:

```ts
expect:
  | {
      ok: true;
      text: string;
      unitId: string;
      value: number;
      eps?: number;       // default 0; relative 1e-12 is fine when set to e.g. 1e-9
      checkText?: boolean;
    }
  | { ok: false; reason: Failure["kind"] };
```

`fixtures.test.ts`: on ok, always assert `unitId` and `value` (absolute delta `eps` or
0). Assert `text` iff `checkText`. Reject rows stay kind-only.

`api.test.ts`: **delete** “evaluate currently rejects every seed input”. Keep “never
throws”. Keep “`createSubscript().evaluate` matches `evaluate`” on the seed inputs.
Change the spans test to expect the coloring in §6.4 for `20 c to f`, not `[]`.

### 6.2 Accept — drop `todo` on these, fill `unitId` / `value`

| `name`              | `input`                   | `unitId`     | `value`         | `checkText`    |
| ------------------- | ------------------------- | ------------ | --------------- | -------------- |
| `temp-c-to-f`       | `20 c to f`               | `fahrenheit` | 68              | true (`68 °F`) |
| `arith-km-to-miles` | `(2 + 3) * 4 km in miles` | `mile`       | `20 / 1.609344` | false          |
| `mixed-ft-in-cm`    | `5 ft 11 in cm`           | `centimetre` | 180.34          | false (float)  |
| `lex-min-not-m`     | `1 min`                   | `minute`     | 1               | true (`1 min`) |
| `lex-m-in-ft`       | `1 m in ft`               | `foot`       | `1/0.3048`      | false          |

Leave `todo: true` on `usd-in-eur` and `pst-in-tokyo`. Those inputs must still return
`not-an-expression` (unknown words), not a currency/timezone guess. The fixture expect
can stay as written for M4/M5; the todo keeps the equality from running. Add a note
that M2’s correct behavior is refuse.

Add accept rows (no todo):

| `name`            | `input`             | Expect                                      |
| ----------------- | ------------------- | ------------------------------------------- |
| `bare-number`     | `20`                | dimensionless `20`, checkText true (`20`)   |
| `two-plus-two`    | `2 + 2`             | `4`                                         |
| `glued-km`        | `2km`               | 2 kilometre                                 |
| `arrow-c-to-f`    | `20 c → f`          | same as `temp-c-to-f`                       |
| `as-converter`    | `20 c as f`         | same                                        |
| `m-times-m`       | `10 m * 10 m`       | 100 metre-squared                           |
| `km-plus-m`       | `1 km + 1000 m`     | 2 kilometre                                 |
| `abs-plus-abs-nl` | `20 c + 5 c`        | `dimension-mismatch`                        |
| `kg-times-l-nl`   | `3 kg * 3 L`        | `unknown-unit`                              |
| `c-to-kg`         | `20 c to kg`        | `dimension-mismatch`                        |
| `gallon-us`       | `1 gallon to litre` | locale default, `us-gallon` → 3.785411784 L |
| `gallon-gb`       | `1 gallon to litre` | `locale: "en-GB"` → 4.54609 L               |
| `oz-is-mass`      | `1 oz to g`         | 28.349523125 g (pound/16)                   |
| `sqrt-four`       | `sqrt(4)`           | 2 dimensionless                             |
| `unary-minus`     | `-5 + 3`            | `-2`                                        |

`gallon-gb` uses `locale: "en-GB"` on the fixture. `1 oz to g` uses the exact
avoirdupois factor already in the table (`0.45359237 / 16 * 1000` grams).

### 6.3 Reject — keep all existing; add

| `name`           | `input`          | Why                              |
| ---------------- | ---------------- | -------------------------------- |
| `incomplete-to`  | `20 c to`        | converter without target         |
| `inverted`       | `km in m`        | deferred inverted form           |
| `bare-two-units` | `km m`           | deferred shorthand               |
| `comment-for`    | `10 m for scale` | `for` is not a keyword; leftover |

Existing reject rows, including `question` and `send-to-john`, must still be
`not-an-expression`.

### 6.4 Spans

`20 c to f` (single spaces):

| start | end | kind        |
| ----- | --- | ----------- |
| 0     | 2   | `number`    |
| 3     | 4   | `unit`      |
| 5     | 7   | `converter` |
| 8     | 9   | `unit`      |

`1 min`: number, unit. `hello world`: `[]` (failure). Over-length input: `[]`.

### 6.5 Limits

- 257 `x` characters → `limit-exceeded` / `input-length`.
- A nested-paren string 33 deep of `(1)` → `parse-depth`.
- A chain of additions that would exceed 64 nodes → `node-count`.

Never throws. `eval("pwn")` remains `not-an-expression` from the reject list.

### 6.6 Fuzz

`fuzz.test.ts`: `Math.random` replaced by a seeded LCG, seed constant `0x5ub5cr1p`
(or any fixed uint32). 1000 strings, length 0–64, alphabet printable ASCII plus `°`.
Each: `evaluate` does not throw, result is well-formed (same check as the fixture
loop). Time-box the test to something generous (5s) so a hang fails.

When a finding is a real crash, shrink and commit it as a named reject or limits
fixture. Do not commit 1000 random strings.

### 6.7 Aliases

Load the alias table: every alias unique among non-ambiguous entries; `in` has exactly
two readings; `oz` does not resolve to a fluid ounce; `en-US` `gal` ≠ `en-GB` `gal`;
every `id` exists in `UNITS`.

### 6.8 Bench

1000 serial `evaluate` calls on the three exit inputs, sum elapsed `< 2s`. This is a
tripwire for accidental slowness, not a published throughput number.

---

## 7. Package wiring

`packages/subscript/package.json` `exports`:

```json
"./internals": {
  "types": "./src/internals.ts",
  "default": "./dist/internals.js"
}
```

Root export unchanged. `files` still `["dist"]`.

No README extractor. A short `packages/subscript/README.md` with the Layer 1 snippet
(`evaluate("20 c to f")`) is in scope because this is the first milestone where that
snippet is true. The accept fixtures are the executable copy; do not parse markdown
in tests yet.

---

## 8. Implementation order

Each step leaves `npm test` and `npm run typecheck` green.

1. `format.ts` (move stub). `limits` check on raw length in `create.ts` still returning
   `not-an-expression` for anything else. `limits.test.ts` for input-length.
2. `normalize.ts` + tests for operator maps and `℃`.
3. `units/aliases.ts` + `units/trie.ts` + `aliases.test.ts`. Locale gallon / `oz`.
4. `lex.ts` + `lex.test.ts` (`min` vs `m`, `2km`, `in` has alt, offsets via `map`).
5. `rewrite.ts` + `rewrite.test.ts`.
6. `parse.ts` Pratt for numbers and `+ - * / ( )` only; evaluate via `quantity`/`add`/…
   Wire `createSubscript.evaluate` for `2 + 2`. Update `api.test.ts` so it no longer
   demands universal refusal.
7. Postfix units, converters, bare target. `temp-c-to-f` passes.
8. Ranking for `in`. `lex-m-in-ft`, `lex-min-not-m`, mixed ft/in.
9. `sqrt(`, unary minus, `^` dimensionless, glued `2(3+4)` if cheap (not an exit case —
   skip `2(3+4)` if it slips; do not skip `2km`).
10. `spans()`. `parse-depth` / `node-count`.
11. Fixture rows §6.2–6.3. Fuzz. Bench.
12. `internals.ts` + package export. README snippet.
13. Append the M2 entry to `docs/provenance.md`.

No LICENSE, no package rename, no currency, no timezone, no `Intl`.

---

## 9. Done when

- `npm test` and `npm run typecheck` are green.
- `evaluate("20 c to f")` is `{ ok: true, value: { value: 68, unit: { id: "fahrenheit", … } }, text: "68 °F" }`.
- `evaluate("5 ft 11 in cm")` is centimetres, numeric value within `1e-9` of 180.34.
- `evaluate("(2 + 3) * 4 km in miles")` is miles, value `20 / 1.609344` within `1e-9`.
- `evaluate("1 min")` is `minute`, not `metre`.
- `evaluate("1 m in ft")` is `foot`.
- Every pre-existing reject fixture is still `not-an-expression`.
- `evaluate("how many ounces in a cup of coffee near me")` is still `not-an-expression`.
- `evaluate("100 usd in eur")` is still `not-an-expression` (todo row).
- `20 c + 5 c` is `dimension-mismatch`; `3 kg * 3 L` is `unknown-unit`.
- `1 gallon to litre` depends on locale as in §1.4; `1 oz to g` is mass.
- `spans("20 c to f")` matches §6.4.
- Input of length 257 is `limit-exceeded` / `input-length`.
- Fuzz: 1000 seeded strings, no throw.
- Zero runtime dependencies; no `eval` / `new Function` in `packages/subscript/src`.
- `docs/provenance.md` has an M2 log entry (aliases policy, `in` ranking, locale gallon,
  `oz` is mass, `text` still stub).

---

## 10. Out of scope

- `Intl` formatting, significant figures, near-zero collapse, `precision-loss` for
  `1e100 + 1 - 1e100`, compact `300k` (M3)
- Thousands separators, locale decimal comma (M3 if ever)
- Currency, `RateProvider`, `$`, ISO codes (M4)
- Time zones, `3pm`, `PST`, `Temporal` (M5)
- Comment-word tolerance, inverted conversion, `km m` shorthand
- Prefix composition engine, `2.5k`, `%`, unicode superscript exponents
- Curly-quote feet/inches, survey foot, short/long ton, cup/tsp
- NL aliases for delta temperatures
- Any changes to `apps/web`, including demo wiring and `alternates` UX
- Returning `{ kind: "ambiguous" }`
- Executable-markdown runner, differential testing against a previous publish
- LICENSE, npm rename, CI, fuzzing beyond the seeded 1000

If it is not in §8, it is not M2.

---

## 11. What M3 needs

- Replace `format.ts` only. Do not change AST ids; they are already canonical.
- Flip `checkText: true` on the remaining accept rows and tighten `text` (significant
  figures, `12.427 mi`).
- Hoist `Intl.NumberFormat` on the `createSubscript` instance next to the trie.
- Near-zero collapse and `precision-loss` go through `numeric.ts`, not the parser.
- Compact notation is a formatter option, not a lexer of `k` / `M`.
- `spans` already distinguishes number/unit/converter; formatting must not require new
  token kinds.
- After M3 ships, append a provenance entry. Do not reverse strict consumption, “no
  offset on `Quantity`”, “`oz` is mass”, or the `in` ranking table.
