# M3 — Formatting

Implementation plan for the fourth milestone in [`docs/plan.md`](../plan.md). That document
is _why_. This one is _what_, _where_, and _in what order_.

M0 stubbed `evaluate`. M1 filled `Quantity`. M2 made natural language evaluate. The
output string is still the M1 stub: `String(value)` plus `unit.symbol`, with a relative
near-integer nudge. `1 m in ft` is a correct foot and an ugly `3.280839895013123`.
`plan.md` §4.6 put formatting here because the string _is_ the product, and because
rounding policy belongs next to the numeric seam, not bolted on after currency.

**Exit:** every non-todo accept fixture asserts on `text`; `1 m in ft` is `3.28084 ft`;
`sqrt(2) - 2^0.5` is `0`; `1e100 + 1 - 1e100` is `precision-loss`; compact `300k` is
on by default and disableable.

---

## 0. Current state

| Item              | Today                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Public API        | `evaluate`, `createSubscript`, `quantity` / `convert` / `add` / `sub` / `mul` / `div` / `sqrt` |
| `text`            | `formatQuantity`: relative near-integer nudge, then `String(value)` + symbol                   |
| `createSubscript` | caches the alias trie; locale picks gallon / fl oz; no formatter                               |
| `numeric.ts`      | identity wrappers around `+ - * / ** Math.sqrt`; non-finite → `precision-loss` in `ok()`       |
| Lexer numbers     | ASCII digits, one `.`; no sign; no exponent; no separators                                     |
| Accept fixtures   | `unitId` / `value` always; `text` only when `checkText: true`                                  |
| Runtime deps      | zero (keep it that way)                                                                        |
| `apps/web`        | still unused                                                                                   |
| History           | M0, M1, M2, and the post-M2 review logged                                                      |

Treat as given, from [`docs/history.md`](../history.md):

- Unary minus negates the literal. `-20 °C` is a temperature.
- `Token` is a closed union. Invented rewrite tokens span nothing.
- Canonical ids stay SI spellings. Public `Quantity` has no `offset`.
- `oz` is avoirdupois mass. `in` ranks as converter when a target follows.
- `^` is dimensionless-only. `numeric.ts` is the numeric seam.
- Strict full-input consumption. Pipeline stages are not semver.
- Locale affects unit defaults only. Input decimal point is `.`.

`m2-parser.md` §11 already pointed here: replace `format.ts`, hoist `Intl` on the
instance, put near-zero collapse and `precision-loss` through `numeric.ts`, treat
compact as a formatter option, flip the remaining `checkText` rows.

---

## 1. Decisions

These close the two questions `plan.md` §6 parked until M3, and the forks that would
otherwise leak into every `text`.

### 1.1 The sanctioned `Intl` list is small; do not format units with it

`Intl.supportedValuesOf("unit")` is the ECMA-402 sanctioned simple-unit list. Common
implementations expose the same 45 identifiers (MDN / ECMA-402 table):

`acre`, `bit`, `byte`, `celsius`, `centimeter`, `day`, `degree`, `fahrenheit`,
`fluid-ounce`, `foot`, `gallon`, `gigabit`, `gigabyte`, `gram`, `hectare`, `hour`,
`inch`, `kilobit`, `kilobyte`, `kilogram`, `kilometer`, `liter`, `megabit`,
`megabyte`, `meter`, `microsecond`, `mile`, `mile-scandinavian`, `milliliter`,
`millimeter`, `millisecond`, `minute`, `month`, `nanosecond`, `ounce`, `percent`,
`petabyte`, `pound`, `second`, `stone`, `terabit`, `terabyte`, `week`, `yard`,
`year`.

Compounds are exactly two of those joined by `-per-` (`meter-per-second`,
`mile-per-hour`). Anything else throws `RangeError`.

Against our table that is a split personality, not a formatter:

