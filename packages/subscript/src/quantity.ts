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
import type { Quantity, Result } from "./types.ts";
import type { UnitDef } from "./units/kinds.ts";
import { findResultUnit, lookupUnit, toPublic } from "./units/lookup.ts";
import { DIMENSIONLESS } from "./units/table.ts";

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
  const result: Quantity = { value, unit: toPublic(def) };
  return { ok: true, value: result, text: formatQuantity(result) };
}

function fromOutcome(outcome: numeric.NumericOutcome, def: UnitDef): Result {
  return outcome.ok ? ok(outcome.value, def) : precisionLoss();
}

function fromOutcomeSI(outcome: numeric.NumericOutcome, dest: UnitDef): Result {
  return outcome.ok ? ok(fromSI(outcome.value, dest), dest) : precisionLoss();
}

function toSI(value: number, def: UnitDef): number {
  return numeric.add(numeric.mul(value, def.scale), def.offset);
}

function fromSI(si: number, def: UnitDef): number {
  return numeric.div(numeric.sub(si, def.offset), def.scale);
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

export function quantity(value: number, unitId: string = DIMENSIONLESS.id): Result {
  if (!numeric.isFiniteNumber(value)) {
    return precisionLoss();
  }
  const def = lookupUnit(unitId);
  return def === undefined ? unknownUnit(unitId) : ok(value, def);
}

/** An absolute temperature and a temperature interval are not the same quantity. */
function convertible(from: UnitDef, to: UnitDef): boolean {
  const absoluteToInterval = from.affine === "absolute" && to.affine === "difference";
  const intervalToAbsolute = from.affine === "difference" && to.affine === "absolute";
  return !absoluteToInterval && !intervalToAbsolute;
}

export function convert(qty: Quantity, toId: string): Result {
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

export function add(a: Quantity, b: Quantity): Result {
  return withUnits(a, b, (aDef, bDef) => {
    // A bare number takes on the other operand's unit.
    if (isDimensionless(bDef.dimension)) {
      return fromOutcome(numeric.addChecked(a.value, b.value), aDef);
    }
    if (isDimensionless(aDef.dimension)) {
      return fromOutcome(numeric.addChecked(b.value, a.value), bDef);
    }
    if (!dimensionsEqual(aDef.dimension, bDef.dimension)) {
      return mismatch(aDef, bDef);
    }
    // Two absolute temperatures have no sum; one of them must be an interval.
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

function intervalUnit(def: UnitDef): UnitDef | undefined {
  return def.differenceId === undefined ? undefined : lookupUnit(def.differenceId);
}

export function sub(a: Quantity, b: Quantity): Result {
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
    // Subtracting an absolute temperature only makes sense from another one.
    if (bDef.affine === "absolute" && aDef.affine !== "absolute") {
      return mismatch(aDef, bDef);
    }

    // The difference between two absolute temperatures is an interval.
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

export function mul(a: Quantity, b: Quantity): Result {
  return withUnits(a, b, (aDef, bDef) => {
    if (aDef.affine === "absolute" || bDef.affine === "absolute") {
      return mismatch(aDef, bDef);
    }
    // Scaling by a bare number keeps the unit; deriving one would lose the interval.
    if (isDimensionless(bDef.dimension)) {
      return ok(numeric.mul(a.value, b.value), aDef);
    }
    if (isDimensionless(aDef.dimension)) {
      return ok(numeric.mul(a.value, b.value), bDef);
    }
    return derived(
      numeric.mul(toSI(a.value, aDef), toSI(b.value, bDef)),
      mulDimensions(aDef.dimension, bDef.dimension),
      numeric.mul(aDef.scale, bDef.scale),
      `${symbolOf(aDef)}\u00b7${symbolOf(bDef)}`,
    );
  });
}

export function div(a: Quantity, b: Quantity): Result {
  return withUnits(a, b, (aDef, bDef) => {
    if (aDef.affine === "absolute" || bDef.affine === "absolute") {
      return mismatch(aDef, bDef);
    }
    if (isDimensionless(bDef.dimension)) {
      return ok(numeric.div(a.value, b.value), aDef);
    }
    return derived(
      numeric.div(toSI(a.value, aDef), toSI(b.value, bDef)),
      divDimensions(aDef.dimension, bDef.dimension),
      numeric.div(aDef.scale, bDef.scale),
      `${symbolOf(aDef)}/${symbolOf(bDef)}`,
    );
  });
}

export function sqrt(qty: Quantity): Result {
  return withUnit(qty, (def) => {
    if (def.affine === "absolute") {
      return mismatch(def, def);
    }
    return derived(
      numeric.sqrt(toSI(qty.value, def)),
      scaleDimension(def.dimension, HALF),
      numeric.sqrt(def.scale),
      `\u221a${symbolOf(def)}`,
    );
  });
}
