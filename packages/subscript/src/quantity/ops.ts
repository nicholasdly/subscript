import type { Outcome, Quantity } from "../types.ts";
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
import * as numeric from "./numeric.ts";

/**
 * Unformatted dimensional arithmetic. Public helpers in `index.ts` attach
 * `text`; the evaluator uses these functions directly.
 */

const HALF = rational(1, 2);

export type Qty = Outcome<Quantity>;

function precisionLoss(): Qty {
  return { ok: false, reason: { kind: "precision-loss" } };
}

function unknownUnit(token: string): Qty {
  return { ok: false, reason: { kind: "unknown-unit", token } };
}

function mismatch(from: UnitDef, to: UnitDef): Qty {
  return {
    ok: false,
    reason: { kind: "dimension-mismatch", from: toPublic(from), to: toPublic(to) },
  };
}

function ok(value: number, def: UnitDef): Qty {
  if (!numeric.isFiniteNumber(value)) {
    return precisionLoss();
  }
  return { ok: true, value: { value, unit: toPublic(def) } };
}

function fromChecked(outcome: numeric.NumericOutcome, def: UnitDef): Qty {
  return outcome.ok ? ok(outcome.value, def) : precisionLoss();
}

function fromCheckedSI(outcome: numeric.NumericOutcome, dest: UnitDef): Qty {
  return outcome.ok ? ok(fromSI(outcome.value, dest), dest) : precisionLoss();
}

function toSI(value: number, def: UnitDef): number {
  return value * def.scale + def.offset;
}

function fromSI(si: number, def: UnitDef): number {
  return (si - def.offset) / def.scale;
}

function withUnit(qty: Quantity, op: (def: UnitDef) => Qty): Qty {
  const def = lookupUnit(qty.unit.id);
  if (def === undefined) {
    return unknownUnit(qty.unit.id);
  }
  if (!numeric.isFiniteNumber(qty.value)) {
    return precisionLoss();
  }
  return op(def);
}

function withUnits(a: Quantity, b: Quantity, op: (aDef: UnitDef, bDef: UnitDef) => Qty): Qty {
  return withUnit(a, (aDef) => withUnit(b, (bDef) => op(aDef, bDef)));
}

function derived(si: number, dim: Dimension, scale: number, token: string): Qty {
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

function intervalUnit(def: UnitDef): UnitDef | undefined {
  return def.differenceId === undefined ? undefined : lookupUnit(def.differenceId);
}

function addDest(a: UnitDef, b: UnitDef): UnitDef | undefined {
  switch (a.affine) {
    case "absolute":
      switch (b.affine) {
        case "absolute":
          return undefined;
        case "linear":
        case "difference":
          return a;
        default: {
          const _never: never = b.affine;
          return _never;
        }
      }
    case "linear":
    case "difference":
      switch (b.affine) {
        case "absolute":
          return b;
        case "linear":
        case "difference":
          return largerUnit(a, b);
        default: {
          const _never: never = b.affine;
          return _never;
        }
      }
    default: {
      const _never: never = a.affine;
      return _never;
    }
  }
}

function subDest(a: UnitDef, b: UnitDef): UnitDef | undefined {
  switch (a.affine) {
    case "absolute":
      switch (b.affine) {
        case "absolute":
          return intervalUnit(a);
        case "linear":
        case "difference":
          return a;
        default: {
          const _never: never = b.affine;
          return _never;
        }
      }
    case "linear":
    case "difference":
      switch (b.affine) {
        case "absolute":
          return undefined;
        case "linear":
        case "difference":
          return largerUnit(a, b);
        default: {
          const _never: never = b.affine;
          return _never;
        }
      }
    default: {
      const _never: never = a.affine;
      return _never;
    }
  }
}

export function quantity(value: number, unitId: string = DIMENSIONLESS.id): Qty {
  if (!numeric.isFiniteNumber(value)) {
    return precisionLoss();
  }
  const def = lookupUnit(unitId);
  return def === undefined ? unknownUnit(unitId) : ok(value, def);
}

function convertible(from: UnitDef, to: UnitDef): boolean {
  return !(
    (from.affine === "absolute" && to.affine === "difference") ||
    (from.affine === "difference" && to.affine === "absolute")
  );
}

export function convert(qty: Quantity, toId: string): Qty {
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

export function add(a: Quantity, b: Quantity): Qty {
  return withUnits(a, b, (aDef, bDef) => {
    if (isDimensionless(bDef.dimension)) {
      return fromChecked(numeric.addChecked(a.value, b.value), aDef);
    }
    if (isDimensionless(aDef.dimension)) {
      return fromChecked(numeric.addChecked(b.value, a.value), bDef);
    }
    if (!dimensionsEqual(aDef.dimension, bDef.dimension)) {
      return mismatch(aDef, bDef);
    }
    const dest = addDest(aDef, bDef);
    if (dest === undefined) {
      return mismatch(aDef, bDef);
    }
    return fromCheckedSI(numeric.addChecked(toSI(a.value, aDef), toSI(b.value, bDef)), dest);
  });
}

export function sub(a: Quantity, b: Quantity): Qty {
  return withUnits(a, b, (aDef, bDef) => {
    if (isDimensionless(bDef.dimension)) {
      return fromChecked(numeric.subChecked(a.value, b.value), aDef);
    }
    if (isDimensionless(aDef.dimension)) {
      return bDef.affine === "absolute"
        ? mismatch(aDef, bDef)
        : fromChecked(numeric.subChecked(a.value, b.value), bDef);
    }
    if (!dimensionsEqual(aDef.dimension, bDef.dimension)) {
      return mismatch(aDef, bDef);
    }
    const dest = subDest(aDef, bDef);
    if (dest === undefined) {
      return mismatch(aDef, bDef);
    }
    return fromCheckedSI(numeric.subChecked(toSI(a.value, aDef), toSI(b.value, bDef)), dest);
  });
}

export function mul(a: Quantity, b: Quantity): Qty {
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

export function div(a: Quantity, b: Quantity): Qty {
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

export function sqrt(qty: Quantity): Qty {
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