| In the list                                                                                                                               | Not in the list, and we have it                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| metre, km, cm, mm, inch, foot, yard, mile, kg, g, lb, oz, s, ms, min, h, d, wk, mo, yr, °C, °F, L, mL, gal, fl oz, ha, ac, m/s, km/h, mph | nautical mile, milligram, tonne, kelvin, rankine, Δ°C, Δ°F, m², km², ft², in², m³, imperial gallon, imperial fl oz, knot |

`style: "unit"` would also localize the **name** (`20 Grad Celsius` in `de-DE`) while
the parser still only accepts English aliases, change spacing (`68°F` vs `68 °F`), and
map `gallon` without a US/imperial switch we already own.

**`Intl` formats the number. The unit is always `Unit.symbol`.** That field is the
display-name table `plan.md` asked for — it already covers every row, including the
ones ECMA-402 will not. Do not add a second mapping file. Do not call
`style: "unit"` in M3.

### 1.2 CLDR `unitPreferenceData` exists and does not belong here

It is real: CLDR supplemental data, documented in UTS #35, charted at
<https://unicode.org/cldr/charts/49/supplemental/unit_preferences.html>. It maps
`(quantity, usage, region, magnitude)` to a preferred unit — US road length in miles,
person-height in feet and inches, and so on.

That is **output-unit selection**, not formatting. It would change the `Quantity`
(`180.34 cm` → `5 ft 11 in` for `en-US`), which is an evaluator policy, needs a usage
hint we do not have, and would mean shipping CLDR (license still open in `plan.md`
§16). The unit of a result is already chosen: the conversion target, or
larger-unit-wins, or the named product.

Do not read `unitPreferenceData`. Do not auto-scale `300000 m` into `300 km`.

### 1.3 Six significant figures; exact integers stay integers

`plan.md` §1.2: round at format time, never display raw float residue. Six is the top
of the 2–6 range that document named, enough that `1 m in ft` is recognisable and
not so many that `3.280839895013123` survives.

Rules, in order:

1. Relative near-integer nudge (keep the post-M2 constant): if
   `|value - round(value)| <= 1e-12 * |value|`, treat as that integer. `0` is `0`.
   `-0` prints as `0`.
2. A value that is an integer after (1) prints with `String(n)` — no trailing `.0`,
   no scientific notation, no significant-figure truncation of `1000000` into `1e6`.
3. Otherwise round to **at most six** significant figures (`Intl`
   `maximumSignificantDigits: 6`, `roundingMode: "halfExpand"`). Do not pad.
4. Non-integers with `|value| < 1e-6` or `|value| >= 1e15` use scientific notation,
   lowercase `e`, still six significant figures (`1e-13`, not
   `0.0000000000001` and not `1E-13`).

Consequence for the accept rows that were waiting on this:

| Input                       | `text`       |
| --------------------------- | ------------ |
| `20 c to f`                 | `68 °F`      |
| `1 m in ft`                 | `3.28084 ft` |
| `(2 + 3) * 4 km in miles`   | `12.4274 mi` |
| `5 ft 11 in cm`             | `180.34 cm`  |
| `1 gallon to litre`         | `3.78541 L`  |
| `1 gallon to litre` (en-GB) | `4.54609 L`  |
| `1 oz to g`                 | `28.3495 g`  |

`Quantity.value` stays the float64. Rounding is display-only, matching Soulver’s
“cosmetic dp” split. Fixtures keep asserting `value` with `eps` where the math is
inexact; `text` is the rounded string.

Do not put `significantDigits` on `createSubscript` in M3. Six is the policy, not a
knob.

### 1.4 Locale still does not change numerals

M2: locale picks US vs imperial volume; input decimal is `.`; `1,000` is
`not-an-expression`. That stays.

Output numbers always use a Latin decimal point and **no grouping separators**
(`useGrouping: false`). `createSubscript({ locale: "de-DE" }).evaluate("20")` is
`"20"`, not `"20,"`. `9271` is `"9271"`, not `"9,271"`. Grouping and comma-decimals
are the same bucket as non-English input: not v1.

