# M1 — Quantity, dimensions, affine units

Implementation plan for the second milestone in [`docs/plan.md`](../plan.md). That document is
_why_. This one is _what_, _where_, and _in what order_.

M0 left a typed hole: `Quantity` is `{ value, unit }`, every `evaluate` call is
`not-an-expression`, and the NL fixtures do not assert success. M1 fills the hole
**without parsing**. Construction, conversion, and arithmetic are ordinary function calls.
Natural language still refuses everything.

**Exit:** programmatic conversion and mixed-unit arithmetic work, including the affine
temperature distinction; `evaluate("20 c to f")` is still
`{ ok: false, reason: { kind: "not-an-expression" } }`; reject fixtures still fail.

---

## 0. Current state

| Item         | Today                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Public API   | `evaluate`, `createSubscript`, `Result` / `Failure`, `spans` → `[]`         |
| `evaluate`   | always `{ ok: false, reason: { kind: "not-an-expression" } }`, never throws |
| `Quantity`   | `{ value: number, unit: Unit }`; `Unit` is `{ id, symbol }`                 |
| Unit table   | none                                                                        |
| Arithmetic   | none                                                                        |
| NL fixtures  | reject cases assert; accept cases are `todo: true`                          |
| Tests inject | `now`; they never read the ambient clock                                    |
| Runtime deps | zero (keep it that way)                                                     |
| History      | M0 logged; unit-data citations have nowhere to live until this plan ships   |

Treat as given, from [`docs/history.md`](../history.md): layer 1 is a free `evaluate`;
configure via `createSubscript`; `Quantity` grows additively from `value` + `unit`.

---

## 1. Decisions

These close the three questions `plan.md` §6 said to answer before M1, and the forks that
would otherwise leak into the type of every quantity.

### 1.1 Still hand-author the table

Permissive databases exist. We still do not vendor them.

| Source    | License                                                      | Why not                                                 |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| GNU Units | GPL-3.0-or-later                                             | already forbidden (`plan.md` §1.4)                      |
| UDUNITS-2 | UCAR (modified BSD-3 + patent termination)                   | scientific/netCDF catalog, not a calculator alias table |
| QUDT      | CC BY 4.0, and it embeds UCUM                                | UCUM’s Regenstrief license is not MIT-shaped            |
| UCUM      | Regenstrief, revocable, not for deriving a competing codeset | same                                                    |

The facts (a mile is 1609.344 m) are not copyrightable. The compilation is. Each M1 row cites
NIST SP 811, NIST Handbook 44 Appendix C, the SI Brochure, or the 1959 international yard and
pound — the same primary sources GNU Units cites — and never copies GNU Units’ arrangement.

`plan.md` §1.4 and §5.4 already picked this: the alias table _is_ the product. M1 is the first
slice of that table, not a parser for someone else’s.

### 1.2 Affine kind lives on the unit, not as an offset on `Quantity`

Research §4.5 sketched `offset` on `Quantity`. `plan.md` §3.2 and §7.2 reject that: absolute and
difference temperatures are **distinct units**, because retrofitting the distinction later
changes the type of every temperature value.

What the libraries actually do:

- **Boost.Units** wraps the unit (`absolute<T>` vs relative `T`). Addition is
  `absolute ± relative → absolute` and `absolute − absolute → relative`. This is the model.
- **Pint** has the same split in the catalog (`degC` vs `delta_degC`) and raises
  `OffsetUnitCalculusError` on `20°C + 5°C` and on `20°C × 2`. Also the model, with a worse
  default if you turn `autoconvert_offset_to_baseunit` on.
- **Numbat** is the counterexample: only kelvin is a real `Temperature`; `25 °C` becomes
  `298.15 K` immediately; `10 °C + 1 °C` is `557.3 K`. Statically typed dimensions, no affine
  gate. Do not copy this.

Public `Quantity` stays `{ value, unit }`. The kind is a field on the **internal unit record**.
Two Celsius quantities cannot become a valid sum just because someone stuffed an offset into the
value object.

### 1.3 US / imperial volumes, re-derived

