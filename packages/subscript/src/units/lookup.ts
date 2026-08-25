import {
  dimensionsEqual,
  type Dimension,
} from "../dimension.ts";
import type { Unit } from "../types.ts";
import type { UnitDef } from "./kinds.ts";
import { UNITS } from "./table.ts";

const byId = new Map<string, UnitDef>(UNITS.map((unit) => [unit.id, unit]));

export function lookupUnit(id: string): UnitDef | undefined {
  return byId.get(id);
}

export function unitsMatching(dimension: Dimension): readonly UnitDef[] {
  return UNITS.filter((unit) => dimensionsEqual(unit.dimension, dimension));
}

export function toPublic(def: UnitDef): Unit {
  return { id: def.id, symbol: def.symbol };
}
