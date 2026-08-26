/** Find a unit by id, or name a derived result (`m×m` → `m²`). */
import { dimensionsEqual, type Dimension } from "../quantity/dimension.ts";
import * as numeric from "../quantity/numeric.ts";
import type { Unit } from "../types.ts";
import type { UnitDef } from "./kinds.ts";
import { UNITS } from "./table.ts";

const byId = new Map<string, UnitDef>(UNITS.map((unit) => [unit.id, unit]));

const SCALE_EPS = 1e-12;

function scalesEqual(a: number, b: number): boolean {
  return Math.abs(numeric.sub(a, b)) <= SCALE_EPS * Math.max(1, Math.abs(a), Math.abs(b));
}

export function lookupUnit(id: string): UnitDef | undefined {
  return byId.get(id);
}

export function toPublic(def: UnitDef): Unit {
  return { id: def.id, symbol: def.symbol };
}

/**
 * The row that names a derived result: the one whose scale the operands already
 * produced, else the coherent SI row for that dimension. Absolute temperatures
 * are never a result.
 */
export function findResultUnit(dim: Dimension, scale: number): UnitDef | undefined {
  let coherent: UnitDef | undefined;
  for (const unit of UNITS) {
    if (unit.affine === "absolute" || !dimensionsEqual(unit.dimension, dim)) {
      continue;
    }
    if (scalesEqual(unit.scale, scale)) {
      return unit;
    }
    if (coherent === undefined && scalesEqual(unit.scale, 1)) {
      coherent = unit;
    }
  }
  return coherent;
}