Definitions, not folklore:

- International inch = **0.0254 m** exactly (1959 yard and pound).
- US gallon = **231 in³** legally (NIST HB 44 App. C) = `231 × 0.0254³` =
  **0.003785411784 m³** = **3.785411784 L** exactly.
- Imperial gallon = **4.54609 L** exactly (NIST SP 811).
- US fluid ounce = US gallon / 128 = **29.5735295625 mL**.
- Imperial fluid ounce = imperial gallon / 160 = **28.4130625 mL**.

NIST SP 811 prints the US gallon as `3.785 412 E+00` L — a rounded 7-digit factor. Store the
exact 231 in³ definition; cite both.

Divergence (US relative to imperial, and the other way):

- Imperial gallon / US gallon = `4.54609 / 3.785411784 ≈ 1.20095` → imperial is **~20.10%**
  larger. Matches “roughly 20%” in research §7.3.
- US fl oz / imperial fl oz = `29.5735295625 / 28.4130625 ≈ 1.04084` → US is **~4.08%** larger.
  Matches the 4.08% figure in research §7.3.

Locale-picking `gallon` / `oz` is M2. M1 ids are unambiguous: `us-gallon`, `imperial-gallon`,
`us-fluid-ounce`, `imperial-fluid-ounce`, `ounce` (avoirdupois mass).

### 1.4 Soulver’s mixed-unit rules, named products only

GNU Units would return `kg·L`. Soulver refuses a unit nobody recognizes (`plan.md` §3.2). M1
follows Soulver:

- After `mul` / `div`, the result dimension must match a **named** unit in the table (or be
  dimensionless). Otherwise `{ kind: "unknown-unit", token }`.
- Prefer the unit whose scale equals the product of the operand scales (`10 m × 10 m` →
  `100 m²`, not hectares). If none, fall back to the SI-coherent unit of that dimension
  (scale 1). If none of those exist either, fail.
- Addition: **larger unit wins** (larger `scale` to SI). Tie → left operand’s unit.
- A dimensionless operand assimilates the other unit (`300 + 20 km` → `320 km`). This is an
  evaluation rule, not a parse rule, so it belongs here.
- Implicit rates (`$30 × 4 days`) need currency. Not M1.
- Last-unit-wins across currencies. Not M1.

### 1.5 float64, one numeric module

`plan.md` §1.2. `Quantity.value` stays `number`. Every `+`, `*`, `/` on values and scales goes
through `src/numeric.ts` so a later backend is a contained swap. Do not scatter `a + b`.

Do not implement near-zero collapse or `precision-loss` for `1e100 + 1 - 1e100` yet. That is
M3. Do reject non-finite inputs (`NaN`, `±Infinity`) as `{ kind: "precision-loss" }` so they
cannot leak out as a “number”.

### 1.6 Programmatic API is free functions; `evaluate` stays a stub

M1 is not natural language. Do not wire `evaluate`. Do not add `quantity` onto the
`Subscript` instance. Locale does not affect canonical ids.

```ts
import { quantity, convert, add, sub, mul, div, sqrt } from "@repo/subscript";

quantity(20, "celsius"); // ok
convert(that, "fahrenheit"); // 68 °F
add(quantity(20, "celsius"), quantity(5, "celsius")); // dimension-mismatch
```

Tests for this API are new files. They do not touch `accept.ts` / `reject.ts`.

### 1.7 Canonical ids are SI spellings

`metre`, `litre`, `celsius`. `meter` / `liter` / `c` are aliases for the M2 lexer, not M1 ids.
`quantity(20, "c")` is `{ kind: "unknown-unit", token: "c" }`.

### 1.8 `text` is a stub

`Result` requires `text`. Format as `` `${value} ${symbol}` `` with `String(value)` (no
`Intl`, no significant figures). Programmatic tests assert `value` and `unit.id`, not `text`.
M3 replaces the stub.

---

## 2. Target layout