`Intl.NumberFormat` is still constructed with `"en-US"` (or `numberingSystem: "latn"`)
so rounding is the runtime’s, not ours. Locale on the factory continues to mean the
alias trie, nothing else.

### 1.5 Compact notation is display-only, dimensionless-only, on by default

Soulver defaults to SI-inspired compact (`300k`, `3.3M`) and lets you turn it off.
We do the same:

```ts
createSubscript({ compact: false });
```

Default `true`. Compact is **not** a lexer of `k` / `M`. `m2-parser.md` §1.7 forbade
that, and reversing it would fight the alias table: **`k` is kelvin**. `2.5k` is
`2.5 K` today and stays `2.5 K`. A host that feeds `text` back into `evaluate` will
not round-trip compact strings. `text` is for humans; `value` is the number.
Document that next to the option.

Apply compact only when the result is **dimensionless** and `|n| >= 1000` after the
integer nudge. `300000 m` is `300000 m`, not `300k m` (reads as kelvin-metres) and
not `300 km` (§1.2).

Suffixes, SI-inspired, **not** Intl `notation: "compact"` (that emits `300K` / `300B`
in `en-US`, which collides with kelvin’s `K` and with byte/`billion`):

| Suffix | Magnitude |
| ------ | --------- |
| `k`    | 1e3       |
| `M`    | 1e6       |
| `G`    | 1e9       |
| `T`    | 1e12      |
| `P`    | 1e15      |

Significand in `[1, 1000)`; format it with the same six-sig-fig rules; no space
before the suffix (`300k`, `3.3M`). If rounding pushes the significand to `1000`,
bump the suffix (`1000k` is `1M`). Beyond `1e18`, scientific notation (§1.3 rule 4).
Negative values keep the sign (`-300k`). `B` is not a suffix.

### 1.6 Lost addends refuse; cancellation snaps to zero — in `numeric.ts`

Two Soulver behaviors, both `plan.md` §1.2, both evaluation, both the reason
`numeric.ts` exists as a seam:

- `1e100 + 1 - 1e100` is `{ kind: "precision-loss" }`, not `0`. Left-associative:
  `1e100 + 1` already loses the `1`, so the expression fails before the subtraction.
- `sqrt(2) - 2^0.5` is `0` in both `value` and `text`. A visible 1e-16 residue is a
  bug from the user’s point of view.

Keep the current primitive `add` / `sub` / `mul` / `div` / `sqrt` / `pow` as
unchecked float64. `units/table.ts` and `toSI` / `fromSI` must not start refusing
definitional constants.

Add checked helpers used only for **operand** `+` and `-` in `quantity.ts`:

```
addChecked / subChecked:
  1. compute the float result
  2. if not finite → precision-loss
  3. if a non-zero addend (or subtrahend) did not change the other operand
     (result === a && b !== 0, or result === b && a !== 0) → precision-loss
  4. if |result| <= 1e-12 * max(|a|, |b|) → 0   // cancellation
  5. otherwise the float result
```

`1e16 + 1` refuses (ulp at 1e16 is 2). `1 + 1e-13` succeeds. `1e-13 - 0` stays
`1e-13` (the scale is 1e-13; the residue is not small relative to the operands).
`0 + 5` succeeds (`a === 0` is not a lost addend).

Mul, div, pow, sqrt: still only the existing non-finite → `precision-loss` path.
Do not invent a lost-factor check for `1e-300 * 1e-300` in M3.

Relative epsilon `1e-12` is the same constant as the display nudge. Put it in
`numeric.ts` and import it from `format.ts`.

### 1.7 Scientific exponent in the lexer

The refuse example cannot be typed without `1e100`. M2 deferred `1e3` as a number
form, not as a unit. Extend `readNumber`:

```
number    := digits ('.' digits?)? exponent? | '.' digits exponent?
exponent  := [eE] [+-]? digits
```

