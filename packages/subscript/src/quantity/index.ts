import { isZonedTime, type Quantity, type Result } from "../types.ts";
import type { UnitDef } from "../units/kinds.ts";
import { findResultUnit, lookupUnit, toPublic } from "../units/lookup.ts";
import { DIMENSIONLESS } from "../units/table.ts";
import {
  dimensionsEqual,
  divDimensions,
  isDimensionless,
  mulDimensions,
  rational,
  scaleDimension,
  type Dimension,
} from "./dimension.ts";
import { formatQuantity } from "./format.ts";
import * as numeric from "./numeric.ts";

/**
 * Dimensional arithmetic: add, convert, mul, and friends.
 *
 * No parsing. A Quantity is a number plus a unit; operations go through SI
 * and refuse dimension mismatches rather than guessing.
 */

const HALF = rational(1, 2);

function precisionLoss(): Result {
  return { ok: false, reason: { kind: "precision-loss" } };
}

function unknownUnit(token: string): Result {
  return { ok: false, reason: { kind: "unknown-unit", token } };
}

function mismatch(from: UnitDef, to: UnitDef): Result {
  return {
    ok: false,
    reason: { kind: "dimension-mismatch", from: toPublic(from), to: toPublic(to) },
  };
}

function ok(value: number, def: UnitDef): Result {
  if (!numeric.isFiniteNumber(value)) {
    return precisionLoss();
  }
  return { ok: true, value: { value, unit: toPublic(def) }, text: "" };
}

/** Public helpers format here. The pipeline formats eval results once, later. */
function withText(result: Result): Result {
  if (!result.ok || isZonedTime(result.value)) {
    return result;
  }
  return { ...result, text: formatQuantity(result.value) };
}

function fromOutcome(outcome: numeric.NumericOutcome, def: UnitDef): Result {
  return outcome.ok ? ok(outcome.value, def) : precisionLoss();
}

function fromOutcomeSI(outcome: numeric.NumericOutcome, dest: UnitDef): Result {
  return outcome.ok ? ok(fromSI(outcome.value, dest), dest) : precisionLoss();
}

function toSI(value: number, def: UnitDef): number {
  return value * def.scale + def.offset;
}

function fromSI(si: number, def: UnitDef): number {
  return (si - def.offset) / def.scale;
}

/** Runs `compute` once the operand has a known unit and a usable value. */
function withUnit(qty: Quantity, compute: (def: UnitDef) => Result): Result {
  const def = lookupUnit(qty.unit.id);
  if (def === undefined) {
    return unknownUnit(qty.unit.id);
  }
  if (!numeric.isFiniteNumber(qty.value)) {
    return precisionLoss();
  }
  return compute(def);
}

function withUnits(
  a: Quantity,
  b: Quantity,
  compute: (aDef: UnitDef, bDef: UnitDef) => Result,
): Result {
  return withUnit(a, (aDef) => withUnit(b, (bDef) => compute(aDef, bDef)));
}

/**
 * Names the outcome of an operation that changed the dimension. A result is
 * never an absolute temperature, so `token` reports the compound we cannot name.
 */
function derived(si: number, dim: Dimension, scale: number, token: string): Result {
  if (isDimensionless(dim)) {
    return ok(si, DIMENSIONLESS);
  }
  const def = findResultUnit(dim, scale);
  return def === undefined ? unknownUnit(token) : ok(fromSI(si, def), def);
}

function symbolOf(def: UnitDef): string {
  return def.symbol || def.id;
}

function largerUnit(a: UnitDef, b: UnitDef): UnitDef {
  return a.scale >= b.scale ? a : b;
}

function quantityOp(value: number, unitId: string = DIMENSIONLESS.id): Result {
  if (!numeric.isFiniteNumber(value)) {
    return precisionLoss();
  }
  const def = lookupUnit(unitId);
  return def === undefined ? unknownUnit(unitId) : ok(value, def);
}

/**
 * Build a {@link Quantity} from a catalog id (`"metre"`, `"celsius"`).
 * Omit `unitId` for a dimensionless value. Aliases like `"c"` are not ids.
 */
export function quantity(value: number, unitId: string = DIMENSIONLESS.id): Result {
  return withText(quantityOp(value, unitId));
}

/** An absolute temperature and a temperature interval are not the same quantity. */
function convertible(from: UnitDef, to: UnitDef): boolean {
  const absoluteToInterval = from.affine === "absolute" && to.affine === "difference";
  const intervalToAbsolute = from.affine === "difference" && to.affine === "absolute";
  return !absoluteToInterval && !intervalToAbsolute;
}

function convertOp(qty: Quantity, toId: string): Result {
  return withUnit(qty, (from) => {
    const to = lookupUnit(toId);
    if (to === undefined) {
      return unknownUnit(toId);
    }
    if (!dimensionsEqual(from.dimension, to.dimension) || !convertible(from, to)) {
      return mismatch(from, to);
    }
    return ok(fromSI(toSI(qty.value, from), to), to);
  });
}

/**
 * Convert `qty` to another catalog id of the same dimension.
 * Absolute temperatures do not convert to intervals (`celsius` ↛ `delta-celsius`).
 */
export function convert(qty: Quantity, toId: string): Result {
  return withText(convertOp(qty, toId));
}

