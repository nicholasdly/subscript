/** Default `evaluate(input)`. A thin wrapper over a lazily created instance. */
import { createSubscript, type Subscript } from "./create.ts";
import type { Result } from "./types.ts";

let defaultInstance: Subscript | undefined;

function getDefault(): Subscript {
  defaultInstance ??= createSubscript();
  return defaultInstance;
}

/**
 * Evaluate a natural-language query with the default instance (`en-US`, compact
 * on, `Date.now`). Synchronous. No network. Currency is not an expression.
 *
 * For a fixed clock, locale, or `spans()`, use {@link createSubscript}.
 *
 * @example
 * ```ts
 * evaluate("20 c to f");
 * // { ok: true, text: "68 °F", value: { value: 68, unit: { id: "fahrenheit", symbol: "°F" } } }
 * ```
 */
export function evaluate(input: string): Result {
  return getDefault().evaluate(input);
}