The exponent is part of the number only when at least one digit follows `e`/`E` and
the optional sign. `1e`, `1e+`, `1e-` end the number before `e`; leftover letters
are `unknown` → `not-an-expression`. `1 e3` (space) is two tokens, not 1000.
`1e3` is `1000`. `1E-3` is `0.001`. `2.5e6` is `2500000`.

If the slice is a well-formed number but `Number(...)` is non-finite (`1e309`),
still emit a number token whose `value` is `Infinity` / `-Infinity`, and let
`quantity()` return `precision-loss`. Do not drop the token and pretend it was
prose.

No `1e3` vs unit `e` fork: `e` is not an alias. Glued `1e3m` is number `1000` then
metre, same as `1000m`.

This is not compact input. `2.5k` remains 2.5 kelvin.

### 1.8 Format at the Result boundary; hoist on the instance

`quantity.ts` `ok()` keeps calling `formatQuantity` with a **module default**
formatter (`compact: true`), so the free programmatic API matches the free
`evaluate`.

`createSubscript` builds one formatter next to the trie and passes it into
`runPipeline`. The pipeline **overwrites** `text` on the winning result and on
`alternates`, so `createSubscript({ compact: false }).evaluate("1000")` is `"1000"`
even though `quantity(1000)` internally formatted with the default.

```ts
export type FormatConfig = {
  compact?: boolean; // default true
};

export function createFormatter(config?: FormatConfig): (qty: Quantity) => string;
export function formatQuantity(qty: Quantity, config?: FormatConfig): string;
```

`createFormatter` constructs the `Intl.NumberFormat` instance(s) once. Do not
`new Intl.NumberFormat` per keystroke. Two hoisted formatters are enough: one
`maximumSignificantDigits: 6` / `useGrouping: false` / `roundingMode: "halfExpand"`,
and one with `notation: "scientific"` for the tiny/huge branch. Post-process
scientific output so `E` becomes `e`.

Do not export `formatQuantity` from the package root. Hosts already have `result.text`.
Tests import `../src/format.ts` as they do today. Not an `internals` export.

Join number and unit with a single ASCII space; dimensionless is the number alone.
Symbols come from `qty.unit.symbol` with no further lookup.

### 1.9 Drop `checkText`; every accept asserts `text`

M2’s `checkText` was a milestone gate. Remove the field from `Fixture`. On
`expect.ok`, always `assert.equal(result.text, expect.text)`. Todo rows still skip
the equality (`usd-in-eur`, `pst-in-tokyo`).

Update the placeholder `text` on those two todos only if they already have one;
do not invent currency or timezone formatting.

### 1.10 No new span kinds, no parser grammar besides the exponent

`spans` already colors number / unit / converter. A scientific number is still one
`number` span over the whole lexeme (`1e100`, not `1` + `e` + `100`). Formatting
must not require new token kinds.

---

## 2. Target layout

```
packages/subscript/src/
  index.ts                 # unchanged barrel
  create.ts                # trie + formatter; SubscriptConfig.compact
  pipeline.ts              # runPipeline(input, trie, format)
  format.ts                # createFormatter, formatQuantity; replaces the stub
  numeric.ts               # primitives stay; addChecked / subChecked / RELATIVE_EPS
  quantity.ts              # operand +/− go through checked helpers
  lex.ts                   # scientific exponent on numbers
  …                        # otherwise unchanged

packages/subscript/test/
  format.test.ts           # sig figs, compact, scientific, integers, -0, units
  numeric.test.ts          # lost addend, cancellation snap, primitives unchanged
  quantity.test.ts         # precision-loss and snap at the Quantity layer
  lex.test.ts              # 1e3, 1e-3, 1e leftover, 1e309 → Infinity token
  fixtures/accept.ts       # text updated; checkText gone; new rows in §7.2
  fixtures/types.ts        # drop checkText
  fixtures.test.ts         # always assert text
```

Do not add a display-name table, a CLDR dump, or a runtime dependency.

---

## 3. Config and types

Public `Unit`, `Quantity`, `Result`, `Failure` stay as they are.
`precision-loss` is already on the union; start producing it for lost addends.

