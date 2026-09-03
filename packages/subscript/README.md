# @nicholasdly/subscript

Evaluate arithmetic, unit conversions, and time zones from natural language.

```ts
import { evaluate } from "@nicholasdly/subscript";

evaluate("20 c to f");
// {
//   ok: true,
//   text: "68 °F",
//   value: { value: 68, unit: { id: "fahrenheit", symbol: "°F" } },
// }
```

Synchronous, no network, no runtime dependencies. Currency conversion is unfortunately out of scope since it would require dynamic data.

## Install

```bash
npm install @nicholasdly/subscript
```

## Usage

```ts
import { createSubscript, evaluate, isZonedTime } from "@nicholasdly/subscript";

evaluate("1 m in ft");
// { ok: true, text: "3.28084 ft", ... }

evaluate("(2 + 3) * 4 km in miles");
// { ok: true, text: "12.4274 mi", ... }

evaluate("100 usd in eur");
// { ok: false, reason: { kind: "not-an-expression" } }

const subscript = createSubscript({
  now: () => ({ epochMilliseconds: Date.UTC(2026, 0, 15, 18, 0, 0) }),
});

const time = subscript.evaluate("3pm PST in Tokyo");
// time.text === "8:00 AM JST, Jan 16"
// isZonedTime(time.value) === true
```

`evaluate` is the default instance: `en-US`, compact output, `Date.now`. Use `createSubscript` for a custom clock, locale, or `spans`.

## API

### `evaluate(input)`

