# M5 — Time zones

Implementation plan for the sixth and last package milestone in
[`docs/plan.md`](../plan.md). That document is _why_. This one is _what_,
_where_, and _in what order_.

M0 stubbed `evaluate`. M1 filled `Quantity`. M2 made natural language evaluate.
M3 made `text` the product. M4 added money as an eighth dimension and an async
Frankfurter quote. Time zones are the remaining domain in `goal.md`. They do
**not** fit `Quantity` (`plan.md` §3.6, `m4-currency.md` §13): a clock time is
an instant plus a place, not a scale factor on a dimension vector. What M5 adds
is a second value type, a closed alias list, clock-time lexing, and conversion
through `Intl.DateTimeFormat` / `formatToParts`.

This is the last **package** milestone. `plan.md` §4 lists M0–M5 and then
stops. After this ships, `packages/subscript` covers arithmetic, units,
currency, and time zones. What remains is not an M6: `apps/web` product work
(called out as separate from these milestones), the continuous quality work
already running from M2 (fuzz, fixtures, benches), and the items in
`plan.md` “Explicitly not now.”

No reversal of M4. `evaluate` stays `Promise<Result>`. Identity currency still
does not fetch. Time conversion never fetches.

**Exit:** `await evaluate("3pm PST in Tokyo")` is `8:00 AM JST` plus a date
when the calendar day rolls; the supported alias list is in the README; `now`
is injected and tests never read the ambient clock; PST in July is still
UTC−8; `pacific time` in July follows `America/Los_Angeles`.

---

## 0. Current state

| Item           | Today                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| Public API     | `evaluate` → `Promise<Result>`; `Result.value` is always `Quantity`                          |
| `now`          | on `SubscriptConfig`; **never called**. Default instance does not read the clock             |
| Time tokens    | `3pm`, `PST`, `Tokyo`, `am` / `pm` are unknown words → `not-an-expression`                   |
| Convert target | trailing `unit` only (`parse.ts`). No timezone token                                         |
| `spans`        | `kind: "timezone"` exists on the union; nothing emits it                                     |
| Engine         | Node ≥ 24. Temporal is **not** on by default (that is Node 26). Safari stable still lacks it |
| Runtime deps   | zero (keep it that way — no polyfill, no `@vvo/tzdb`, no tzdata file)                        |
| `pst-in-tokyo` | accept fixture, `todo: true`, placeholder `text: "8:00 JST"`, `unitId: "1"`, `value: 0`      |
| `apps/web`     | already calls `evaluate` and dumps JSON; no time-specific UI                                 |
| History        | M0–M4 and the post-M2 review logged                                                          |

Treat as given, from [`docs/history.md`](../history.md):

- Unary minus negates the literal. `-20 °C` is a temperature.
- `Token` is a closed union. Invented rewrite tokens span nothing.
- Canonical SI ids stay SI spellings. Public `Quantity` has no `offset`.
- `oz` is avoirdupois mass. `in` ranks as converter when a target follows.
- `pound` is mass. `TRY` is uppercase-only; `try` is not a unit.
- `$` follows locale region. Prefixes disambiguate. Mixed currency last-wins.
- `evaluate` is async. Identity money does not fetch. Tests inject `fetch`.
- `^` is dimensionless-only. `numeric.ts` is the numeric seam.
- Strict full-input consumption. Pipeline stages are not semver.
- Six significant figures for SI; compact dimensionless-only (`G` for 1e9).
  Money uses `style: "currency"` and compact `B`.
- Tests inject `now`; they never read the ambient clock. The default instance
  may. `REFERENCE_INSTANT` is `2013-02-12T04:30:00.000Z` (Duckling).
- `am` / `pm` were reserved by M4 so they would not become currency codes.

`m4-currency.md` §13 already pointed here: do not smuggle clock times into the
currency dimension; color `spans` `timezone` the way M4 colored `currency`;
do not reverse Frankfurter-as-default.

---

## 1. Decisions

These close the three questions `plan.md` §6 parked until M5, and the forks
that would otherwise leak into every conversion.

### 1.1 `Intl` is the engine; do not ship tzdata; do not take `@vvo/tzdb`