```ts
export type SubscriptConfig = {
  locale?: string;
  compact?: boolean; // default true; display-only; dimensionless |n| >= 1000
  now?: NowFn;
  rates?: RateProvider;
};
```

No other formatting knobs. No `unitDisplay`. No `useGrouping`.

`create.ts` holds `{ trie, format }` in the closure. The free `evaluate` lazy
default remains `createSubscript()` (compact on, `en-US` trie).

---

## 4. Format algorithm

`formatQuantity(qty, config)` / the function `createFormatter` returns:

1. `number = formatNumber(qty.value, { compact, dimensionless: qty.unit.symbol === "" })`
2. if `qty.unit.symbol === ""` return `number`
3. return `` `${number} ${qty.unit.symbol}` ``

`formatNumber(value, opts)`:

1. if `!Number.isFinite(value)` — callers should not reach here (`ok()` already
   refused); if they do, return `"NaN"` / `"Infinity"` only in tests that ask.
   Production `ok()` never formats non-finite.
2. Nudge to integer with `RELATIVE_EPS` (§1.3). Collapse `-0` to `0`.
3. If compact && dimensionless && `abs >= 1000`: scale by the largest suffix in
   §1.5 that leaves a significand `< 1000` (or `== 1000` only when there is no
   larger suffix). Format the significand with step 5/6. If that rounded
   significand is `>= 1000` and a larger suffix exists, bump. Prefix `-` if needed.
4. If integer after nudge: `String(n)` with sign.
5. If `abs < 1e-6` or `abs >= 1e15`: scientific formatter, `E` → `e`.
6. Else the significant-digit formatter.

Worked compact:

| `value` | `text` (dimensionless, compact on) |
| ------- | ---------------------------------- |
| 999     | `999`                              |
| 1000    | `1k`                               |
| 1500    | `1.5k`                             |
| 300000  | `300k`                             |
| 3300000 | `3.3M`                             |
| 1e9     | `1G`                               |
| -200000 | `-200k`                            |

`createSubscript({ compact: false }).evaluate("1000")` is `"1000"`.

---

## 5. Numeric seam

```ts
export const RELATIVE_EPS = 1e-12;

export type NumericOutcome = { ok: true; value: number } | { ok: false };

export function add(a: number, b: number): number; // a + b, unchanged
export function sub(a: number, b: number): number; // unchanged
// mul, div, sqrt, pow, isFiniteNumber: unchanged

export function addChecked(a: number, b: number): NumericOutcome;
export function subChecked(a: number, b: number): NumericOutcome;
```

`quantity.add` / `quantity.sub` call `addChecked` / `subChecked` on the **operand
values** (the dimensionless-assimilate branches and the same-dimension branches).
Scale conversion (`toSI` / `fromSI`) keeps primitives.

`pipeline.ts` `power` stays `quantity(numeric.pow(...))`; overflow is already
`precision-loss`.

Do not change `lookup.ts` `scalesEqual`; it uses primitive `sub` by design.

---

## 6. Lexer

Only `readNumber` in `lex.ts` changes, per §1.7. Spans for `1e100 + 1` are one
number, operator, number. Add a lex test that `1e3m` is still number + metre and
that `minimum` is still not `min`.

`1e` is a reject fixture (`not-an-expression`).

---

## 7. Tests

### 7.1 `format.test.ts`

Replace the “prints in full” case. Required:

| Name                         | Input quantity             | `text`       |
| ---------------------------- | -------------------------- | ------------ |
| dimensionless integer        | `20`, unit `1`             | `20`         |
| near-integer                 | `67.99999999999999` m      | `68 m`       |
| large near-integer           | `9270.999999999998` m      | `9271 m`     |
| small magnitude              | `1e-13` m                  | `1e-13 m`    |
| half                         | `0.5` m                    | `0.5 m`      |
| zero                         | `0` m                      | `0 m`        |
| float noise, not an integer  | `27.939999999999998` m     | `27.94 m`    |
| six sig figs conversion      | `1/0.3048` ft              | `3.28084 ft` |
| US gallon                    | `3.785411784` L            | `3.78541 L`  |
| compact thousand             | `1000`, unit `1`           | `1k`         |
| compact off                  | same, `{ compact: false }` | `1000`       |
| compact does not attach to m | `1000` m                   | `1000 m`     |
| compact million              | `3.3e6`, unit `1`          | `3.3M`       |
| m²                           | `100`, `metre-squared`     | `100 m²`     |
| negative zero                | `-0`, unit `1`             | `0`          |