```
packages/subscript/src/
  index.ts              # also export quantity, convert, add, sub, mul, div, sqrt
  types.ts              # Unit / Quantity unchanged publicly; Rational internal or exported
  create.ts             # evaluate still stubs
  evaluate.ts           # unchanged
  numeric.ts            # add, sub, mul, div, isFinite
  dimension.ts          # 7-D rational vectors
  quantity.ts           # quantity, convert, add, sub, mul, div, sqrt
  units/
    kinds.ts            # AffineKind, Dimension named constants
    table.ts            # the catalog
    lookup.ts           # by id; list matching a dimension

packages/subscript/test/
  api.test.ts           # unchanged contract: evaluate still rejects
  fixtures.test.ts      # unchanged
  quantity.test.ts      # construction, convert, arithmetic, affine
  units.test.ts         # table invariants (unique ids, cited source, scale finite)
```

Do not add `subscript/internals`. Do not export the catalog as a public array if a `getUnit(id)`
(or just failing `quantity`) is enough. Tests may import `../src/units/table.ts` for invariants.

---

## 3. Types

### 3.1 Public types stay additive

Do not rename `Quantity.value` or `Quantity.unit`. Do not add `offset` or `dimension` to the
public `Quantity`. `Unit` stays `{ id, symbol }`.

`Failure` stays the M0 union. Affine incompatibility uses `dimension-mismatch` with `from` /
`to` set to the two public units — the kind is visible on the ids (`celsius` vs
`delta-celsius`). Do not add `affine-mismatch`.

Unnamed compound products use `unknown-unit` (token like `kg·L`). Unknown id uses
`unknown-unit` with that id as `token`.

### 3.2 Internal dimension vector

Seven SI base dimensions, **rational** exponents, order fixed:

```ts
// T L M I Θ N J  — second, metre, kilogram, ampere, kelvin, mole, candela
export type Rational = { readonly n: number; readonly d: number }; // integers, d > 0, reduced, n may be negative

export type Dimension = readonly [
  Rational, // T
  Rational, // L
  Rational, // M
  Rational, // I
  Rational, // Θ
  Rational, // N
  Rational, // J
];
```

Use `number` for `n` / `d`, not `bigint`. Exponents stay tiny (`1/2`, `2`, `-1`). Reduce with
gcd on every constructor. Equality is componentwise equality of reduced rationals.

Named helpers: `TIME`, `LENGTH`, `MASS`, `TEMPERATURE`, `AREA` (L²), `VOLUME` (L³), `SPEED`
(L/T), `NONE` (all zero). Ampere, mole, candela exist on the vector and have **no units** in
the M1 table.

### 3.3 Internal unit record

```ts
export type AffineKind = "linear" | "absolute" | "difference";

export type UnitSource = {
  readonly citation: string; // "NIST SP 811 Appendix B.8", "SI Brochure 9", ...
  readonly url?: string;
  readonly notes?: string; // "exactly 0.3048 m (international foot)"
};

export type UnitDef = {
  readonly id: string; // kebab-case, unique
  readonly symbol: string;
  readonly dimension: Dimension;
  readonly scale: number; // multiply value to reach SI coherent (offset 0) units
  readonly offset: number; // 0 for linear and difference; kelvin-space intercept for absolute
  readonly affine: AffineKind;
  readonly source: UnitSource;
};
```

To SI coherent: `numeric.add(numeric.mul(value, scale), offset)`.
From SI coherent: `numeric.div(numeric.sub(si, offset), scale)`.

`offset` is always 0 except on `absolute` temperature units. Do not put offset on `Quantity`.

### 3.4 Affine kinds

| `affine`     | Examples                        | Role                                                       |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| `linear`     | metre, kelvin, rankine, second  | Ordinary; kelvin/rankine are also the thermodynamic scales |
| `absolute`   | celsius, fahrenheit             | Point on a scale                                           |
| `difference` | delta-celsius, delta-fahrenheit | Interval; same dimension as absolute                       |

Kelvin is `linear`, not `absolute`. That is the Boost-shaped move that makes `20 °C → K` and
`20 °C + 5 K` both work without Numbat’s “everything is already kelvin” collapse.