Evaluate a query. Returns a [`Result`](#results).

### `createSubscript(config?)`

Configured evaluator. Same contract as `evaluate`, plus `spans`.

| Option           | Default       | Notes                                                                                                                  |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `locale`         | `"en-US"`     | `en-GB` treats gallon, pint, cup, quart, tablespoon, and fluid ounce as imperial; every other locale treats them as US |
| `compact`        | `true`        | Compact `k` / `M` / `G` on dimensionless `text` of 1000 or more                                                        |
| `now`            | `Date.now`    | Injected clock for `now in Tokyo` and dating `3pm PST`                                                                 |
| `ambiguousClock` | `"literal24"` | `3:00` is 03:00. `"preferDaytime"` treats 1:00–6:59 without am/pm as PM                                                |

Compact suffixes are display-only. `2.5k` as input is 2.5 kelvin. Type `pint` for a pint; `pt` is Pacific Time.

```ts
createSubscript({ compact: false }).evaluate("100000 + 200000");
// { ok: true, text: "300000", ... }
```

### `spans(input)`

Highlight ranges for the original string. Does not evaluate.

```ts
createSubscript().spans("20 c to f");
// [
//   { start: 0, end: 2, kind: "number" },
//   { start: 3, end: 4, kind: "unit" },
//   { start: 5, end: 7, kind: "converter" },
//   { start: 8, end: 9, kind: "unit" },
// ]
```

`kind` is `"number"` | `"unit"` | `"timezone"` | `"operator"` | `"converter"` | `"punctuation"` | `"unknown"`.

## Results

Public functions return a `Result`. Check `ok` before reading `value`. Input errors do not throw.

```ts
type Result =
  | {
      ok: true;
      value: Quantity | ZonedTime;
      text: string;
      alternates?: Alternate[];
    }
  | { ok: false; reason: Failure };
```

`text` is the display string, rounded to six significant figures. Time results are `ZonedTime`; narrow with `isZonedTime(result.value)`.

| `reason.kind`        | When                                                                                |
| -------------------- | ----------------------------------------------------------------------------------- |
| `not-an-expression`  | the string is not a query this package accepts                                      |
| `dimension-mismatch` | the operands cannot combine or convert                                              |
| `unknown-unit`       | a catalog id or derived name cannot be resolved                                     |
| `precision-loss`     | float64 would drop an addend or overflow                                            |
| `limit-exceeded`     | input longer than 256 characters, parse depth over 32, more than 64 AST nodes, or ` | exponent | ` over 1000 |

`alternates` is set when another reading of the same input also succeeds, such as `in` as converter versus inch.

## Quantity

`quantity`, `convert`, `add`, `sub`, `mul`, `div`, and `sqrt` operate on `Quantity` values. They do not parse strings. Catalog ids are SI spellings (`metre`, `celsius`), not aliases (`m`, `c`).

```ts
import { convert, isZonedTime, quantity } from "@nicholasdly/subscript";

const metres = quantity(10, "metre");
// { ok: true, text: "10 m", value: { value: 10, unit: { id: "metre", symbol: "m" } } }

if (metres.ok && !isZonedTime(metres.value)) {
  convert(metres.value, "foot");
  // { ok: true, text: "32.8084 ft", ... }
}
```

A product is named only when the catalog has that unit: `m × m` is `m²`; `kg × L` is `unknown-unit`. Two absolute temperatures cannot add; `20 °C + 5 Δ°C` can.

## Time zones

Time results are `ZonedTime`, not `Quantity`. Zones resolve through the runtime `Intl` database; this package does not ship tzdata.

| Input              | Meaning                                 |
| ------------------ | --------------------------------------- |
| `3pm PST`          | that clock on today's date in that zone |
| `3pm PST in Tokyo` | convert that instant to the target      |
| `now in Tokyo`     | injected `now`, displayed in the target |

A clock needs a source zone. `3pm` and `3pm in Tokyo` fail. Bare `now` fails.

`PST` / `PDT` / `EST` / … are fixed offsets year-round. `pacific time` / `PT` is `America/Los_Angeles` and follows DST. In July, `3pm PST in Tokyo` is 8:00 JST; `3pm pacific time in Tokyo` is 7:00 JST.

`IST` is India. Ireland is `dublin`. Israel is `jerusalem`. Bare `CST` is US Central Standard. China is `china` / `beijing`. Country names use the capital's zone (`usa` → Eastern).

UTC offsets: `UTC`, `GMT`, `Z`, `GMT+8`, `UTC-5:30`.

### Offset abbreviations

| Typed | Offset | Label                                |
| ----- | ------ | ------------------------------------ |
| PST   | UTC−8  | PST                                  |
| PDT   | UTC−7  | PDT                                  |
| MST   | UTC−7  | MST                                  |
| MDT   | UTC−6  | MDT                                  |
| CST   | UTC−6  | CST                                  |
| CDT   | UTC−5  | CDT                                  |
| EST   | UTC−5  | EST                                  |
| EDT   | UTC−4  | EDT                                  |
| AKST  | UTC−9  | AKST                                 |
| AKDT  | UTC−8  | AKDT                                 |
| HST   | UTC−10 | HST                                  |
| BST   | UTC+1  | BST (British Summer, not Bangladesh) |

### Named zones and cities

| Aliases                                                       | Zone                | Label |
| ------------------------------------------------------------- | ------------------- | ----- |
| pacific time, PT, los angeles, la, san francisco, sf, seattle | America/Los_Angeles | PT    |
| mountain time, MT, denver                                     | America/Denver      | MT    |
| central time, CT, chicago                                     | America/Chicago     | CT    |
| eastern time, ET, new york, nyc, usa, us, united states       | America/New_York    | ET    |
| alaska time, anchorage, alaska                                | America/Anchorage   | AKT   |
| hawaii time, honolulu, hawaii                                 | Pacific/Honolulu    | HT    |
| phoenix, arizona                                              | America/Phoenix     | MST   |
| toronto, ottawa, canada                                       | America/Toronto     | ET    |
| vancouver                                                     | America/Vancouver   | PT    |
| mexico city, mexico                                           | America/Mexico_City | CT    |
| sao paulo, brazil                                             | America/Sao_Paulo   | BRT   |
| tokyo, japan, JST                                             | Asia/Tokyo          | JST   |
| IST, india, kolkata, mumbai, delhi, bangalore, blr            | Asia/Calcutta       | IST   |
| china, beijing, shanghai                                      | Asia/Shanghai       | CST   |
| singapore                                                     | Asia/Singapore      | SGT   |
| hong kong                                                     | Asia/Hong_Kong      | HKT   |
| seoul, korea, south korea                                     | Asia/Seoul          | KST   |
| dubai                                                         | Asia/Dubai          | GST   |
| jerusalem, israel                                             | Asia/Jerusalem      | IST   |
| kathmandu, nepal                                              | Asia/Katmandu       | NPT   |
| sydney, melbourne, australia                                  | Australia/Sydney    | AET   |
| auckland, new zealand                                         | Pacific/Auckland    | NZT   |
| london, uk, britain, england, united kingdom, british time    | Europe/London       | GMT   |
| paris, france                                                 | Europe/Paris        | CET   |
| berlin, germany                                               | Europe/Berlin       | CET   |
| dublin, ireland                                               | Europe/Dublin       | IST   |
| rome, italy                                                   | Europe/Rome         | CET   |
| moscow                                                        | Europe/Moscow       | MSK   |
| cairo, egypt                                                  | Africa/Cairo        | EET   |
| johannesburg, south africa                                    | Africa/Johannesburg | SAST  |

## Internals

Pipeline stages are exported from `@nicholasdly/subscript/internals` and are not covered by semver.

## License

MIT