### 7.2 Accept fixtures — always `text`; add rows

Drop `checkText` everywhere. Set `text` to the table in §1.3. Keep `todo` on
`usd-in-eur` and `pst-in-tokyo`.

Add:

| `name`               | `input`             | Expect                          |
| -------------------- | ------------------- | ------------------------------- |
| `sci-thousand`       | `1e3`               | dimensionless `1000`, text `1k` |
| `compact-sum`        | `100000 + 200000`   | `300k`                          |
| `near-zero-sqrt`     | `sqrt(2) - 2^0.5`   | dimensionless `0`, text `0`     |
| `precision-loss-add` | `1e100 + 1 - 1e100` | `precision-loss`                |
| `glued-kelvin`       | `2.5k`              | `2.5 K`, unit `kelvin`          |
| `overflow-exponent`  | `1e309`             | `precision-loss`                |

`glued-kelvin` is the compact collision, committed so nobody “fixes” `2.5k` into 2500.

Add a programmatic compact-off case in `api.test.ts` or `format.test.ts`:
`createSubscript({ compact: false }).evaluate("1000")` is `"1000"`. The fixture
loop can keep defaulting `compact` on.

### 7.3 Reject — add

| `name`                | `input` | Why                          |
| --------------------- | ------- | ---------------------------- |
| `incomplete-exponent` | `1e`    | exponent without digits      |
| `spaced-exponent`     | `1 e3`  | not a number; leftover prose |

Existing rejects, including `question` and `send-to-john`, stay
`not-an-expression`.

### 7.4 `numeric.test.ts` / `quantity.test.ts`

Primitives still wrap `+` / `-` / `*` / `/`. New:

- `addChecked(1e100, 1)` is `ok: false`
- `addChecked(1e16, 1)` is `ok: false`
- `addChecked(0, 5)` is `5`
- `subChecked(Math.sqrt(2), 2 ** 0.5)` is `0`
- `subChecked(1e-13, 0)` is `1e-13`
- `add(quantity(1e100), quantity(1))` is `precision-loss`
- `sub(quantity(Math.sqrt(2)), quantity(2 ** 0.5))` is `0` (value and text)

### 7.5 Lex

`1e3` one token, value `1000`. `1E-3` value `0.001`. `1e3m` number + metre.
`1e309` number with non-finite value. `2km` unchanged.

### 7.6 Unchanged

Fuzz (still no throw, well-formed `Result`). Bench (same three inputs, `< 2s`).
Reject corpus. Affine quantity tests. Spans for `20 c to f`.

---

## 8. Implementation order

Each step leaves `npm test` and `npm run typecheck` green.

1. `numeric.ts`: `RELATIVE_EPS`, `addChecked` / `subChecked`, tests. Wire
   `quantity.add` / `quantity.sub`. Existing quantity tests still pass;
   `1e100 + 1` now refuses at the programmatic layer.
2. Lexer exponent. `lex.test.ts`. `evaluate("1e3")` is `1000` (text still stub
   `1000` until step 3). `evaluate("1e100 + 1")` is `precision-loss`.
3. `format.ts` + `createFormatter`. Rewrite `format.test.ts`. Point `ok()` at
   the default formatter so programmatic `text` updates.
4. Hoist formatter in `create.ts`; pass into `runPipeline`; overwrite `text` /
   `alternates`. `compact: false` works.
5. Fixtures §7.2–7.3. Delete `checkText`. `fixtures.test.ts` always asserts
   `text`.