Truth table (same dimension; otherwise `dimension-mismatch`):

| Op                          | Result                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| convert abs → abs           | via SI (kelvin)                                                                          |
| convert abs → linear        | allowed (20 °C → K, 32 °F → °R)                                                          |
| convert abs → difference    | `dimension-mismatch`                                                                     |
| convert difference → abs    | `dimension-mismatch`                                                                     |
| convert difference → linear | allowed (5 Δ°C → 5 K)                                                                    |
| convert linear → abs        | allowed (293.15 K → °C)                                                                  |
| convert linear ↔ linear     | scale only                                                                               |
| add abs + abs               | `dimension-mismatch`                                                                     |
| add abs + (diff \| linear)  | absolute, left’s unit                                                                    |
| add diff + diff             | difference, larger unit wins                                                             |
| add linear + linear         | linear, larger unit wins                                                                 |
| sub abs − abs               | difference, in `delta-*` of the left unit (celsius → delta-celsius; kelvin stays kelvin) |
| sub abs − (diff \| linear)  | absolute                                                                                 |
| mul/div abs × anything      | `dimension-mismatch`, except not applicable — refuse all mul/div involving `absolute`    |
| mul diff × dimensionless    | difference                                                                               |
| mul linear × dimensionless  | linear                                                                                   |
| sqrt(abs)                   | `dimension-mismatch`                                                                     |

`20 °C × 2` fails. `5 Δ°C × 2` is `10 Δ°C`. `sqrt(m²)` is `m`.

Each `absolute` unit names its difference counterpart by id (`celsius` → `delta-celsius`).
Implement as a field `differenceId: string` on absolute records only, or a function in
`quantity.ts`. Do not invent a fourth affine kind.

---

## 4. Public functions

All return `Result`. None throw. Unknown id → `unknown-unit`. Non-finite number →
`precision-loss`.

```ts
export function quantity(value: number, unitId?: string): Result;
// omitted unitId ⇒ dimensionless (internal id "1", symbol "")

export function convert(qty: Quantity, toId: string): Result;

export function add(a: Quantity, b: Quantity): Result;
export function sub(a: Quantity, b: Quantity): Result;
export function mul(a: Quantity, b: Quantity): Result;
export function div(a: Quantity, b: Quantity): Result;

export function sqrt(qty: Quantity): Result;
// dimension exponents × 1/2; fails if any exponent is not an even integer
// *before* the multiply? No: × 1/2 on rationals always works (m → m^{1/2}),
// and then named-unit lookup fails unless the result is in the table.
// sqrt(m²) → m. sqrt(m) → unknown-unit (no √m in the table).
```

`pow` with arbitrary rationals stays internal if `sqrt` plus integer scaling via `mul` covers
the tests. Integer `n × qty` is `mul(quantity(n), qty)` for linear units.

Callers pass `Quantity` objects from a prior ok result, not raw `{ value, unit }` literals.
If a literal sneaks in with an unknown `unit.id`, treat it as `unknown-unit`.

Do not accept unit symbols (`"°C"`, `"m"`) in these functions. Ids only.

---

## 5. Unit table

TypeScript module, one object per unit, cited. Common prefixed SI units are **separate rows**
(`kilometre`, `centimetre`, `millilitre`). No prefix-composition engine.

Calendar lengths are named constants on the time rows, not magic in convert (`plan.md` §3.2):

- `year` = 365.2425 days (mean Gregorian). Cite the SI Brochure’s Gregorian year / CGPM
  convention and say so in `source.notes`. Any year length is wrong somewhere; an undocumented
  one is unexplainable.
- `month` = `year / 12`.
- `day` = 86400 s; `hour` = 3600 s; `minute` = 60 s.

### 5.1 Rows to author (do not exceed this list)

**Dimensionless**

| `id` | `symbol` | `scale` |
| ---- | -------- | ------- |
| `1`  | `""`     | 1       |

**Length** (dimension L, SI = metre)

