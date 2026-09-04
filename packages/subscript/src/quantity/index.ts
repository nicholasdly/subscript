import type { Quantity, QuantityResult } from "../types.ts";
import { DIMENSIONLESS } from "../units/table.ts";
import { formatQuantity } from "./format.ts";
import * as ops from "./ops.ts";
import type { Qty } from "./ops.ts";

/**
 * Dimensional arithmetic: add, convert, mul, and friends.
 *
 * No parsing. A Quantity is a number plus a unit; operations go through SI
 * and refuse dimension mismatches rather than guessing. The evaluator imports
 * unformatted ops from `ops.ts`; this module is the public Result boundary.
 */

function toResult(outcome: Qty): QuantityResult {
  if (!outcome.ok) {
    return outcome;
  }
  return { ok: true, value: outcome.value, text: formatQuantity(outcome.value) };
}

/**
 * Build a {@link Quantity} from a catalog id (`"metre"`, `"celsius"`).
 * Omit `unitId` for a dimensionless value. Aliases like `"c"` are not ids.
 */
export function quantity(value: number, unitId: string = DIMENSIONLESS.id): QuantityResult {
  return toResult(ops.quantity(value, unitId));
}

/**
 * Convert `qty` to another catalog id of the same dimension.
 * Absolute temperatures do not convert to intervals (`celsius` ↛ `delta-celsius`).
 */
export function convert(qty: Quantity, toId: string): QuantityResult {
  return toResult(ops.convert(qty, toId));
}

/**
 * Add two quantities. A dimensionless operand assimilates the other unit.
 * Within a dimension the larger unit wins. Two absolute temperatures cannot
 * add; an interval (or kelvin) may add to an absolute.
 */
export function add(a: Quantity, b: Quantity): QuantityResult {
  return toResult(ops.add(a, b));
}

/**
 * Subtract `b` from `a`. Two absolute temperatures yield the interval unit
 * (`25 °C − 20 °C` → `5 Δ°C`). An interval minus an absolute is a mismatch.
 */
export function sub(a: Quantity, b: Quantity): QuantityResult {
  return toResult(ops.sub(a, b));
}

/**
 * Multiply two quantities. Absolute temperatures cannot multiply.
 * The result is named only if the catalog has that derived unit (`m × m` → `m²`).
 */
export function mul(a: Quantity, b: Quantity): QuantityResult {
  return toResult(ops.mul(a, b));
}

/**
 * Divide `a` by `b`. Absolute temperatures cannot divide.
 * The result is named only if the catalog has that derived unit (`m / s` → `m/s`).
 */
export function div(a: Quantity, b: Quantity): QuantityResult {
  return toResult(ops.div(a, b));
}

/**
 * Square root of a quantity. Absolute temperatures cannot take a root.
 * The result is named only if the catalog has that derived unit (`√m²` → `m`).
 */
export function sqrt(qty: Quantity): QuantityResult {
  return toResult(ops.sqrt(qty));
}