6. README: show `3.28084 ft`, mention `compact`, mention that compact strings
   are not input. Keep the `20 c to f` snippet true.
7. Append the M3 entry to `docs/history.md`.

No LICENSE, no package rename, no currency, no timezone, no `apps/web`, no CLDR
data, no `style: "unit"`.

---

## 9. Done when

- `npm test` and `npm run typecheck` are green.
- `evaluate("20 c to f").text` is `"68 °F"`.
- `evaluate("1 m in ft").text` is `"3.28084 ft"`.
- `evaluate("(2 + 3) * 4 km in miles").text` is `"12.4274 mi"`.
- `evaluate("5 ft 11 in cm").text` is `"180.34 cm"`.
- `evaluate("1 gallon to litre").text` is `"3.78541 L"`; `en-GB` is `"4.54609 L"`.
- `evaluate("1 oz to g").text` is `"28.3495 g"`.
- `evaluate("100000 + 200000").text` is `"300k"`.
- `createSubscript({ compact: false }).evaluate("1000").text` is `"1000"`.
- `evaluate("2.5k")` is `2.5` kelvin, text `"2.5 K"`.
- `evaluate("sqrt(2) - 2^0.5")` is `{ ok: true, value: { value: 0, … }, text: "0" }`.
- `evaluate("1e100 + 1 - 1e100")` is `{ ok: false, reason: { kind: "precision-loss" } }`.
- Every non-todo accept fixture asserts `text`. Every pre-existing reject fixture
  is still `not-an-expression`.
- `evaluate("1e")` is `not-an-expression`.
- `spans("20 c to f")` unchanged. `spans("1e100")` is one `number` span.
- Zero runtime dependencies; no `eval` / `new Function`.
- `docs/history.md` has an M3 log entry (sig-fig policy, compact dimensionless-only,
  `k` remains kelvin, lost-addend refusal, scientific lexer, Intl numbers not units).

---

## 10. Out of scope

- `style: "unit"`, long/narrow localized unit names, `unitPreferenceData`, auto-scaling
  to a “nicer” unit
- Grouping separators, locale decimal comma, locale numeral systems
- Parsing compact suffixes (`2.5k` as 2500), `million` as a word, `%`
- Thousands separators in input
- `significantDigits` / `notation` on `createSubscript` beyond `compact?: boolean`
- Currency minor units, `Intl` currency style (M4)
- Time zones, `3pm`, clock formatting (M5)
- Comment-word tolerance, inverted conversion, `km m` shorthand
- Prefix composition, unicode superscript exponents, curly-quote feet/inches
- Compound imperial display (`5 ft 11 in` as an _output_ of `180.34 cm`)
- Snapping `Quantity.value` for near-integers (nudge is display-only; only
  cancellation writes `0` into the value)
- `apps/web`, LICENSE, npm rename, CI, executable-markdown runner, differential
  testing against a previous publish
- Returning `{ kind: "ambiguous" }`

If it is not in §8, it is not M3.

---

## 11. What M4 needs

- Currency is a unit whose scale loads at runtime. Formatting already hoists
  `Intl.NumberFormat`; M4 adds a currency formatter (`style: "currency"`) next to
  it, using ISO 4217 minor-unit exponents for fraction digits — do not reuse the
  six-sig-fig path for money.
- Compact for currency uses `B` / `bn` in Soulver; our dimensionless compact
  uses `G`. Keep that split when `$` exists. Do not invent it now.
- `rate-unavailable` / `rate-pending` already sit on `Failure`; they still must
  not guess a number. Formatting must not turn a missing rate into `0`.
- `$` and ISO-code-vs-word collisions are lexer/rank problems, not formatter
  problems. Do not smuggle them into `format.ts`.
- After M4 ships, append a history entry. Do not reverse six sig figs, compact
  dimensionless-only, “`k` is kelvin”, lost-addend `precision-loss`, or “Intl
  formats the number, the symbol is ours”.