function addOp(a: Quantity, b: Quantity): Result {
  return withUnits(a, b, (aDef, bDef) => {
    if (isDimensionless(bDef.dimension)) {
      return fromOutcome(numeric.addChecked(a.value, b.value), aDef);
    }
    if (isDimensionless(aDef.dimension)) {
      return fromOutcome(numeric.addChecked(b.value, a.value), bDef);
    }
    if (!dimensionsEqual(aDef.dimension, bDef.dimension)) {
      return mismatch(aDef, bDef);
    }
    if (aDef.affine === "absolute" && bDef.affine === "absolute") {
      return mismatch(aDef, bDef);
    }

    const dest =
      aDef.affine === "absolute"
        ? aDef
        : bDef.affine === "absolute"
          ? bDef
          : largerUnit(aDef, bDef);
    return fromOutcomeSI(numeric.addChecked(toSI(a.value, aDef), toSI(b.value, bDef)), dest);
  });
}

/**
 * Add two quantities. A dimensionless operand assimilates the other unit.
 * Within a dimension the larger unit wins. Two absolute temperatures cannot
 * add; an interval (or kelvin) may add to an absolute.
 */
export function add(a: Quantity, b: Quantity): Result {
  return withText(addOp(a, b));
}

function intervalUnit(def: UnitDef): UnitDef | undefined {
  return def.differenceId === undefined ? undefined : lookupUnit(def.differenceId);
}

function subOp(a: Quantity, b: Quantity): Result {
  return withUnits(a, b, (aDef, bDef) => {
    if (isDimensionless(bDef.dimension)) {
      return fromOutcome(numeric.subChecked(a.value, b.value), aDef);
    }
    if (isDimensionless(aDef.dimension)) {
      return bDef.affine === "absolute"
        ? mismatch(aDef, bDef)
        : fromOutcome(numeric.subChecked(a.value, b.value), bDef);
    }
    if (!dimensionsEqual(aDef.dimension, bDef.dimension)) {
      return mismatch(aDef, bDef);
    }
    if (bDef.affine === "absolute" && aDef.affine !== "absolute") {
      return mismatch(aDef, bDef);
    }

    const dest =
      aDef.affine === "absolute"
        ? bDef.affine === "absolute"
          ? intervalUnit(aDef)
          : aDef
        : largerUnit(aDef, bDef);
    if (dest === undefined) {
      return mismatch(aDef, bDef);
    }
    return fromOutcomeSI(numeric.subChecked(toSI(a.value, aDef), toSI(b.value, bDef)), dest);
  });
}

/**
 * Subtract `b` from `a`. Two absolute temperatures yield the interval unit
 * (`25 °C − 20 °C` → `5 Δ°C`). An interval minus an absolute is a mismatch.
 */
export function sub(a: Quantity, b: Quantity): Result {
  return withText(subOp(a, b));
}

function mulOp(a: Quantity, b: Quantity): Result {
  return withUnits(a, b, (aDef, bDef) => {
    if (aDef.affine === "absolute" || bDef.affine === "absolute") {
      return mismatch(aDef, bDef);
    }
    if (isDimensionless(bDef.dimension)) {
      return ok(a.value * b.value, aDef);
    }
    if (isDimensionless(aDef.dimension)) {
      return ok(a.value * b.value, bDef);
    }
    return derived(
      toSI(a.value, aDef) * toSI(b.value, bDef),
      mulDimensions(aDef.dimension, bDef.dimension),
      aDef.scale * bDef.scale,
      `${symbolOf(aDef)}\u00b7${symbolOf(bDef)}`,
    );
  });
}

/**
 * Multiply two quantities. Absolute temperatures cannot multiply.
 * The result is named only if the catalog has that derived unit (`m × m` → `m²`).
 */
export function mul(a: Quantity, b: Quantity): Result {
  return withText(mulOp(a, b));
}

function divOp(a: Quantity, b: Quantity): Result {
  return withUnits(a, b, (aDef, bDef) => {
    if (aDef.affine === "absolute" || bDef.affine === "absolute") {
      return mismatch(aDef, bDef);
    }
    if (isDimensionless(bDef.dimension)) {
      return ok(a.value / b.value, aDef);
    }
    return derived(
      toSI(a.value, aDef) / toSI(b.value, bDef),
      divDimensions(aDef.dimension, bDef.dimension),
      aDef.scale / bDef.scale,
      `${symbolOf(aDef)}/${symbolOf(bDef)}`,
    );
  });
}

/**
 * Divide `a` by `b`. Absolute temperatures cannot divide.
 * The result is named only if the catalog has that derived unit (`m / s` → `m/s`).
 */
export function div(a: Quantity, b: Quantity): Result {
  return withText(divOp(a, b));
}

function sqrtOp(qty: Quantity): Result {
  return withUnit(qty, (def) => {
    if (def.affine === "absolute") {
      return mismatch(def, def);
    }
    return derived(
      Math.sqrt(toSI(qty.value, def)),
      scaleDimension(def.dimension, HALF),
      Math.sqrt(def.scale),
      `\u221a${symbolOf(def)}`,
    );
  });
}

/**
 * Square root of a quantity. Absolute temperatures cannot take a root.
 * The result is named only if the catalog has that derived unit (`√m²` → `m`).
 */
export function sqrt(qty: Quantity): Result {
  return withText(sqrtOp(qty));
}

/** Unformatted ops for the evaluator. The pipeline fills in `text`. */
export const compute = {
  quantity: quantityOp,
  convert: convertOp,
  add: addOp,
  sub: subOp,
  mul: mulOp,
  div: divOp,
  sqrt: sqrtOp,
};