| `id`            | `symbol` | `scale` (m) | Source                                |
| --------------- | -------- | ----------- | ------------------------------------- |
| `metre`         | `m`      | 1           | SI                                    |
| `kilometre`     | `km`     | 1000        | SI prefix                             |
| `centimetre`    | `cm`     | 0.01        | SI prefix                             |
| `millimetre`    | `mm`     | 0.001       | SI prefix                             |
| `inch`          | `in`     | 0.0254      | 1959 yard/pound                       |
| `foot`          | `ft`     | 0.3048      | 1959 (international foot, not survey) |
| `yard`          | `yd`     | 0.9144      | 1959                                  |
| `mile`          | `mi`     | 1609.344    | 5280 × foot                           |
| `nautical-mile` | `nmi`    | 1852        | SI Brochure / IHO                     |

**Mass** (dimension M, SI = kilogram)

| `id`        | `symbol` | `scale` (kg) | Source                 |
| ----------- | -------- | ------------ | ---------------------- |
| `kilogram`  | `kg`     | 1            | SI                     |
| `gram`      | `g`      | 0.001        | SI                     |
| `milligram` | `mg`     | 1e-6         | SI                     |
| `pound`     | `lb`     | 0.45359237   | 1959 yard/pound        |
| `ounce`     | `oz`     | `pound / 16` | avoirdupois; not fluid |
| `tonne`     | `t`      | 1000         | SI (metric ton)        |

No short ton, no long ton, no `lbf`.

**Time** (dimension T, SI = second)

| `id`          | `symbol` | `scale` (s)        |
| ------------- | -------- | ------------------ |
| `second`      | `s`      | 1                  |
| `millisecond` | `ms`     | 0.001              |
| `minute`      | `min`    | 60                 |
| `hour`        | `h`      | 3600               |
| `day`         | `d`      | 86400              |
| `week`        | `wk`     | 604800             |
| `month`       | `mo`     | `year / 12`        |
| `year`        | `yr`     | `365.2425 * 86400` |

**Temperature** (dimension Θ, SI = kelvin)

| `id`               | `symbol` | `affine`   | `scale` | `offset`          |
| ------------------ | -------- | ---------- | ------- | ----------------- |
| `kelvin`           | `K`      | linear     | 1       | 0                 |
| `celsius`          | `°C`     | absolute   | 1       | 273.15            |
| `delta-celsius`    | `Δ°C`    | difference | 1       | 0                 |
| `fahrenheit`       | `°F`     | absolute   | 5/9     | `273.15 - 32×5/9` |
| `delta-fahrenheit` | `Δ°F`    | difference | 5/9     | 0                 |
| `rankine`          | `°R`     | linear     | 5/9     | 0                 |

`offset` for fahrenheit is `255.372222...` (`273.15 − 32 × 5/9`). Compute it from those
fractions in code; do not paste a rounded decimal. Cite SI Brochure for 273.15 and the usual
Fahrenheit–Celsius relation.

**Area** (L²)

| `id`                | `symbol` | `scale` (m²) |
| ------------------- | -------- | ------------ |
| `metre-squared`     | `m²`     | 1            |
| `kilometre-squared` | `km²`    | 1e6          |
| `foot-squared`      | `ft²`    | `0.3048²`    |
| `inch-squared`      | `in²`    | `0.0254²`    |
| `hectare`           | `ha`     | 1e4          |
| `acre`              | `ac`     | 4046.8564224 |

Acre = 4840 yd² with international yard. Cite NIST SP 811 (it prints a rounded factor; store
the exact `4840 × 0.9144²`).

**Volume** (L³)

| `id`                   | `symbol`    | `scale` (m³)            | Notes   |
| ---------------------- | ----------- | ----------------------- | ------- |
| `metre-cubed`          | `m³`        | 1                       |         |
| `litre`                | `L`         | 0.001                   | SI      |
| `millilitre`           | `mL`        | 1e-6                    |         |
| `us-gallon`            | `gal`       | 0.003785411784          | 231 in³ |
| `imperial-gallon`      | `imp gal`   | 0.00454609              |         |
| `us-fluid-ounce`       | `fl oz`     | `us-gallon / 128`       |         |
| `imperial-fluid-ounce` | `imp fl oz` | `imperial-gallon / 160` |         |