`plan.md` asked what [`@vvo/tzdb`](https://github.com/vvo/tzdb) contains, how
it is generated, its size, and its license.

As of this plan: MIT-licensed npm package, ~171 KB unpacked, no runtime
dependencies. It re-exports simplified IANA zone names, “Pacific Time”-style
alternative names, major cities per zone, raw IANA names (including
`backward` links), and current offsets. The npm tarball is regenerated from
[GeoNames](https://www.geonames.org/), which itself tracks IANA. GeoNames
data is **CC BY 4.0** — attribution required, compilation not ours to
vendor. IANA tzdb itself is public domain.

We will **not** depend on `@vvo/tzdb`, **not** vendor its JSON, and **not**
copy GeoNames city lists. Same posture as GNU Units in M1: the facts (this
city observes this IANA zone) are not copyrightable; their compilation is.
Hand-author a closed alias table. Cite IANA on IANA ids. City → zone rows
are editorial, documented in the README, not a gazetteer dump.

**Arithmetic backend.** Temporal reached Stage 4 in March 2026 and is on by
default in **Node 26** (May 2026). This package’s engine is `node: ">=24"`.
Safari stable still does not ship Temporal. A polyfill is a dependency and a
bundle tax. `plan.md` §3.6 already picked the fallback: a narrow internal
interface implemented with `Intl.DateTimeFormat` + `formatToParts()`. The
runtime already ships tzdata for `Intl`. Stale rules are the platform’s
problem (`plan.md` §5.5), which is the point.

```ts
export type Wall = {
  readonly year: number; // Gregorian, full
  readonly month: number; // 1–12
  readonly day: number; // 1–31
  readonly hour: number; // 0–23
  readonly minute: number;
  readonly second: number;
};

export type TzEngine = {
  /** Instant → wall clock in an IANA zone. */
  wall(epochMs: number, iana: string): Wall;
  /**
   * Wall clock in an IANA zone → instant. DST gaps and overlaps use Temporal
   * `disambiguation: "compatible"` (§1.7).
   */
  instant(wall: Wall, iana: string): number;
};
```

M5 implements this with `Intl` only. Do not read `globalThis.Temporal`. A
later host on Node 26 can swap the same interface; that is not this
milestone.

`Intl.supportedValuesOf("timeZone")` is the existence check for an IANA id
at table-build time in tests, not a source of aliases. Do not register every
supported value.

Fixed-offset abbreviations (`PST` = UTC−8) **do not go through Intl zones**.
They are integer minutes from UTC. `Etc/GMT+8` is POSIX-inverted; do not
use it.

Offset conversion is calendar arithmetic:

```
epochMs = Date.UTC(year, month - 1, day, hour, minute, second)
        - offsetMinutes * 60_000
```

Wall from epoch: add `offsetMinutes` and read `Date.UTC` components. No
tzdata, no DST, no gap.

### 1.2 Time is not a `Quantity`; `Result.value` becomes a union

`plan.md` §2.4 sketched `value: Quantity` only. §3.6 says time does not fit.
Do not put `epochMilliseconds` in `Quantity.value` and a zone in
`Quantity.unit`. Do not add a ninth dimension.

```ts
export type ZonedTime = {
  readonly kind: "zoned-time";
  readonly epochMilliseconds: number;
  /** IANA id (`Asia/Tokyo`) or canonical offset id (`utc-0800`). */
  readonly timeZone: string;
  /** Short label used in `text` (`JST`, `PST`, `PT`). */
  readonly label: string;
};

export type EvalValue = Quantity | ZonedTime;

export function isZonedTime(value: EvalValue): value is ZonedTime {
  return "kind" in value && value.kind === "zoned-time";
}

export type Result =
  | { ok: true; value: EvalValue; text: string; alternates?: readonly Alternate[] }
  | { ok: false; reason: Failure };
```

`Quantity` is unchanged: `{ value, unit }`, no `kind`. The type guard is
`"kind" in value`. Export `isZonedTime`.

`Alternate.value` stays `Quantity`. Time queries do not fill `alternates`
in M5 (`in` as inch will not parse against a clock stream).

Do not add `{ kind: "unknown-timezone" }` or `{ kind: "unsupported-conversion" }`
to `Failure`. An unknown place is an unknown word → `not-an-expression`.
Mixing a quantity with a zone (`20 c in Tokyo`, `3pm PST in metres`) is
also `not-an-expression`: the time grammar and the quantity grammar are
separate, and a mixed token stream matches neither. When in doubt, return
nothing (`plan.md` §5.1).

Programmatic `quantity` / `convert` / `add` / `sub` / `mul` / `div` / `sqrt`
stay quantity-only. There is no public `zonedTime()` constructor. Tests go
through `evaluate` and through internals `tz.ts`.

### 1.3 Closed, published, locale-biased aliases; abbreviations are not a lookup table

Research §9.3: `IST` is India, Ireland, and Israel; `CST` is US Central,
China, and Cuba. Soulver publishes a short US list and lets Chinese Standard
Time be unreachable by `CST`. We do the same.

**Policy, not ranking.** Do not return `{ kind: "ambiguous" }` for `IST` /
`CST`. Do not put `alternates` on the result. Document the table. The switch
is a more specific alias (`dublin`, `jerusalem`, `beijing`).

Case: timezone aliases follow the existing trie fold (case-insensitive),
unlike `TRY`. `pst` and `PST` both work. Soulver does this; these tokens are
not English-word ISO codes.

Do not register any timezone alias that is already a unit, converter, or
function alias. In particular: `in` is not India, `to` is not Tonga, `as`
is not American Samoa, `m` / `min` / `h` / `s` / `d` / `c` / `k` / `l` /
`t` / `g` / `f` / `mi` / `ms` / `ha` stay SI. `inr` stays rupee. `sg` is
not Singapore (`singapore` is). Two-letter country codes that collide with
converters stay unregistered.

Raw IANA paths (`America/Los_Angeles`) are **not** input. `/` is division.
Aliases only.

Airport codes (IATA) are out. The compilation is licensed; Soulver’s `LAX`
is a later data pass. `la` / `los angeles` cover that city.

Country names that we do include use the **capital’s zone**, and the README
says so (`plan.md` §3.6). `usa` → `America/New_York` (Washington, Eastern).
Wrong for a user in Los Angeles typing `now in usa`, and better than four
options.

The catalog is §4. Adding a row later is data, not a milestone. An absent
alias is `not-an-expression`.

### 1.4 `PST` / `PDT` are fixed offsets; `pacific time` is the zone

Research §9.3 / Soulver: distinguish winter/summer abbreviations from the
named zone, so the user can say which they meant.

| Typed                        | Kind   | Meaning                                      | Label |
| ---------------------------- | ------ | -------------------------------------------- | ----- |
| `PST`                        | offset | always UTC−8                                 | `PST` |
| `PDT`                        | offset | always UTC−7                                 | `PDT` |
| `pacific time`, `PT`         | IANA   | `America/Los_Angeles` (DST-aware)            | `PT`  |
| `tokyo`, `japan`, `JST`      | IANA   | `Asia/Tokyo` (no DST; JST is also +9 offset) | `JST` |
| `IST`, `india`, `kolkata`, … | IANA   | `Asia/Kolkata` (UTC+5:30)                    | `IST` |

`JST` can be stored as IANA `Asia/Tokyo` (Japan does not observe DST; the
offset is always +9). `PST` must **not** be stored as `America/Los_Angeles`:
in July that zone is UTC−7, and the M0 fixture plus §1.7’s summer test
require `3pm PST` to stay UTC−8 year-round.

`CST` is US Central Standard (UTC−6), not China, not Cuba. `china` /
`beijing` / `shanghai` → `Asia/Shanghai`. `IST` is India, not Ireland, not
Israel. `dublin` → `Europe/Dublin`. `jerusalem` / `israel` →
`Asia/Jerusalem`.

Named US zones: `eastern time` / `ET` → `America/New_York`,
`central time` / `CT` → `America/Chicago`,
`mountain time` / `MT` → `America/Denver`,
`alaska time` → `America/Anchorage`,
`hawaii time` → `Pacific/Honolulu`.
`phoenix` / `arizona` → `America/Phoenix` (no DST), not `MST`.

After conversion, `text` uses the **target** row’s label. `3pm PST in Tokyo`
prints `JST`, not `PST`. `3pm PST in PST` prints `PST`.

### 1.5 Clock times: `3:00` is 03:00; `3pm` needs a source zone

Research §9.4. Soulver’s default is `.literal24Hour`: `3:00` means 03:00.
The daytime-preferring mode is a documented switch. We take the same
default and expose the switch:

```ts
ambiguousClock?: "literal24" | "preferDaytime"; // default "literal24"
```

`preferDaytime`: hours 1–6 without `am`/`pm` are PM; hours 7–11 are AM;
0 and 12–23 are unambiguous. Knock-on (`11:00 to 3:00` as duration) is
out of scope — M5 does not subtract clocks.

**Meridiem.** `am` / `pm` / `AM` / `PM`, optional space (`3 pm`), optional
dots folded in normalize (`3 p.m.` → `3 pm`). `12am` is 00:00. `12pm` is
12:00. `13pm`, `0pm`, `15:00pm` are not clocks → the scan fails, tokens
fall through, leftover → `not-an-expression`.

**Shape.** Hour 0–23, minute 0–59, optional second 0–59. `24:00` is
invalid. One or two hour digits. Minutes (and seconds, if present) are
exactly two digits after `:`. No spaces around `:`. `3:00` is a clock;
`3 : 00` is not.

**A clock without a zone is not an expression.** `3pm` and `3:00` alone
refuse. Silent “local zone” is the ambient-clock bug `now` was designed to
prevent. The source zone is a token the user wrote. `now in Tokyo` is the
escape hatch for “current instant, display there.”

Bare `now` (no converter, no zone) is also `not-an-expression`. We do not
guess a display zone from the runtime.

### 1.6 Pin “today” from injected `now`, in the source zone

`3pm PST` has no date. Take `now()`, convert that instant to a calendar
date **in the source zone**, and place the clock on that date.

`REFERENCE_INSTANT` is 04:30 UTC on 2013-02-12, which is still 20:30 PST
on **2013-02-11**. Time fixtures should set `now` explicitly so the source
date is obvious (see §8). Do not change `REFERENCE_INSTANT`; it is the
Duckling anchor for everything else.

`now in Tokyo` ignores clocks and formats the injected instant in the
target zone. It does not fetch. It does not read `Date.now` in tests.

Default instance:

```ts
now: config.now ?? (() => ({ epochMilliseconds: Date.now() }));
```

Wire it. Today the field is stored nowhere.

### 1.7 DST: Temporal `compatible`; confirmed 2026 dates

`plan.md` asked for `ZonedDateTime` `disambiguation` / `offset` semantics,
and for real 2026 transition dates.

**`disambiguation`** (when a local wall time maps to zero or two instants):

| Value        | Gap (spring-forward)     | Overlap (fall-back) |
| ------------ | ------------------------ | ------------------- |
| `earlier`    | shift back by the gap    | first occurrence    |
| `later`      | shift forward by the gap | second occurrence   |
| `compatible` | same as `later`          | same as `earlier`   |
| `reject`     | throw                    | throw               |

Default in Temporal is `compatible` — the same as legacy `Date`. M5
implements **`compatible`** and does not expose a switch. We do not throw
from the public API; `reject` would become a new `Failure` and a surprise
on a keystroke. Document the choice. A later config bit can wrap the
engine.

**`offset`** (`use` / `ignore` / `prefer` / `reject`) applies when an
ISO string carries both a numeric offset and an IANA id that disagree. We
do not parse those strings. N/A. If a Temporal backend is plugged in
later, `ZonedDateTime.from` should keep its default (`reject` on from,
`prefer` on `with`); our wall-clock constructor has no offset field.

**2026 dates, confirmed** (US Energy Policy Act schedule; EU last-Sunday
rule; Japan has no DST):

| Region            | Clocks forward                   | Clocks back                      |
| ----------------- | -------------------------------- | -------------------------------- |
| US/Canada Pacific | 2026-03-08 02:00 PST → 03:00 PDT | 2026-11-01 02:00 PDT → 01:00 PST |
| EU / UK           | 2026-03-29                       | 2026-10-25                       |
| Japan             | none                             | none                             |

US Pacific spring gap: `02:30` on 2026-03-08 does not exist in
`America/Los_Angeles`. `compatible` → `later` → 03:30 PDT.

US Pacific fall overlap: `01:30` on 2026-11-01 exists twice.
`compatible` → `earlier` → 01:30 PDT (UTC−7).

India `+05:30` and Nepal `+05:45` are year-round. Include `kathmandu` so
a non-hour IANA offset is tested, not just generated `UTC+5:45`.

Do not hard-code 2026 dates in the engine. They exist only as fixture
`now` values. The engine asks `Intl`.

### 1.8 Format is 12-hour, label, date on rollover

The M0 placeholder `8:00 JST` is not the spec. M3/M4 replaced placeholders
when they knew the string. M5 does too.

```
h:mm AM|PM LABEL
h:mm:ss AM|PM LABEL          when seconds ≠ 0
h:mm AM|PM LABEL, Mon D      when target calendar date ≠ source calendar date
h:mm AM|PM LABEL, Mon D, YYYY  when the year also differs
```

- Hour in 12-hour clock, no leading zero (`8:00 AM`, not `08:00 AM`).
- `00:00` → `12:00 AM`. `12:00` → `12:00 PM`.
- Minutes always two digits. `AM` / `PM` ASCII uppercase (matches M3’s
  Latin numerals, not Soulver’s lowercase).
- `LABEL` is the target row’s label (`JST`, `PST`, `PT`).
- Month is English short (`Jan` … `Dec`). Day is numeric, no ordinal.
- No grouping, no locale numerals, no `Intl` `style: "unit"`.
- Compact does not apply.

Worked, with `now = 2026-01-15T18:00:00.000Z` (10:00 AM PST that day):

| Input                         | Target wall      | `text`                |
| ----------------------------- | ---------------- | --------------------- |
| `3pm PST in Tokyo`            | 08:00 Jan 16 JST | `8:00 AM JST, Jan 16` |
| `3pm PST in PST`              | 15:00 Jan 15 PST | `3:00 PM PST`         |
| `now in Tokyo`                | 03:00 Jan 16 JST | `3:00 AM JST, Jan 16` |
| `3pm PDT in Tokyo` (same now) | 07:00 Jan 16 JST | `7:00 AM JST, Jan 16` |

January is winter, so `PDT` is a literal UTC−7 even though Pacific is on
PST. That is the feature.

Hoist `Intl.DateTimeFormat` instances per IANA id on the `Subscript`
closure (same reason as M3 number formatters). Offset zones do not need
`Intl` to format.

### 1.9 Three query shapes; clocks do not mix with Pratt

M2 grammar stays for quantities. Time is a separate, closed pattern on
the whole token stream:

```
time-query := clock timezone (converter timezone)?
            | now converter timezone

clock      := <clock token>          # 3pm, 3:00, 3:00:00pm, 15:00
timezone   := <timezone token>       # catalog or GMT/UTC offset
converter  := "to" | "in" | "as" | "→"
now        := "now"
```

If the stream matches, parse a time AST and stop. If it does not, existing
`parse()`. A timezone or clock token inside a quantity expression is not
a unit; the quantity parse fails; `not-an-expression`.

No `time in Paris` sugar (that is `now in Paris` plus an extra keyword
that would steal the English word `time`). No postfix `Tokyo time`. No
`3pm in Tokyo` without a source zone. No `PST` alone. No inverted
`Tokyo in 3pm PST`. No clock arithmetic (`3pm PST + 2 hours`). No
duration-between (`time difference between A and B`).

`in` ranking is unchanged. `3pm PST in Tokyo` has no inch reading that
parses.

UTC offsets, generated at lex time, not stored as hundreds of alias rows:

```
offset := ("utc" | "gmt") (("+" | "-") hour (":" minute)?)?
        | "z"
```

`UTC`, `GMT`, `Z` → `utc-0000`. `GMT+8`, `UTC+08:00`, `UTC-5:30` allowed.
`+8` alone is not a zone. Hour 0–14, minutes `00` / `30` / `45` only
(matches every civil offset in use). Label is `UTC+8` / `UTC-5:30` /
`UTC`.

### 1.10 Time evaluation is synchronous I/O-wise; `now` is the only injection

No network. `spans` still does not call `now` in a way that must be
stable — coloring does not need an instant — but `evaluate` does.
`create.ts` passes `{ trie, format, fetch, now }` into the pipeline.
Quantity paths ignore `now`.

Do not add `timeZone` to `SubscriptConfig` in M5 (that would be a default
source zone, which §1.5 refused). `ambiguousClock` is the only new option
besides wiring `now`.

---

## 2. Target layout

```
packages/subscript/src/
  types.ts                 # ZonedTime, EvalValue, isZonedTime
  create.ts                # wire now; ambiguousClock; pass into pipeline
  pipeline.ts              # time AST eval; Formatter(EvalValue)
  parse.ts                 # time-query before quantity parse
  token.ts                 # clock, timezone, now tokens; time AST nodes
  lex.ts                   # readClock, readOffsetZone, now/timezone from trie
  normalize.ts             # a.m. / p.m. → am / pm
  format.ts                # zoned-time path
  tz.ts                    # Intl engine + offset math
  zones/table.ts           # closed catalog (offset + IANA rows)
  zones/aliases.ts         # phrases → catalog id
  units/trie.ts            # insert timezone + now; new TrieValue kind
  …

packages/subscript/test/
  tz.test.ts               # engine: offset math, IANA round-trip, DST fixtures
  zones.test.ts            # catalog: unique ids, IANA in supportedValuesOf
  lex.test.ts              # 3pm, 3:00 pm, 15:00, GMT+8, 25:00 is not a clock
  parse / rewrite tests    # time-query AST; quantity parse unchanged
  format.test.ts           # 8:00 AM JST, rollover date, seconds
  fixtures/accept.ts       # drop todo on pst-in-tokyo; add rows in §8
  fixtures/types.ts        # zoned expect branch
  fixtures.test.ts         # assert zoned fields; now already injected
  api.test.ts              # isZonedTime; spans timezone kind
  spans.test.ts            # 3pm PST in Tokyo
```

Zero runtime dependencies. No `temporal-polyfill`. No `tzdata` file. No
GeoNames dump. No CLDR `windowsZones.xml`.

---

## 3. Config and types

```ts
export type SubscriptConfig = {
  locale?: string;
  compact?: boolean;
  now?: NowFn;
  fetch?: typeof globalThis.fetch;
  /** Default `"literal24"`: `3:00` is 03:00. See §1.5. */
  ambiguousClock?: "literal24" | "preferDaytime";
};
```

`create.ts` closes over `{ trie, format, fetch, now, ambiguousClock }`.
`lex` needs `ambiguousClock` because `3:00` vs `3:00 PM` is a scan-time
decision for hours 1–11. Pass it into `lex` / `runPipeline`.

```ts
export type Token =
  | (Located & { readonly kind: "number"; readonly value: number })
  | (Located & { readonly kind: "unit"; readonly unitId: string })
  | (Located & { readonly kind: "converter"; readonly converter: ConverterWord })
  | (Located & { readonly kind: "operator"; readonly op: OperatorChar })
  | (Located & { readonly kind: "function"; readonly name: "sqrt" })
  | (Located & {
      readonly kind: "clock";
      readonly hour: number;
      readonly minute: number;
      readonly second: number;
    })
  | (Located & { readonly kind: "timezone"; readonly zoneId: string })
  | (Located & { readonly kind: "now" })
  | (Located & { readonly kind: "unknown" });
```

Hour on a clock token is already 0–23 (meridiem applied at lex).
`ambiguousClock` has already run.

```ts
export type Ast =
  | /* existing quantity nodes */
  | { kind: "now" }
  | { kind: "clock"; hour: number; minute: number; second: number }
  | { kind: "zoned"; inner: Ast; zoneId: string }
  | { kind: "convert-zone"; expr: Ast; toZoneId: string };
```

Do not reuse `convert` / `toId` for zones. `toId` is a unit id;
`Tokyo` is not in `lookupUnit`.

`TrieValue` grows `{ kind: "timezone"; zoneId: string }` and
`{ kind: "now" }`. `merge()` does not combine timezone with unit. If a
future alias collides, the first insert wins and a test in `zones.test.ts`
fails the build — do not silently produce `ambiguous`.

---

## 4. Catalog

`zones/table.ts`: one row per canonical id. Not SI units. Not in `UNITS`.

```ts
export type ZoneKind = "offset" | "iana";

export type ZoneDef = {
  readonly id: string; // kebab, e.g. "pst", "asia-tokyo"
  readonly kind: ZoneKind;
  readonly label: string;
  /** Minutes east of UTC when kind is "offset". */
  readonly offsetMinutes?: number;
  /** IANA name when kind is "iana". */
  readonly iana?: string;
  readonly source: {
    readonly citation: string;
    readonly url?: string;
    readonly notes?: string;
  };
};
```

Offset rows cite “civil offset, not tzdb rules.” IANA rows cite IANA tzdb,
https://www.iana.org/time-zones. City aliases cite the IANA id they
resolve to; they are not a GeoNames extract.

### 4.1 Offset abbreviations (US list + a few more)

| Id     | Offset | Label | Aliases (case-insensitive)             |
| ------ | ------ | ----- | -------------------------------------- |
| `pst`  | −480   | PST   | `pst`                                  |
| `pdt`  | −420   | PDT   | `pdt`                                  |
| `mst`  | −420   | MST   | `mst`                                  |
| `mdt`  | −360   | MDT   | `mdt`                                  |
| `cst`  | −360   | CST   | `cst`                                  |
| `cdt`  | −300   | CDT   | `cdt`                                  |
| `est`  | −300   | EST   | `est`                                  |
| `edt`  | −240   | EDT   | `edt`                                  |
| `akst` | −540   | AKST  | `akst`                                 |
| `akdt` | −480   | AKDT  | `akdt`                                 |
| `hst`  | −600   | HST   | `hst`                                  |
| `bst`  | +60    | BST   | `bst` (British Summer; not Bangladesh) |

`HST` has no `HDT` (Hawaii does not observe DST). There is no `CST-china`.

### 4.2 IANA rows (named zones, cities, countries)

| Id                    | IANA                  | Label | Aliases                                                                       |
| --------------------- | --------------------- | ----- | ----------------------------------------------------------------------------- |
| `america-los-angeles` | `America/Los_Angeles` | PT    | `pacific time`, `pt`, `los angeles`, `la`, `san francisco`, `sf`, `seattle`   |
| `america-denver`      | `America/Denver`      | MT    | `mountain time`, `mt`, `denver`                                               |
| `america-chicago`     | `America/Chicago`     | CT    | `central time`, `ct`, `chicago`                                               |
| `america-new-york`    | `America/New_York`    | ET    | `eastern time`, `et`, `new york`, `nyc`, `usa`, `us`, `united states`         |
| `america-anchorage`   | `America/Anchorage`   | AKT   | `alaska time`, `anchorage`, `alaska`                                          |
| `pacific-honolulu`    | `Pacific/Honolulu`    | HT    | `hawaii time`, `honolulu`, `hawaii`                                           |
| `america-phoenix`     | `America/Phoenix`     | MST   | `phoenix`, `arizona`                                                          |
| `america-toronto`     | `America/Toronto`     | ET    | `toronto`, `ottawa`, `canada`                                                 |
| `america-vancouver`   | `America/Vancouver`   | PT    | `vancouver`                                                                   |
| `america-mexico-city` | `America/Mexico_City` | CT    | `mexico city`, `mexico`                                                       |
| `america-sao-paulo`   | `America/Sao_Paulo`   | BRT   | `sao paulo`, `são paulo`, `brazil`                                            |
| `asia-tokyo`          | `Asia/Tokyo`          | JST   | `tokyo`, `japan`, `jst`                                                       |
| `asia-kolkata`        | `Asia/Kolkata`        | IST   | `ist`, `india`, `kolkata`, `mumbai`, `delhi`, `bangalore`, `bengaluru`, `blr` |
| `asia-shanghai`       | `Asia/Shanghai`       | CST   | `china`, `beijing`, `shanghai`                                                |
| `asia-singapore`      | `Asia/Singapore`      | SGT   | `singapore`                                                                   |
| `asia-hong-kong`      | `Asia/Hong_Kong`      | HKT   | `hong kong`                                                                   |
| `asia-seoul`          | `Asia/Seoul`          | KST   | `seoul`, `korea`, `south korea`                                               |
| `asia-dubai`          | `Asia/Dubai`          | GST   | `dubai`                                                                       |
| `asia-jerusalem`      | `Asia/Jerusalem`      | IST   | `jerusalem`, `israel`                                                         |
| `asia-kathmandu`      | `Asia/Kathmandu`      | NPT   | `kathmandu`, `nepal`                                                          |
| `australia-sydney`    | `Australia/Sydney`    | AET   | `sydney`, `melbourne`, `australia`                                            |
| `pacific-auckland`    | `Pacific/Auckland`    | NZT   | `auckland`, `new zealand`                                                     |
| `europe-london`       | `Europe/London`       | GMT   | `london`, `uk`, `britain`, `england`, `united kingdom`, `british time`        |
| `europe-paris`        | `Europe/Paris`        | CET   | `paris`, `france`                                                             |
| `europe-berlin`       | `Europe/Berlin`       | CET   | `berlin`, `germany`                                                           |
| `europe-dublin`       | `Europe/Dublin`       | IST   | `dublin`, `ireland`                                                           |
| `europe-rome`         | `Europe/Rome`         | CET   | `rome`, `italy`                                                               |
| `europe-moscow`       | `Europe/Moscow`       | MSK   | `moscow`                                                                      |
| `africa-cairo`        | `Africa/Cairo`        | EET   | `cairo`, `egypt`                                                              |
| `africa-johannesburg` | `Africa/Johannesburg` | SAST  | `johannesburg`, `south africa`                                                |

Notes that belong in the README, not in code comments only:

- `CST` the **abbreviation** is US Central Standard (offset table). China
  is `china` / `beijing`. Both may print `CST` as a label; they are
  different ids.
- `IST` the **abbreviation** is India. Ireland is `dublin`. Israel is
  `jerusalem`. Labels may collide; ids do not.
- `usa` is Eastern, capital rule.
- `la` is Los Angeles, not Latin America.
- `pt` / `ct` / `et` / `mt` are named US zones, not SI.
- `melbourne` shares `Australia/Sydney`. Wrong for a few weeks a year if
  Victoria and NSW ever diverge; documented.

`JST` is both an alias of `asia-tokyo` and effectively UTC+9. Store it as
IANA so `now in JST` uses the same path as `now in Tokyo`.

Every `iana` value must appear in `Intl.supportedValuesOf("timeZone")` on
Node 24 in `zones.test.ts`. If a name is missing, we picked a bad id.

Generated `utc±…` tokens are not catalog rows. `lookupZone("utc-0800")`
synthesizes `{ kind: "offset", offsetMinutes: -480, label: "UTC-8" }`.

---

## 5. Time engine (`tz.ts`)

### 5.1 Offset path

`zone.kind === "offset"`: §1.1 arithmetic. No `Intl`. No DST. `wall` /
`instant` are exact.

### 5.2 IANA path

`wall(epochMs, iana)`:

```ts
new Intl.DateTimeFormat("en-US", {
  timeZone: iana,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  numberingSystem: "latn",
}).formatToParts(new Date(epochMs));
```

Read parts. Map `month` as numeric 1–12. This is formatting, not
arithmetic; it is what `Intl` is good at.

`instant(wall, iana)`: binary search (or offset-guess + verify) on
`epochMs` until `wall(epochMs, iana)` equals the requested wall, then
apply `compatible` if zero or two solutions exist in a ±26h window.

Sketch that is enough to implement:

1. Guess `Date.UTC(...)` as if the wall were UTC.
2. Read `wall(guess, iana)` and take
   `guess -= (got - wanted)` in milliseconds.
3. Repeat a few times (offsets are small; this converges).
4. Probe `guess` and `guess ± 1h` (and `±30m` / `±45m` for fractional
   zones). Collect instants whose `wall` matches.
5. 1 hit → that instant. 2 hits → `earlier` (min epoch) because this is
   an overlap. 0 hits → gap: use `later` by taking the first instant after
   the gap whose local time is `wanted + gap` (Temporal `later`: shift
   forward by the gap duration). Implementing `later` on a gap: search
   forward 1h from the pre-transition offset guess.

Cap iterations. If it will not converge, return a failure that evaluate
turns into `not-an-expression` (do not throw, do not hang). Fuzz the
search.

Do not use `Date#toLocaleString` string parsing. Parts only.

Cache `Intl.DateTimeFormat` per `iana` on the engine object the instance
owns.

### 5.3 Resolve a zone id

```ts
export function lookupZone(id: string): ZoneDef | OffsetZone | undefined;
export function toZonedTime(wall: Wall, zone: ZoneDef | OffsetZone, engine: TzEngine): ZonedTime;
export function toWall(zoned: ZonedTime, engine: TzEngine): Wall;
```

`ZonedTime.timeZone` is the catalog id (`pst`, `asia-tokyo`) or a
synthetic offset id (`utc-0530`). `label` is copied from the **zone we
are displaying**, which is the target after a convert.

---

## 6. Lexer, rewrite, parse

### 6.1 Normalize

Add ASCII folds before lex, as whole-token replacements on the already
NFC’d string, not character-by-character (dots are more than one char):

- `a.m.` / `A.M.` → `am`
- `p.m.` / `P.M.` → `pm`

Keep the existing single-character map. If a simple global replace is
uglier than a small scan, a scan is fine; tests lock `3 p.m. PST`.

### 6.2 `readClock`

In `lex.ts`, **before** `readNumber` (so `3:00` is not `3` + unknown `:`

- `00`):

1. Read 1–2 digits as hour (0–23).
2. If next is `:` and two digits of minutes follow, consume minutes;
   optional `:` + two digits of seconds. If `:` is present but minutes
   are not two digits, this is not a clock (leave it for `readNumber`).
3. Optional whitespace, then `am` / `pm` (folded, word boundary).
4. Apply meridiem and `ambiguousClock`. If the combination is illegal,
   treat as not a clock (do not consume).
5. If we have neither `:` nor meridiem, this is not a clock — `3 km`
   must still be number + kilometre.

`3pm` (no colon, has meridiem) is a clock. `3:00` (colon, no meridiem)
is a clock. `3` is a number.

`1e3` still goes through `readNumber` because after `1` the next char is
`e`, not `:` or `am`/`pm`.

### 6.3 Timezone and `now`

Trie inserts from `zones/aliases.ts` plus `now`. Longest-match already
handles `pacific time` and `san francisco` the way it handles
`nautical mile`.

After a trie miss (or after matching `gmt` / `utc` as a prefix),
`readOffsetZone` tries `gmt`/`utc`/`z` plus an optional signed offset.
A lone `gmt` match from the trie is enough for UTC+0; `GMT+8` must be
consumed as **one** timezone token so `+` is not subtraction.

Do not put `now` in the unit table.

### 6.4 Rewrite

No new fusion. Clock tokens already include meridiem. `$100` swap is
unchanged. `5 ft 11 in` is unchanged.

### 6.5 Parse

```ts
export function parse(tokens: readonly Token[]): ParseResult {
  const time = parseTimeQuery(tokens);
  if (time !== undefined) {
    return time;
  }
  return parseQuantityQuery(tokens); // today's parse()
}
```

`parseTimeQuery` returns `undefined` when the stream is not exactly one
of the three shapes (so quantity parse may still succeed). It returns
`{ ok: false }` when the stream looks like a time query but is malformed
(`3pm PST in` with no target) — that should still be `not-an-expression`,
which `{ ok: false }` already is.

`3pm PST in Tokyo` →

```
{ kind: "convert-zone",
  expr: { kind: "zoned", inner: { kind: "clock", hour: 15, minute: 0, second: 0 }, zoneId: "pst" },
  toZoneId: "asia-tokyo" }
```

`now in Tokyo` → `{ kind: "convert-zone", expr: { kind: "now" }, toZoneId: "asia-tokyo" }`.

Quantity `parse()` must reject streams that contain `clock` / `timezone` /
`now` tokens (they are not `unknown`, so today’s `tokens.some(unknown)`
would not catch them). If `parseTimeQuery` returned `undefined`, treat
those kinds like unknown: `not-an-expression`.

---

## 7. Evaluate, format, spans

### 7.1 `evaluateAst`

New cases. `now` reads the injected `NowFn` once per `evaluate` call
(pass `Instant` into `evaluateAst`, do not call `now()` per node).

```
zoned(clock, zone) →
  wall = { sourceDate(now, zone), clock.hour, … }
  toZonedTime(wall, zone)

zoned(now, zone) is not a grammar shape; now always converts

convert-zone(expr, toZone) →
  inner = evaluate time expr to ZonedTime (same epoch)
  retarget label + timeZone to toZone; wall is inner.epoch in toZone
```

`now in Tokyo`: inner is the injected instant; target zone formats it.
There is no source zone token.

If `evaluateAst` sees `convert` (unit) wrapping a zoned value, or
`convert-zone` wrapping a `Quantity`, return `not-an-expression`. Do not
call Frankfurter.

Binary ops on `ZonedTime` → `not-an-expression`. Unary minus on a clock
→ `not-an-expression`.

Quantity `evaluateAst` is unchanged.

### 7.2 Format

`Formatter` becomes `(value: EvalValue) => string`. Quantity path
unchanged. Zoned path: §1.8. Need the **source** calendar date to decide
rollover: pass it on `ZonedTime` or compute from epoch+source zone.

Keep a `sourceYear` / `sourceMonth` / `sourceDay` on `ZonedTime` (the
date we pinned in the source zone; for `now in Tokyo`, source date is
the wall date in the **target**, so rollover is off — `now` is one
instant, one wall in the target, never “rolled”). Cleaner:

- Clock conversions: set `sourceWall` on the value from the source zone.
- `now in zone`: `sourceWall === targetWall` by construction; no date
  suffix.

### 7.3 Spans

| Token     | `SpanKind`  |
| --------- | ----------- |
| clock     | `number`    |
| now       | `number`    |
| timezone  | `timezone`  |
| converter | `converter` |

No new `SpanKind`. `3pm PST in Tokyo` → number, timezone, converter,
timezone. Sort still start-then-end. `spans` does not call `now` and
does not fetch.

`send this to john in accounting` still has leftover unknown words;
still `[]` on failure.

---

## 8. Tests

### 8.1 Fixture `now`

Do **not** use `REFERENCE_INSTANT` for time accepts: it is 04:30 UTC,
which is the previous calendar date in PST. Set `now` on each time row.

Winter (no US DST): `Date.UTC(2026, 0, 15, 18, 0, 0)` → 2026-01-15
18:00 UTC = 10:00 AM PST = 03:00 AM JST on Jan 16.

Summer (US PDT): `Date.UTC(2026, 6, 15, 18, 0, 0)` → 2026-07-15 18:00 UTC
= 11:00 AM PDT.

DST spring: `Date.UTC(2026, 2, 8, 10, 0, 0)` is 02:00 PST / 10:00 UTC,
exactly the US Pacific spring-forward instant. For a `2:30 AM pacific
time` fixture, pin `now` to `Date.UTC(2026, 2, 8, 9, 0, 0)` (01:00 PST)
so the source date is March 8.

### 8.2 Accept — drop `todo` on `pst-in-tokyo`; add

Extend `Fixture["expect"]`:

```ts
| {
    ok: true;
    text: string;
    unitId: string;
    value: number;
    eps?: number;
  }
| {
    ok: true;
    text: string;
    zoned: { timeZone: string; label: string; hour: number; minute: number };
  }
| { ok: false; reason: Failure["kind"] };
```

Harness: if `zoned` is present, `isZonedTime(result.value)`, compare
fields and `text`. Do not compare `unitId`.

| `name`                | `input` / `now`                                      | Expect                                                 |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `pst-in-tokyo`        | `3pm PST in Tokyo`, winter now                       | `8:00 AM JST, Jan 16`, zone `asia-tokyo`, 8:00         |
| `pst-identity`        | `3pm PST in PST`, winter                             | `3:00 PM PST`, no date                                 |
| `now-in-tokyo`        | `now in Tokyo`, winter                               | `3:00 AM JST, Jan 16`                                  |
| `pdt-in-tokyo-winter` | `3pm PDT in Tokyo`, winter                           | `7:00 AM JST, Jan 16` (literal −7)                     |
| `pt-in-tokyo-summer`  | `3pm pacific time in Tokyo`, summer now              | PDT path: `7:00 AM JST, Jul 16`                        |
| `pst-in-tokyo-summer` | `3pm PST in Tokyo`, summer now                       | still `8:00 AM JST, Jul 16`                            |
| `ist-india`           | `3pm IST in UTC`, winter                             | IST is Kolkata, `UTC+5:30`                             |
| `utc-offset`          | `3pm GMT+9 in Tokyo`, winter                         | same wall as JST, `3:00 PM JST`                        |
| `literal-3-colon`     | `3:00 PST in PST`                                    | `3:00 AM PST` (`literal24`)                            |
| `three-pm-space`      | `3 pm PST in PST`                                    | `3:00 PM PST`                                          |
| `prefer-daytime`      | `3:00 PST in PST`, `ambiguousClock: "preferDaytime"` | `3:00 PM PST` (instance test, not the default harness) |

`prefer-daytime` is an `api.test.ts` / dedicated case: the fixture loop
does not pass `ambiguousClock` today; add an optional field or keep it
out of the table harness.

Drop `unitId: "1"` / `value: 0` on `pst-in-tokyo`.

### 8.3 Reject — add

| `name`            | `input`                            | Why                           |
| ----------------- | ---------------------------------- | ----------------------------- |
| `bare-3pm`        | `3pm`                              | clock without a zone          |
| `bare-now`        | `now`                              | now without a target          |
| `pm-without-hour` | `pm PST`                           | not a clock                   |
| `clock-in-tokyo`  | `3pm in Tokyo`                     | source zone required          |
| `invalid-hour`    | `25:00 PST in Tokyo`               | not a clock                   |
| `cst-means-china` | `3pm China Standard`               | not an alias (prose)          |
| `iana-path`       | `3pm America/Los_Angeles in Tokyo` | `/` is division; not an alias |
| `time-in-paris`   | `time in Paris`                    | no `time` keyword             |
| `clock-plus-hour` | `3pm PST + 2 hours`                | no clock arithmetic           |

`send-to-john` and `question` stay `not-an-expression`. `in` inside prose
must not start matching `india`.

### 8.4 Engine tests (`tz.test.ts`)

- `PST` 15:00 on 2026-01-15 → epoch `Date.UTC(2026, 0, 15, 23, 0, 0)`.
- Round-trip IANA: wall → instant → wall for `Asia/Tokyo` and
  `America/Los_Angeles` on a winter date and a summer date.
- Gap: `2026-03-08 02:30` `America/Los_Angeles` → 03:30 PDT that day.
- Overlap: `2026-11-01 01:30` `America/Los_Angeles` → earlier (PDT).
- `Asia/Kolkata` 12:00 → UTC 06:30 same day.
- `Asia/Kathmandu` 12:00 → UTC 06:15 same day.
- Invalid IANA string does not throw out of `evaluate`.

### 8.5 Spans / lex

`spans("3pm PST in Tokyo")`:

```
number      3pm
timezone    PST
converter   in
timezone    Tokyo
```

`3:00 pm` is one clock token (one `number` span covering the whole
lexeme, including the space before `pm` if we consumed it). If that
space-including span feels wrong, drop empty/whitespace-only — but the
clock token should cover `3:00 pm` as one lexeme so `pm` is not
`unknown`.

`lex`: `2.5k` unchanged (kelvin). `1:30` is a clock, not a number.
`1e3` still a number.

### 8.6 Unchanged

Fuzz (no throw, well-formed `Result`, 5s budget — the IANA search must
not blow this). Bench inputs stay the three quantity queries. Reject
corpus. Currency stub still injected; time rows set `noFetch: true`.

---

## 9. Implementation order

Each step leaves `npm test` and `npm run typecheck` green.

1. `types.ts`: `ZonedTime`, `EvalValue`, `isZonedTime`. Widen `Result` and
   `Formatter`. Quantity tests still pass (`kind` absent). Fixture harness
   accepts either expect branch.
2. `tz.ts` + `tz.test.ts`. Offset math and IANA round-trip against
   `Intl`. No parser yet.
3. `zones/table.ts` + `zones/aliases.ts` + tests (unique aliases, no
   collision with `UNIT_ALIASES` / converters / `sqrt` / `now`, every
   IANA id in `supportedValuesOf`).
4. Trie inserts timezone + `now`. `lex`: `readClock`, `readOffsetZone`,
   normalize `a.m.`/`p.m.`. Lex tests. `evaluate("3pm")` still
   `not-an-expression`.
5. `parseTimeQuery` + time AST. `parse("3pm PST in Tokyo")` yields
   `convert-zone`. Quantity parses unchanged.
6. Wire `now` / `ambiguousClock` in `create.ts`. `evaluateAst` time
   cases. `format.ts` zoned path. `pst-in-tokyo` succeeds.
7. Spans. `api.test.ts` timezone coloring.
8. Fixtures §8.2–8.3. DST engine tests. `noFetch` on time rows.
9. README: alias tables (§4), `PST` vs `pacific time`, `3:00` default,
   `now in Tokyo`, capital-city rule, `IST`/`CST` policy, “not tradeable
   / not tzdata we ship.” Keep `20 c to f` and `100 usd in eur` true.
10. Append the M5 entry to `docs/history.md`.

No LICENSE, no package rename, no `apps/web` restyle, no Temporal, no
Redis, no comment words, no airports, no date literals.

---

## 10. Done when

- `npm test` and `npm run typecheck` are green. Zero calls to
  `api.frankfurter.dev`.
- `await evaluate("3pm PST in Tokyo")` with winter fixture `now` is
  `{ ok: true, text: "8:00 AM JST, Jan 16", value: ZonedTime }` with
  `timeZone: "asia-tokyo"`, `label: "JST"`, hour 8.
- `3pm PST in Tokyo` in **July** is still 08:00 JST. `3pm pacific time
in Tokyo` in July is 07:00 JST.
- `3pm` and `now` alone are `not-an-expression`.
- `3:00 PST in PST` is `3:00 AM PST`. `createSubscript({ ambiguousClock:
"preferDaytime" })` makes it `3:00 PM PST`.
- `now in Tokyo` uses injected `now`, not `Date.now`, and does not fetch.
- `CST` is US Central Standard. `3pm beijing in utc` works; `CST` does
  not mean Beijing.
- `IST` is India. `dublin` is Ireland.
- `spans("3pm PST in Tokyo")` uses `timezone` for `PST` and `Tokyo`,
  does not fetch, does not call a wall-clock engine that can hang.
- `evaluate("20 c to f")` and `evaluate("100 usd in eur")` unchanged.
- `20 c in Tokyo` and `3pm PST in metres` are `not-an-expression`.
- Every pre-existing reject fixture is still `not-an-expression`.
- Zero runtime dependencies; no `eval` / `new Function`; no shipped
  tzdata; no `@vvo/tzdb`.
- README publishes the alias list.
- `docs/history.md` has an M5 log entry (value union, Intl engine,
  offset vs IANA, `compatible` DST, closed aliases, `now` wired).

---

## 11. Out of scope

- Temporal (native or polyfill), shipping tzdata, `@vvo/tzdb`, GeoNames,
  CLDR `windowsZones` / `metaZones`, IATA airport lists
- `{ kind: "ambiguous" }` for `IST` / `CST` / DST gaps
- Clock arithmetic, durations, `time difference between`, `add one month`
- Date literals (`August 25 2026`, `today`, `tomorrow` as input)
- `time in Paris`, `Tokyo time`, bare `now`, clock without a source zone
- Default `timeZone` on `SubscriptConfig`
- Raw IANA paths as input
- Historical tz (what offset was this zone on date D) as a user-facing
  feature beyond “`now` is this instant”
- 24-hour **output**, locale calendar, non-Gregorian, ISO week numbers
- `apps/web` layout / branding (the JSON dump will start showing
  `zoned-time` values without UI work)
- LICENSE, npm rename, CI, executable-markdown runner
- Comment-word tolerance, inverted conversion, `km m`, historical FX,
  crypto, Redis
- Mixing money and time (`$30 × 4 days` stays `unknown-unit`)

If it is not in §9, it is not M5.

---

## 12. After M5

There is no M6 in `plan.md`. The package milestones are done when this
one’s “Done when” is true.

Still later, and already named:

- **`apps/web`** — demo the four domains; not a library milestone.
- **Continuous** — executable README examples, fuzz corpus growth,
  differential testing against a published version (`plan.md` §4).
- **Explicitly not now** — comment words, historical rates, non-English
  input, logarithmic units, variables, a VM.
- **LICENSE file, npm name, publish** — M0 deferred these on purpose.

Do not reverse, after this ships: Frankfurter-as-default, async
`evaluate`, identity-does-not-fetch, last-wins mixed currency, `$`
locale table, uppercase-only ISO words, `pound` is mass, six sig figs
for SI, compact `G` vs money `B`, Intl money, **time is not a Quantity**,
**PST is an offset**, **Intl not Temporal**, **aliases are a published
closed list**.
