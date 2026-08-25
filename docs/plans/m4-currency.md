# M4 — Currency

Implementation plan for the fifth milestone in [`docs/plan.md`](../plan.md). That document
is _why_. This one is _what_, _where_, and _in what order_.

M0 stubbed `evaluate`. M1 filled `Quantity`. M2 made natural language evaluate. M3 made
`text` the product. Currency is a unit whose scale loads at runtime (`plan.md` §3.5,
research §8.1): one evaluator, one Pratt grammar, no second math core. What M4 adds is
operational — a default Frankfurter quote, a hand-authored ISO 4217 table, `$` / ISO-code
policy, and money formatting that does not reuse six significant figures.

This milestone **reverses** `plan.md` §3.5’s “no network by default / injected
provider” for the evaluate path. Conversion should work from `evaluate("100 usd in eur")`
with no host configuration. Tests still never touch the network; they inject `fetch`.

**Exit:** `await evaluate("100 usd in eur")` converts via Frankfurter; same-currency
`$100` does not fetch; a failed quote is `rate-unavailable`, never `0`; `$` follows
locale; `TRY` is lira and `try` is not; there is no cache and no user-supplied
provider.

---

## 0. Current state

| Item         | Today                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Public API   | `evaluate`, `createSubscript`, `quantity` / `convert` / `add` / `sub` / `mul` / `div` / `sqrt` |
| `evaluate`   | **synchronous** `Result`. README: “Synchronous. No network.”                                   |
| `rates`      | on `SubscriptConfig`; typed `RateProvider = { quote(from, to): unknown }`; never called        |
| Failures     | `rate-unavailable` / `rate-pending` sit on `Failure`; nothing produces them                    |
| `text`       | six sig figs, compact dimensionless-only (`k`/`M`/`G`/`T`/`P`), `Unit.symbol`                  |
| Unit table   | SI + customary; no money; dimension is a 7-tuple                                               |
| Lexer        | number then trie then operator; `$` is unknown; prefix quantity is unparsed                    |
| Trie cache   | two tries (`us` / `gb` volume)                                                                 |
| `usd-in-eur` | accept fixture, `todo: true`, expect `rate-unavailable`                                        |
| Runtime deps | zero (keep it that way — `fetch` is on Node 24 / browsers)                                     |
| `apps/web`   | still unused                                                                                   |
| History      | M0–M3 and the post-M2 review logged                                                            |

Treat as given, from [`docs/history.md`](../history.md):

- Unary minus negates the literal. `-20 °C` is a temperature.
- `Token` is a closed union. Invented rewrite tokens span nothing.
- Canonical SI ids stay SI spellings. Public `Quantity` has no `offset`.
- `oz` is avoirdupois mass. `in` ranks as converter when a target follows.
- `pound` / `pounds` / `lb` is avoirdupois mass. Sterling does not steal them.
- `^` is dimensionless-only. `numeric.ts` is the numeric seam.
- Strict full-input consumption. Pipeline stages are not semver.
- Locale picks gallon / fl oz only, so far. Input decimal point is `.`.
- Six significant figures; integers print with `String(n)`. Compact is
  dimensionless-only. `k` remains kelvin. Compact `text` is not valid input.
- `Intl` formats the **number**; the unit is `Unit.symbol`. Output numerals are
  Latin `.`, no grouping.
- Lost addend → `precision-loss`. Cancellation residue snaps to `0`.
- Tests inject `now`; they never read the ambient clock. The default instance may.

`m3-formatting.md` §11 already pointed here: currency formatter next to the hoisted
number formatter, ISO 4217 minor units for fraction digits, compact `B` for money
(not `G`), `rate-*` must not become `0`, `$` and ISO-word collisions are lexer
problems.

---

## 1. Decisions

These close the three questions `plan.md` §6 parked until M4, and the forks that
would otherwise leak into every quote.

### 1.1 Frankfurter v2 is the source of truth; nobody passes a provider

`plan.md` asked for the terms of free no-key providers, especially caching and
redistribution.