US vs imperial **symbols collide** (`gal`, `fl oz`). Distinct ids; M2 disambiguates by locale.
M1 programmatic callers must use the ids.

**Speed** (L/T)

| `id`                 | `symbol` | `scale` (m/s)   |
| -------------------- | -------- | --------------- |
| `metre-per-second`   | `m/s`    | 1               |
| `kilometre-per-hour` | `km/h`   | `1000/3600`     |
| `mile-per-hour`      | `mph`    | `1609.344/3600` |
| `knot`               | `kn`     | `1852/3600`     |

That is the whole table. No energy, no pressure, no bytes, no data-rate, no `cup` / `tsp`.

### 5.2 Table invariants (tested)

- Every `id` unique, kebab-case.
- Every row has a non-empty `source.citation`.
- `scale` finite and `> 0`; `offset` finite; `offset === 0` unless `affine === "absolute"`.
- Exactly the `absolute` / `difference` pairs above; no other affine units.
- `dimension` matches the section (do not mark litre as length).

When implementation finishes, the M1 history entry lists the sources used — not a dump of
every factor.

---

## 6. Tests

`api.test.ts` and the NL fixture loop stay as M0 left them. Accept cases remain `todo`.
Reject cases must still be `not-an-expression`. If a later edit makes `evaluate` parse, those
tests fail — that is the point.

### 6.1 `quantity.test.ts`

Use `node:assert/strict`. Compare SI-space or exact float where the math is exact (`20 °C →
68 °F` is exact in float64). For `1 m → ft`, compare with a named epsilon (`1e-12` relative, or
round-trip to metres). Helper:

```ts
function assertQty(result: Result, id: string, value: number, eps = 0): void {
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.unit.id, id);
    if (eps === 0) assert.equal(result.value.value, value);
    else assert.ok(Math.abs(result.value.value - value) <= eps);
  }
}
```

Never throw: feed `NaN`, `Infinity`, `""` as unit id.

Required cases (names kebab-case, unique in this file):

| Name               | Call                                    | Expect                         |
| ------------------ | --------------------------------------- | ------------------------------ |
| `c-to-f`           | convert 20 celsius → fahrenheit         | 68 °F                          |
| `f-to-c`           | convert 68 fahrenheit → celsius         | 20 °C                          |
| `c-to-k`           | convert 20 celsius → kelvin             | 293.15 K                       |
| `abs-plus-abs-c`   | 20 °C + 5 °C                            | dimension-mismatch             |
| `abs-plus-delta-c` | 20 °C + 5 Δ°C                           | 25 °C                          |
| `abs-plus-kelvin`  | 20 °C + 5 K                             | 25 °C                          |
| `abs-minus-abs`    | 25 °C − 20 °C                           | 5 Δ°C                          |
| `abs-times-two`    | 20 °C × 2                               | dimension-mismatch             |
| `delta-times-two`  | 5 Δ°C × 2                               | 10 Δ°C                         |
| `c-to-delta-c`     | convert 20 °C → delta-celsius           | dimension-mismatch             |
| `m-to-ft`          | 1 metre → foot                          | `1/0.3048` ft                  |
| `km-plus-m`        | 1 km + 1000 m                           | 2 km (larger wins)             |
| `bare-plus-km`     | 300 + 20 km                             | 320 km                         |
| `m-times-m`        | 10 m × 10 m                             | 100 m²                         |
| `kg-times-litre`   | 3 kg × 3 L                              | unknown-unit                   |
| `m-div-s`          | 10 m / 2 s                              | 5 m/s                          |
| `sqrt-m2`          | sqrt(4 m²)                              | 2 m                            |
| `sqrt-m`           | sqrt(4 m)                               | unknown-unit                   |
| `m-plus-kg`        | 1 m + 1 kg                              | dimension-mismatch             |
| `unknown-id`       | quantity(1, "c")                        | unknown-unit token `c`         |
| `us-vs-imp-gallon` | convert 1 us-gallon → litre vs imperial | the two litre values from §1.3 |
| `year-in-days`     | convert 1 year → day                    | 365.2425                       |

