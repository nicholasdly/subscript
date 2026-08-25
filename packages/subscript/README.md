# subscript

Natural-language evaluation of arithmetic and unit conversion.

```ts
import { evaluate } from "@repo/subscript";

const result = evaluate("20 c to f");
// { ok: true, value: { value: 68, unit: { id: "fahrenheit", symbol: "°F" } }, text: "68 °F" }
```

Synchronous. No network. No configuration required. Configure locale, clock, or rates with `createSubscript`.
