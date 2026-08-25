# subscript

Natural-language evaluation of arithmetic and unit conversion.

```ts
import { createSubscript, evaluate } from "@repo/subscript";

const result = evaluate("20 c to f");
// { ok: true, value: { value: 68, unit: { id: "fahrenheit", symbol: "°F" } }, text: "68 °F" }

evaluate("1 m in ft");
// text: "3.28084 ft" — six significant figures, display-only rounding
```

Synchronous. No network. No configuration required. Configure locale, clock, or rates with `createSubscript`.

Dimensionless results of a thousand or more compact by default (`100000 + 200000` → `300k`). That string is for display: typing `2.5k` is still 2.5 kelvin. Turn it off with `createSubscript({ compact: false })`.