### 6.2 `units.test.ts`

Load the table, assert §5.2. Assert US/imperial litre values match §1.3 exactly (they are
dyadic / terminating in decimal).

---

## 7. Implementation order

Each step leaves `npm test` and `npm run typecheck` green.

1. `numeric.ts` + tests for add/mul/div of ordinary numbers (including the non-finite guard).
2. `dimension.ts`: construct, reduce, add/sub exponents (for mul/div of quantities), equality,
   `sqrt` (× 1/2). Tests for `m²` and `sqrt(m²)`.
3. `units/kinds.ts` + `units/table.ts` with the §5.1 rows, citations on every row.
   `units.test.ts` invariants.
4. `units/lookup.ts` + `quantity()` (construct only). Unknown id and non-finite covered.
5. `convert`, then the temperature pair cases (`c-to-f`, affine mismatches).
6. `add` / `sub` (larger-unit-wins, assimilation, affine table).
7. `mul` / `div` / `sqrt` (named-product rule, `kg × L` fails).
8. Export from `index.ts`. `api.test.ts` still passes unchanged.
9. Append the M1 entry to `docs/history.md` (what landed, affine decision, sources cited,
   what stayed deferred).

No UI, no README, no lexer, no `apps/web`, no LICENSE, no package rename.

---

## 8. Done when

- `npm test` and `npm run typecheck` are green.
- `evaluate("20 c to f")` is still `not-an-expression`.
- Every reject fixture still asserts; every accept fixture is still a todo.
- `convert(quantity(20, "celsius").value, "fahrenheit")` is 68 (once the result is unwrapped;
  tests do this in one helper).
- `add` of two `celsius` quantities is `dimension-mismatch`; `celsius` + `delta-celsius` is 25.
- `10 m × 10 m` is `100 m²`; `3 kg × 3 L` is `unknown-unit`.
- `quantity(1, "c")` is `unknown-unit`.
- Every table row has a citation.
- Public `Quantity` still has no `offset` field.
- Zero runtime dependencies.
- `docs/history.md` has an M1 log entry naming NIST / SI / 1959 sources.

---

## 9. Out of scope

- Lexer, rewrite, Pratt parser, input caps, `spans` filling (M2)
- Wiring `evaluate` to the new functions (M2)
- Aliases (`c`, `meter`, `ft`, `gallon` as a locale-default id) (M2)
- Prefix composition as an engine (M2 may add it; M1 has explicit rows)
- `Intl` formatting, significant figures, near-zero collapse (M3)
- Currency, `RateProvider` behavior (M4)
- Time zones, `Temporal` (M5)
- Comment-word tolerance, `oz` locale disambiguation, short/long ton, survey foot
- Logarithmic units (dB, pH) — still not v1
- Force (`lbf`), energy, pressure, digital information
- Synthetic compound units (`kg·L`) as first-class results
- `apps/web`, README, CI, publishing, LICENSE
- Changing NL accept/reject fixtures to pass

If it is not in §7, it is not M1.

---

## 10. What M2 needs

- Call `convert` / `add` / `mul` / … from the evaluator after a successful parse. Do not
  reimplement scale math in the parser.
- Leave public `Quantity` as `{ value, unit }`. The parser produces canonical ids from aliases;
  `quantity()` never has to accept `c`.
- Add an `aliases` list on `UnitDef` (or a separate alias table). M1 ids stay the keys.
- Affine rules are already enforced. The lexer only has to pick `celsius` vs `delta-celsius`
  when the grammar says so (`20 c` is absolute; a temperature _difference_ token is later
  work if the grammar needs it).
- `1 min` vs `1 m in ft` is lexing. The table already has both `minute` and `metre`.
- After M2 ships, drop `todo` on the accept rows that now parse; do not invent a milestone gate.
- Append a history entry. Do not reverse “strict full consumption” or “no offset on
  `Quantity`”.
