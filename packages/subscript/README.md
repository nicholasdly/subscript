# subscript

Natural-language evaluation of arithmetic and unit conversion.

```ts
import { createSubscript, evaluate } from "@repo/subscript";

const result = await evaluate("20 c to f");
// { ok: true, value: { value: 68, unit: { id: "fahrenheit", symbol: "°F" } }, text: "68 °F" }

await evaluate("1 m in ft");
// text: "3.28084 ft" — six significant figures, display-only rounding

await evaluate("100 usd in eur");
// quotes Frankfurter v2; money text via Intl
```

`evaluate` is async. Cross-currency conversion calls Frankfurter
(`GET https://api.frankfurter.dev/v2/rate/{BASE}/{QUOTE}`) once per distinct pair
in an expression and multiplies by `data.rate`. Same-currency amounts (`100 usd`,
`$10+$5`) do not fetch. There is no cache and no rate provider to inject; tests
pass `createSubscript({ fetch })`. A later Redis wrapper can sit on `fetch`.
Rates are reference data, not tradeable quotes. SI evaluation still works
offline.

`$` / `dollar` follow the locale region (`en-CA` → CAD, `en-AU` → AUD, otherwise
USD including `en-GB`). Write `US$` when you mean US dollars in Canada. `TRY` is
the lira; `try` is not a unit. `pound` is mass; sterling is `gbp` / `£` /
`pound sterling`.

Dimensionless results of a thousand or more compact by default
(`100000 + 200000` → `300k`). Money uses `k/M/B/T/P` (`$1B`, not `$1G`). Those
strings are for display: typing `2.5k` is still 2.5 kelvin. Turn it off with
`createSubscript({ compact: false })`.
