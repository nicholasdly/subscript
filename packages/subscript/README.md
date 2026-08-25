# subscript

Natural-language evaluation of arithmetic, unit conversion, currency, and time
zones.

```ts
import { createSubscript, evaluate, isZonedTime } from "@repo/subscript";

const result = await evaluate("20 c to f");
// { ok: true, value: { value: 68, unit: { id: "fahrenheit", symbol: "°F" } }, text: "68 °F" }

await evaluate("1 m in ft");
// text: "3.28084 ft" — six significant figures, display-only rounding

await evaluate("100 usd in eur");
// quotes Frankfurter v2; money text via Intl

const time = await createSubscript({
  now: () => ({ epochMilliseconds: Date.UTC(2026, 0, 15, 18, 0, 0) }),
}).evaluate("3pm PST in Tokyo");
// text: "8:00 AM JST, Jan 16"
// isZonedTime(time.value) === true
```

`evaluate` is async. Cross-currency conversion calls Frankfurter
(`GET https://api.frankfurter.dev/v2/rate/{BASE}/{QUOTE}`) once per distinct pair
in an expression and multiplies by `data.rate`. Same-currency amounts (`100 usd`,
`$10+$5`) do not fetch. There is no cache and no rate provider to inject; tests
pass `createSubscript({ fetch })`. A later Redis wrapper can sit on `fetch`.
Rates are reference data, not tradeable quotes. SI evaluation still works
offline. Time conversion never fetches.

`$` / `dollar` follow the locale region (`en-CA` → CAD, `en-AU` → AUD, otherwise
USD including `en-GB`). Write `US$` when you mean US dollars in Canada. `TRY` is
the lira; `try` is not a unit. `pound` is mass; sterling is `gbp` / `£` /
`pound sterling`.

Dimensionless results of a thousand or more compact by default
(`100000 + 200000` → `300k`). Money uses `k/M/B/T/P` (`$1B`, not `$1G`). Those
strings are for display: typing `2.5k` is still 2.5 kelvin. Turn it off with
`createSubscript({ compact: false })`.

## Time zones

A successful time query is not a `Quantity`. Check `isZonedTime(result.value)`.
Conversion uses the runtime's `Intl` tzdata; this package does not ship a tz
database and does not use Temporal.

Three shapes:

| Input              | Meaning                                 |
| ------------------ | --------------------------------------- |
| `3pm PST`          | clock on today's date in that zone      |
| `3pm PST in Tokyo` | convert that instant to the target      |
| `now in Tokyo`     | injected `now`, displayed in the target |

A clock without a source zone (`3pm`, `3pm in Tokyo`) is not an expression.
Bare `now` is not an expression either. Tests inject `now`; the default instance
reads `Date.now`.

`3:00` is 03:00 (`literal24`). `createSubscript({ ambiguousClock: "preferDaytime" })`
treats 1:00–6:59 without am/pm as PM.

`PST` / `PDT` / `EST` / … are **fixed offsets** year-round. `pacific time` /
`PT` is `America/Los_Angeles` and follows DST. In July, `3pm PST in Tokyo` is
still 8:00 JST; `3pm pacific time in Tokyo` is 7:00 JST.

`IST` is India. Ireland is `dublin`. Israel is `jerusalem`. `CST` the
abbreviation is US Central Standard. China is `china` / `beijing`. Country names
use the capital's zone (`usa` → Eastern).

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