[Frankfurter](https://frankfurter.dev/) is an MIT-licensed API, no key, CORS open,
`fetch` from browser or Node. v2 (current) blends daily rates from 84 central banks
over 201 ISO codes. v1 is ECB-only and superseded; we use **v2**. Commercial use is
allowed; the FAQ still points at each central bank’s terms for the underlying
observations. Rates are reference data, not tradeable quotes — say so in the README.

The pair endpoint is the whole conversion story. Frankfurter’s own JS docs:

```
GET https://api.frankfurter.dev/v2/rate/USD/EUR
→ { "date": "2026-08-25", "base": "USD", "quote": "EUR", "rate": 0.85673 }

to_amount = from_amount * data.rate
```

There is **no conversion endpoint**; they tell you to multiply. Same-currency pairs
return `rate: 1`, but we will not call them (see §1.7).

Default blend (`providers` omitted). Do not pin `providers=ECB` unless a later
milestone wants an official-reference mode. `/v2/rates?base=…&quotes=…` is a batch
form we do not need: one pair per HTTP call is enough, and it matches “use the
API directly.”

**The library calls Frankfurter. The user does not pass rates, a provider, or a
snapshot.** `SubscriptConfig.rates` and the M0 `RateProvider` hole go away. The
default `evaluate` is enough for `100 usd in eur`.

This is also why `evaluate` becomes async (§1.7). A synchronous API cannot wait
on HTTP without a cache, and this milestone does not add a cache.

Frankfurter’s FAQ: no monthly quotas; they rate-limit abuse; high-volume hosts
should cache, self-host, or read the datasets. We will hammer the public API if a
launcher evaluates on every keystroke. **Document that.** Redis (or any cache) is
a later host-side `fetch` wrapper, not M4. Do not memoize across `evaluate` calls.
A `Map` that lives for **one** `evaluate` (so the same pair is not fetched twice
in `$200 + €200 in usd`) is not a cache; it dies with the call.

Zero npm dependencies. `globalThis.fetch` is the client. No Frankfurter SDK.

### 1.2 ISO 4217 codes are facts; minor units come from `Intl`

Authoritative code list: SIX Group as ISO 4217 Maintenance Agency, List One
(Current Currency & Funds), including the Minor unit column, published free at
[SIX data standards](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html).
ISO permits free-of-charge use of ISO 4217 codes (same posture as ISO 3166 / 639).
The PDF standard is paywalled; the codes and minor-unit integers are not a
compilation we need to vendor.

We will **not** vendor SIX’s XML/XLS, and we will **not** scrape Frankfurter’s
`/v2/currencies` into our parser table. Hand-author a closed table of current
alphabetic codes, one cited row per currency, the same way M1 cited NIST. Ids are
the lowercase alphabetic code (`usd`, `eur`, `gbp`). Frankfurter’s 165 active
codes are the quote universe; our table is the parse universe. A code we do not
list is `not-an-expression`. A code we list but Frankfurter 404s is
`rate-unavailable`.

Minor-unit exponents at format time come from the runtime:

```ts
new Intl.NumberFormat("en-US", { style: "currency", currency: "JPY" }).resolvedOptions()
  .maximumFractionDigits; // 0
```

That is CLDR’s copy of ISO 4217, already on the machine, already what
`style: "currency"` will use. Do not store `minorUnits` on the row. If `Intl`
throws for a code (should not, for this table), fall back to 2.

Precious-metal and fund codes (`XAU`, `XDR`, `XXX`), historical List Three, and
crypto are out.

### 1.3 ISO-word collisions are real and small; case is the lever

`plan.md` named `IN`, `AS`, `TO`, `AT`, `ALL`, `TRY`, `NO`, `AM`, `PM`.

Two-letter tokens are **not currency**. `in` / `to` / `as` are already converter
(and `in` is inch). `at`, `no`, `am`, `pm` stay unrecognized words until M5.
We never register a 2-letter currency alias. `inr` is the rupee; `in` is not.

The leftover hazard is ISO 4217 **alpha-3 codes that are English words**. Under
strict full-input consumption the blast radius is small: `try this` still has
leftover prose; `100 try in usd` would be the bug. A closed uppercase-only list
kills it:

`ALL`, `TRY`, `TOP`, `CUP`, `COP`, `SOS`, `MAD`, `GEL`, `BAM`

Those ids (`all`, `try`, …) match in the trie only when the source slice is
exactly three ASCII uppercase letters. `100 TRY in usd` is lira. `100 try` is
`not-an-expression`. `100 usd` / `100 USD` / `100 Usd` all work — they are not
on the list.

`CUP` is on the list so a later volume `cup` is not pre-stolen. `pound` stays
mass; sterling is `gbp` / `£` / `pound sterling`.

Do not return `{ kind: "ambiguous" }` for these. Uppercase is the policy, not a
ranking fork.

### 1.4 A currency is a unit on an eighth dimension; scale stays 1

Do not put live rates on `UnitDef.scale` and do not mutate the catalog.

Extend the dimension vector with `C` (currency). It is not SI; it exists so the
M1 rules keep working: a bare number assimilates, `usd × metre` is an unnamed
product (`unknown-unit`), `usd / usd` is dimensionless, `sqrt(usd)` is unnamed.

Every currency row is `affine: "linear"`, `scale: 1`, `offset: 0`,
`dimension: CURRENCY`. Conversion does **not** go through `toSI` / `fromSI`.
`convert` / mixed `add` / `sub` / cross-currency `div` quote Frankfurter.

Same-currency arithmetic does not fetch: `$10 + $5` is `$15` offline.

### 1.5 Last currency wins on mixed addition; larger-unit-wins stays SI

M1: larger `scale` wins for SI. All currencies have `scale: 1`, so that rule is
meaningless here. Soulver’s published rule (research §6) is **last unit wins**:
`$200 + €200` is in euros.

- Mixed currency `+` / `-`: convert the left onto the right’s currency, then
  add/sub the values. Fetches `USD/EUR` (or whatever the pair is).
- `$200 + 50` / `50 + $200`: dimensionless assimilates; no fetch.
- `$10 × €5`: unnamed product → `unknown-unit`. No fetch, no inferred pair.
- `$30 × 4 days`: unnamed product → `unknown-unit`. Do **not** infer `$30/day`.
- `$10 / $2`: dimensionless `5`; no fetch.
- `$10 / €2`: quote EUR→USD (denominator into numerator’s currency), then
  divide.

### 1.6 `$` is locale-biased; prefixes disambiguate; no `alternates` dump

`plan.md` §4 M4: `$` → locale default, with `US$`, `C$`, `A$`, `NZ$`, `S$`,
`HK$`, `R$`.

Region from the BCP 47 locale (same prefix-matching style as `volumeLocale`),
independent of US/imperial volume. `en-AU` is still US gallons and **AUD** for
`$`. `en-GB` is imperial gallons, `£` is GBP, `$` is **USD**.

| Region (case-insensitive)  | `$` / `dollar` / `dollars` |
| -------------------------- | -------------------------- |
| `CA`                       | `cad`                      |
| `AU`                       | `aud`                      |
| `NZ`                       | `nzd`                      |
| `SG`                       | `sgd`                      |
| `HK`                       | `hkd`                      |
| `TW`                       | `twd`                      |
| `MX`                       | `mxn`                      |
| `BR`                       | `brl`                      |
| `US`, `GB`, missing, other | `usd`                      |

Always-on prefixes (not locale-scoped):

| Alias       | Id  |
| ----------- | --- |
| `US$`       | usd |
| `C$`, `CA$` | cad |
| `A$`, `AU$` | aud |
| `NZ$`       | nzd |
| `S$`        | sgd |
| `HK$`       | hkd |
| `NT$`       | twd |
| `R$`        | brl |

`NT$` is Soulver’s list (research §8.3) and the cheap twin of `TW` → `twd`.
Do not add `U$`.

Do not fill `Result.alternates` with every other dollar. Prefixes are the
switch. Document the table in the README.

`€` / `euro` / `euros` → `eur`. `£` / `pound sterling` / `pounds sterling` /
`sterling` → `gbp`. `¥` / `yen` → `jpy`. `yuan` / `cny` / `rmb` → `cny` (`¥`
is yen, not yuan). `₹` / `rupee` / `rupees` / `inr` → `inr`.

### 1.7 `evaluate` is async; quote the pair; do not triangulate

Frankfurter already returns `USD→EUR`. We do not take a base-currency snapshot
and triangulate. The M0 `RateProvider.quote` sketch was a sync hole; replace the
whole idea.

```ts
export type Subscript = {
  evaluate(input: string): Promise<Result>;
  spans(input: string): readonly Span[]; // still sync; no quote needed
};

export function evaluate(input: string): Promise<Result>;
```

SI inputs still do not hit the network. They resolve a `Promise` without `fetch`.
Currency identity (`100 usd`, `100 usd in usd`, `$10 + $5`) does not fetch.
Cross-currency ops fetch.

**HTTP**

```
GET {origin}/v2/rate/{BASE}/{QUOTE}
Accept: application/json
```

- `origin` is `https://api.frankfurter.dev` (constant).
- `BASE` / `QUOTE` are uppercase ISO 4217 from **catalog ids**, never raw user
  text interpolated into a host. `usd` → `USD`.
- `AbortSignal.timeout(5000)` so a hung socket becomes `rate-unavailable`, not
  a wedged keystroke.
- `fetch` resolves on HTTP errors: check `res.ok`.
- 400 / 404 / 422 / 503 / network throw / non-JSON / missing or non-finite
  `rate` / `rate <= 0` → `{ kind: "rate-unavailable", currency }` with the
  **target** id (the quote, when converting; the first missing id otherwise).
- Do not produce `{ kind: "rate-pending" }`. That was for a sync evaluate plus a
  background refresh. We `await` the one request. Leave the variant on `Failure`
  so the M0 union stays; nothing in M4 constructs it.
- Do not add `stale` or `asOf` to `Result`. There is no retained snapshot.
  Frankfurter’s `date` is the observation day (weekends trail); we do not
  surface it in M4.

Do not use `/v2/rates` (full table). Do not use v1 `/v1/latest`.

**Programmatic API.** `quantity` / `mul` / `sqrt` stay sync — they never quote.
`convert` / `add` / `sub` / `div` become `Promise<Result>` because mixed
currency may fetch. SI paths resolve immediately without I/O.

```ts
export function convert(qty: Quantity, toId: string): Promise<Result>;
export function add(a: Quantity, b: Quantity): Promise<Result>;
export function sub(a: Quantity, b: Quantity): Promise<Result>;
export function div(a: Quantity, b: Quantity): Promise<Result>;
```

They use the same default Frankfurter `fetch` as `evaluate`. No extra argument.

**Test / self-host seam.** Users do not pass this. Tests do, so `npm test` is
offline and deterministic — same posture as `now`:

```ts
export type SubscriptConfig = {
  locale?: string;
  compact?: boolean;
  now?: NowFn; // still unused (M5)
  /** Defaults to globalThis.fetch. Tests inject a stub; Redis later wraps this. */
  fetch?: typeof globalThis.fetch;
};
```

Drop `rates` from the config. Drop public `RateProvider`. The stub must implement
enough of `fetch` to answer `GET …/v2/rate/USD/EUR` with a JSON `Rate` body
(`date`, `base`, `quote`, `rate`). A tiny in-memory USD-base table is enough:

```
rate(from, to) = TABLE[to] / TABLE[from]
```

with round numbers (`eur: 0.5`, …) so fixture `text` is exact.

**One evaluate, many pairs.** Left-associative `$200 + €200 + £10` may quote
twice. Memoize `from/to → rate` on a `Map` that exists for that call only.
Do not store it on the instance.

### 1.8 Money formatting is `style: "currency"`, not six sig figs

M3 compact uses `G` for 1e9. Soulver uses `B`/`bn` next to a currency symbol.
Keep the split.

Non-compact: hoisted `Intl.NumberFormat("en-US", { style: "currency", currency,
currencyDisplay: "symbol", useGrouping: false, numberingSystem: "latn" })`.
Fraction digits are Intl’s. `$1` is `$1.00`. JPY is `¥1`. KWD has three decimals.
Do not append `Unit.symbol` on top — the formatter already emitted the symbol.
Locale on the factory still does not change numerals or grouping.

Compact (default on, `|n| >= 1000`, `< 1e18`): suffixes `k` / `M` / `B` / `T` /
`P` (`B` = 1e9, **not** `G`). Significand formatted with the currency’s maximum
fraction digits, trailing zeros stripped (`$1.5k`, not `$1.50k`). Prefix
`Unit.symbol` with no space (`$1.5k`, `€3.3M`, `¥1B`). Negative keeps `-`.
`createSubscript({ compact: false })` turns this off for money too.

`Quantity.value` stays the float. Rounding is display-only, same as M3.

Do not use compact `text` as input. `$1k` is not a lexer of `k`.

### 1.9 Prefix symbols are a rewrite swap; ISO codes stay postfix

`$100` lexes as unit then number. Pratt today only attaches a unit **after** a
number (`100 usd`, `2km`).

Rewrite, greedy left to right: a `unit` token immediately followed by a `number`,
whose `raw` is **not** all letters, swaps to `number, unit`. Both tokens keep
their spans. No invented token.

- `$100`, `US$100`, `€50`, `£20`, `-$100` (unary minus, then swapped pair)
- `100$`, `100 usd`, `100 USD` already work; do not swap `usd 100`

Parser, spans, and convert-target logic keep treating the token as `kind: "unit"`.
`spans()` maps a currency id to `kind: "currency"`. No new `Token` variant.

### 1.10 Closed catalog, cited, no GNU Units, no CLDR dump

Hand-author current ISO 4217 alphabetic codes we will actually parse. Citation
on every row: ISO 4217 / SIX List One, with the SIX URL. English names in the
alias list (`euro`, `yen`) are ordinary vocabulary, not a vendored compilation.

M4 catalog (ids). A calculator set Frankfurter can quote (all of these are
active on frankfurter.dev/currencies as of this plan):

`usd`, `eur`, `gbp`, `jpy`, `cny`, `aud`, `cad`, `nzd`, `chf`, `sek`, `nok`,
`dkk`, `pln`, `czk`, `huf`, `ron`, `try`, `isk`, `ils`, `zar`, `inr`, `krw`,
`sgd`, `hkd`, `twd`, `thb`, `myr`, `idr`, `php`, `mxn`, `brl`, `ars`, `clp`,
`cop`, `pen`, `aed`, `sar`, `qar`, `kwd`, `bhd`, `omr`, `jod`, `egp`, `ngn`,
`pkr`, `bdt`, `vnd`, `uah`, `kzt`

Forty-nine codes. Adding a row later is data, not a milestone. Unknown codes
are unknown words → `not-an-expression`.

---

## 2. Target layout

```
packages/subscript/src/
  types.ts                 # drop RateProvider; evaluate is Promise<Result>
  create.ts                # capture fetch; evaluate async
  evaluate.ts              # async
  pipeline.ts              # evaluateAst async; quote pairs via rates.ts
  quantity.ts              # convert/add/sub/div async
  rates.ts                 # quotePair(from, to, fetch) → Frankfurter v2
  format.ts                # currency Intl + compact B
  dimension.ts             # 8th component C
  units/kinds.ts           # CURRENCY
  units/table.ts           # 49 currency rows, scale 1
  units/aliases.ts         # ISO names, symbols, locale $
  units/trie.ts            # cache by volume × dollar; uppercase-only ids
  lex.ts                   # unchanged except trie policy it already honors
  rewrite.ts               # prefix-symbol swap
  parse.ts                 # unchanged (still postfix unit)
  …

packages/subscript/test/
  rates.test.ts            # URL shape, identity skip, stubbed fetch, failures
  quantity.test.ts         # await convert/add/sub/div; mixed last-wins
  format.test.ts           # $1.00, ¥1, compact $1.5k / $1B
  rewrite.test.ts          # $100 → number, unit
  aliases.test.ts          # $ locale, TRY vs try, pound ≠ gbp
  fixtures/accept.ts       # usd-in-eur succeeds against the stub
  fixtures/types.ts        # optional fetch on a fixture
  fixtures.test.ts         # inject stub fetch; await evaluate
  api.test.ts              # await evaluate
  spans.test.ts            # kind: "currency" (still sync)
  units.test.ts            # currency rows in BY_DIMENSION
  fetch-stub.ts            # shared in-memory Frankfurter stub
```

Zero runtime dependencies. No `examples/` provider package. No Redis. No
in-process snapshot store.

---

## 3. Config and types

```ts
export type SubscriptConfig = {
  locale?: string;
  compact?: boolean;
  now?: NowFn;
  fetch?: typeof globalThis.fetch;
};

export type Result =
  | { ok: true; value: Quantity; text: string; alternates?: readonly Alternate[] }
  | { ok: false; reason: Failure };
```

No `stale` on success. `Failure.rate-unavailable` / `rate-pending` still carry
`currency: string`. Fill `currency` with a lowercase canonical id when we
produce `rate-unavailable`. Fixtures still assert `reason.kind` only.

`create.ts` holds `{ trie, format, fetch }` in the closure. `fetch` defaults to
`globalThis.fetch`. The free `evaluate` is still a lazy `createSubscript()`.

Trie cache key is `(volumeLocale, dollarCurrency)`, not volume alone.

---

## 4. Catalog and dimension

`Dimension` grows a last slot `C`. `DimensionExponents` grows `C?`. Every
helper that zips seven components zips eight. `isDimensionless` remains “all
exponents zero.”

```ts
export const CURRENCY = dimension({ C: ONE });
```

Currency helper in `table.ts`:

```ts
function currency(id: string, symbol: string): UnitDef {
  return linear({
    id,
    symbol,
    dimension: CURRENCY,
    scale: 1,
    source: {
      citation: "ISO 4217 / SIX List One",
      url: "https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html",
    },
  });
}
```

`symbol` is the compact-prefix character or short marker (`$`, `€`, `£`, `¥`,
`₹`, `CHF`, `zł`, …). Non-compact `text` comes from Intl, not this field.
Several rows may share `$`; that is fine because `$` is **not** auto-inserted
from `symbol` (see §7).

`units.test.ts`: kebab-case still holds (`usd`). Every currency id maps to
`CURRENCY`. Unique ids. Finite scale. Cited source.

`lookup.ts` `findResultUnit` will not find a C² row; `mul` already returns
`unknown-unit`. No change required beyond the 8-tuple equality.

---

## 5. Rates

`src/rates.ts`:

```ts
export const FRANKFURTER_ORIGIN = "https://api.frankfurter.dev";

export type Factor =
  | { ok: true; factor: number }
  | { ok: false; reason: Extract<Failure, { kind: "rate-unavailable" }> };

export function quotePair(
  fromId: string,
  toId: string,
  fetchFn: typeof fetch,
  memo: Map<string, Promise<Factor>>,
): Promise<Factor>;
```

`quotePair`:

1. `fromId === toId` → `{ ok: true, factor: 1 }` without `fetch`.
2. Else `GET ${FRANKFURTER_ORIGIN}/v2/rate/${fromUpper}/${toUpper}` with the
   timeout signal. Dedup through `memo` keyed `"usd/eur"`.
3. Parse JSON `{ rate: number }`. Validate as §1.7.
4. `factor` is `data.rate` (already `from → to`). Multiply with `numeric.mul`.

Do not invert through a base. Do not read `data.date` except to ignore it.

Pipeline `runPipeline` becomes `async`. Parse and rank as today. When
`evaluateAst` needs a factor, `await quotePair(...)`. Rank two readings
sequentially so we do not fire speculative quotes for a losing `in`/inch fork
that does not need money — but if both readings need a pair, two calls is
fine (memo still helps if the pair is the same).

```ts
export function runPipeline(
  input: string,
  trie: TrieNode,
  format: Formatter,
  fetchFn: typeof fetch,
): Promise<PipelineOutput>;
```

`spans()` runs the pipeline but must **not** quote. Span coloring only needs
the winning token stream. Implement `spans` as normalize → lex → rewrite →
parse/rank without evaluating currency ops, **or** run the same pipeline and
skip `quotePair` because spans are taken from tokens before eval. Today
`runPipeline` evaluates in order to pick a winner (`in` as converter vs inch).
That ranking for SI does not fetch. For `100 usd in eur` both readings that
need a rate… inch reading will not parse. Converter reading fetches.

**`spans("100 usd in eur")` may fetch** if it shares `runPipeline`. Avoid that:
split “tokens + winner for coloring” from “evaluate.” Ranking for this input
does not require a numeric rate — a successful parse of the converter reading
is enough to color, and evaluation can be skipped when the caller only wants
spans. Add a `mode: "eval" | "spans"` (or stop evaluating in `spans`): if a
reading parses, prefer the same `readsInAsConverter` rule on **parse success**
rather than eval success when quoting would be required. Simplest rule that
keeps today’s SI behavior: `spans` uses the current pipeline **except** it
does not call `quotePair`; a parsed convert-to-currency AST is treated as
success for ranking even without a number. Failures that need a rate do not
matter for coloring.

Do not let `spans` throw if fetch would have failed.

---

## 6. Quantity rules (currency branch)

Detect with `dimensionsEqual(def.dimension, CURRENCY)`.

Thread `fetchFn` + per-call `memo` through the async helpers. Public functions
create an empty `memo` and use `globalThis.fetch` (or the instance’s fetch
when called from the pipeline).

**convert**

- Else existing SI / affine path (no await needed; still return a Promise).
- Both currency, same id: `ok(value, to)` with no fetch.
- Both currency, different id: `quotePair` then `ok(value * factor, to)`.
- Currency ↔ SI: `dimension-mismatch` (do not fetch).

**add / sub**

- If either operand is currency and the other is SI non-dimensionless:
  `dimension-mismatch`.
- If both currency and same id: `addChecked` / `subChecked` on the values,
  keep that unit; no fetch.
- If both currency and different ids: `quotePair(left → right)`, operate in
  the right unit (last wins).
- Dimensionless assimilate unchanged.

**div**

- Both currency, same id: dimensionless `div` of the values; no fetch.
- Both currency, different ids: quote the denominator into the numerator’s
  currency, then divide; result dimensionless.
- Currency / dimensionless: keep currency (existing branch).
- Else existing `derived` path.

**mul / sqrt / pow:** no special case. Unnamed C² / √C fail `unknown-unit`.
`^` stays dimensionless-only in the pipeline.

Affine temperature checks do not apply (currencies are linear).

---

## 7. Lexer, trie, rewrite

### 7.1 Aliases

ISO code (lowercase and, via folding, any case) → id, except the uppercase-only
set in §1.3. English names as listed in §1.6. Phrase fusion for `pound sterling`
and `fluid ounce`-style multi-word entries already works in the trie.

Locale-scoped: `$`, `dollar`, `dollars` → `dollarCurrency(locale)`.

Do **not** auto-insert `UnitDef.symbol` for `CURRENCY` rows. Shared `$` would
otherwise pin to whichever row `UNITS` lists first. Symbols that are unique
(`€`, `£`, `₹`) are explicit alias rows, same as `°C`.

### 7.2 Uppercase-only match

`matchTrie` stays folded. After a unit hit whose `unitId` is in
`UPPERCASE_ONLY_IDS`, the lexer compares the matched slice to `/^[A-Z]{3}$/`.
Failure: treat as no match and fall through to `readUnknown` (the three letters
become `unknown` → `not-an-expression`).

Need the original slice; normalization already preserves case (`m2-parser.md`
§1.10).

### 7.3 Prefix rewrite

```ts
function isPrefixCurrency(token: Token): boolean {
  return token.kind === "unit" && !isAllLetters(token.raw);
}
```

`unit, number` where `isPrefixCurrency(unit)` → emit `number, unit`. Do not
swap SI `m 10`. Do not swap `usd 100`.

`-$100`: tokens `-`, `$`, `100` → `-`, `100`, `$`. Unary minus already
understands `-20 c`.

### 7.4 Spans

```ts
function spanKind(token: Token): SpanKind {
  if (token.kind === "unit" && lookupUnit(token.unitId)?.dimension is CURRENCY) {
    return "currency";
  }
  // existing switch
}
```

`spans("100 usd in eur")`: number, currency, converter, currency.
`spans("$100")` after rewrite: number (the `100`), currency (the `$`) — original
offsets, so `$` is still at 0 and `100` at 1. **Sort by `start` then `end`** so
`$100` colors `$` then `100` left-to-right. Empty spans still dropped.

### 7.5 Ranking

No new ambiguous token. `in` is still the only alternate. `$` is not ranked
against other dollars.

---

## 8. Format algorithm

`createFormatter` still builds the M3 decimal/scientific pair. It also builds
(or lazily caches) one `style: "currency"` formatter per catalog ISO code.

`formatQuantity`:

1. If `lookupUnit(qty.unit.id)` is `CURRENCY` → `formatMoney(value, id, compact)`.
2. Else existing `formatNumber` + space + `symbol`.

`formatMoney`:

1. ISO = `id.toUpperCase()`.
2. Compact && `abs >= 1000` && `abs < 1e18`: scale with `k/M/B/T/P`; format
   significand via a hoisted decimal formatter with
   `maximumFractionDigits` from the currency formatter’s
   `resolvedOptions()`, `useGrouping: false`; strip trailing zeros and a
   trailing `.`; bump suffix if rounding hits `1000`; return
   `sign + symbol + body + suffix` using `Unit.symbol`.
3. Else `currencyFormatters.get(iso).format(value)`, then replace U+2212 with
   `-` so negatives match M3.

Do not six-sig-fig money. Do not `notation: "compact"` (emits `K`/`B` in ways
that fight kelvin and our `B` policy).

Worked (en-US Intl; tests lock whatever Node 24 actually emits for step 3):

| Quantity              | compact on | `text` (typical) |
| --------------------- | ---------- | ---------------- |
| 1 usd                 | either     | `$1.00`          |
| 1 jpy                 | either     | `¥1`             |
| 1.5 usd               | either     | `$1.50`          |
| 1500 usd              | on         | `$1.5k`          |
| 1500 usd              | off        | `$1500.00`       |
| 1e9 usd               | on         | `$1B`            |
| 100 usd, factor 0.5 € | on         | `€50.00`         |

If Node’s `en-US` currency string for a code surprises us (e.g. `US$` vs `$`),
the test is the spec — record it, do not post-process toward a fantasy.

---

## 9. Tests

### 9.1 Shared Frankfurter stub

`test/fetch-stub.ts` implements `typeof fetch`. Parse `pathname` for
`/v2/rate/{BASE}/{QUOTE}`. Serve:

```ts
const TABLE = { USD: 1, EUR: 0.5, GBP: 0.5, JPY: 100, CAD: 2, TRY: 30 };
```

`rate = TABLE[QUOTE] / TABLE[BASE]`. Unknown codes → `422` with
`{ message: "Could not find currency …" }`. Missing table entry → `404`.
Body shape matches Frankfurter: `{ date: "2013-02-12", base, quote, rate }`.
(`date` is the Duckling reference day; unused by us.)

Every `createSubscript` in unit tests that might convert currency passes
`{ fetch: stubFetch }`. The fixture harness always injects the stub, even for
SI rows (they will not call it).

`npm test` must not call `api.frankfurter.dev`.

### 9.2 Accept fixtures

Drop `todo` on `usd-in-eur`. It now **succeeds** against the stub:
value `50`, unit `eur`, money `text`.

| `name`              | `input`               | Expect                                   |
| ------------------- | --------------------- | ---------------------------------------- |
| `usd-in-eur`        | `100 usd in eur`      | `eur`, `50`, Intl `text`                 |
| `usd-identity`      | `100 usd`             | `usd`, `100`, money `text`, **no fetch** |
| `usd-in-usd`        | `100 usd in usd`      | same, **no fetch**                       |
| `dollar-prefix`     | `$100`                | `usd`, `100`                             |
| `dollar-locale-cad` | `$100` locale en-CA   | `cad`, `100`                             |
| `us-dollar-prefix`  | `US$100` locale en-CA | `usd`, `100`                             |
| `mixed-last-wins`   | `$200 + €200`         | `eur`, `300` (`200×0.5 + 200`)           |
| `uppercase-try`     | `100 TRY in usd`      | `usd`, `100/30`                          |
| `quote-failed`      | `100 kzt in usd`      | `rate-unavailable` (omit KZT from stub)  |

Assert identity rows did not call `fetch` (stub counter). Keep `pst-in-tokyo`
todo.

A separate `rates.test.ts` case: stub `fetch` that rejects →
`rate-unavailable`. Timeout/abort → `rate-unavailable`.

Do not add pending or stale rows.

### 9.3 Reject — add

| `name`             | `input`          | Why                          |
| ------------------ | ---------------- | ---------------------------- |
| `lowercase-try`    | `100 try`        | uppercase-only ISO word      |
| `lowercase-all`    | `100 all in usd` | same                         |
| `usd-100-words`    | `usd 100`        | prefix swap is symbols only  |
| `dollar-for-lunch` | `$10 for lunch`  | comment-word still forbidden |

`send-to-john` and `question` stay `not-an-expression`.

### 9.4 Accept-shaped failures (not the reject corpus)

| `name`              | `input`             | Expect               |
| ------------------- | ------------------- | -------------------- |
| `pound-to-usd`      | `100 pounds in usd` | `dimension-mismatch` |
| `dollar-times-days` | `$30 * 4 days`      | `unknown-unit`       |
| `usd-times-eur`     | `$10 * €5`          | `unknown-unit`       |

These do not fetch (`pound-to-usd` mismatches before quote).

### 9.5 Programmatic / unit tests

- `quotePair("usd","usd")` is 1 and does not fetch.
- `await convert(quantity(100,"usd"), "eur")` with stub is 50.
- `await add($200, €200)` last-wins euros.
- `await add($10, $5)` no fetch.
- `quantity(100, "try")` works (lexer policy is not the programmatic API).
- Format: `quantity(1, "usd").text` matches Node Intl; compact `$1500` → `$1.5k`;
  compact off → no `k`; `quantity(1e9, "usd")` → `$1B` not `$1G`.
- `await evaluate("2.5k")` still kelvin.
- `spans("100 usd in eur")` uses `currency` and does not fetch.
- Aliases: `en-GB` `$` is usd; `en-GB` `£100` is gbp; `en-AU` `$` is aud;
  `gallon` still US vs imperial as today.
- Existing `quantity.test.ts` SI cases `await` the four async functions.
  Behavior unchanged.

### 9.6 Unchanged

Fuzz (well-formed `Result`; inject the stub; include `rate-unavailable`). Bench
(same three **SI** inputs, `< 2s`; must not fetch). Affine tests. M3 format /
numeric cases. Every pre-existing reject fixture.

No live network test in `npm test`. An optional `FRANKFURTER_LIVE=1` file is
not M4.

---

## 10. Implementation order

Each step leaves `npm test` and `npm run typecheck` green.

1. `dimension.ts` 8th component; `CURRENCY` in `kinds.ts`. SI tests unchanged.
2. `rates.ts` + stub + `rates.test.ts`. `quotePair` against the stub only.
3. Currency rows + aliases. `quantity(100, "usd")` constructs. Same-currency
   add still sync-looking via `await add`.
4. Make `convert` / `add` / `sub` / `div` / `evaluate` / `runPipeline` async.
   Wire `quotePair` + per-call memo. SI tests await; results identical.
   Quoted conversion works with the stub. Mixed last-wins. Failed fetch →
   `rate-unavailable`.
5. Trie: locale `$`, prefixes, uppercase-only list, cache key
   `volume × dollar`. Alias tests.
6. Rewrite prefix swap. `$100`. Spans sort + `currency` kind; spans do not
   fetch.
7. `format.ts` money path. Hoist currency formatters on the instance.
   `text` assertions. Compact `B`.
8. Fixtures §9.2–9.4. Drop `todo` on `usd-in-eur`. Harness injects stub
   `fetch` and `await`s.
9. README: `await evaluate("100 usd in eur")`. Mention Frankfurter v2, not
   tradeable, no provider, one HTTP call per pair, no cache (Redis later),
   `$` locale table, `TRY` vs `try`, `pound` is mass, compact `$1B`. Keep
   `20 c to f` true (now `await`). Offline SI still works.
10. Append the M4 entry to `docs/history.md`. Record the reversal of
    “no network by default.”

No LICENSE, no package rename, no timezone, no `apps/web`, no CLDR dump, no
Redis, no ECB example package, no Frankfurter npm client.

---

## 11. Done when

- `npm test` and `npm run typecheck` are green, with **zero** calls to
  `api.frankfurter.dev`.
- `await evaluate("100 usd in eur")` (default instance, stubbed in tests;
  real Frankfurter in production) is 50 EUR against the stub, money `text`.
- `await evaluate("100 usd")` is 100 USD with money `text` and no `fetch`.
- `await evaluate("$100")` is 100 USD (`en-US`); `en-CA` is 100 CAD; `US$100`
  is USD under `en-CA`.
- `await evaluate("100 TRY")` is 100 `try`; `await evaluate("100 try")` is
  `not-an-expression`.
- `await evaluate("100 pounds in usd")` is `dimension-mismatch`.
- `$200 + €200` is last-wins euros against the stub.
- `$30 * 4 days` is `unknown-unit`.
- Stub `fetch` rejection → `rate-unavailable`. Identity ops do not fetch.
- Compact `$1500` is `$1.5k`; `$1e9` is `$1B`; `2.5k` is still kelvin.
- `spans("100 usd in eur")` uses `currency` for both codes and does not fetch.
- `evaluate` / instance `evaluate` return `Promise<Result>`. `spans` is sync.
- Zero runtime dependencies; no `eval` / `new Function`; no cache layer.
- `docs/history.md` has an M4 log entry (Frankfurter v2 pair endpoint, async
  evaluate, no user provider, no triangulation, eighth dimension, last-wins,
  `$` locale, uppercase-only ISO words, Intl money, compact `B`).

---

## 12. Out of scope

- Caching (in-process TTL, Redis, HTTP cache headers, `/v2/rates` snapshots)
- Injected `RateProvider`, hard-coded rate floor, historical `?date=`, custom
  “at 1.05 USD/EUR”, crypto, pinning `providers=ECB`
- Comment-word tolerance (`$10 for lunch`), implicit rates (`$30 × 4 days`)
- Inverted conversion, `km m` shorthand
- Grouping separators, locale decimal comma, locale currency _layout_ beyond
  what `en-US` `style: "currency"` already emits
- `alternates` listing other dollars; user-configurable symbols
- `%`, `million` as a word, compact **input** (`$1k`)
- Registering 2-letter codes; stealing `pound` / `cup` / `in`
- Precious metals, IMF SDRs, ISO List Two/Three
- Shipping SIX XML, CLDR XML, or GNU Units
- `apps/web`, LICENSE, npm rename, CI, executable-markdown runner
- Time zones, `3pm`, `now` (M5)
- Returning `{ kind: "ambiguous" }`
- A live Frankfurter integration test as part of `npm test`

If it is not in §10, it is not M4.

---

## 13. What M5 (and Redis) need

- `now` is still unused. Time zones do not fit `Quantity`; they need their own
  value type and `Intl.DateTimeFormat` / `formatToParts` (or Temporal later).
  Do not smuggle clock times into the currency dimension.
- `am` / `pm` stay unrecognized until M5. That is why they are not uppercase-only
  currency codes.
- `spans` already has `kind: "timezone"`. Color it the way M4 colored `currency`
  — token kind can stay something the parser understands; span kind is semantic.
- Redis later: wrap `SubscriptConfig.fetch` (or replace the function the
  instance already closes over). Do not invent a second rates API. The wrapper
  can cache `GET /v2/rate/USD/EUR` by URL. M4’s lack of cache is deliberate.
- After M5 ships, append a history entry. Do not reverse Frankfurter-as-default,
  async `evaluate`, “identity does not fetch”, last-wins mixed currency, `$`
  locale table, uppercase-only ISO words, “`pound` is mass”, six sig figs for
  SI, compact dimensionless `G` vs money `B`, or “Intl formats money including
  the symbol.”
