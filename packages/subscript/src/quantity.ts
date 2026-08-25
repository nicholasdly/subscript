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
import type { Quantity, Result, Unit } from "./types.ts";
import type { AffineKind, UnitDef } from "./units/kinds.ts";
import { lookupUnit, toPublic, unitsMatching } from "./units/lookup.ts";

const DIMENSIONLESS_ID = "1";
const SCALE_EPS = 1e-12;

function precisionLoss(): Result {
  return { ok: false, reason: { kind: "precision-loss" } };
}

function unknownUnit(token: string): Result {
  return { ok: false, reason: { kind: "unknown-unit", token } };
}

function mismatch(from: Unit, to: Unit): Result {
  return { ok: false, reason: { kind: "dimension-mismatch", from, to } };
}

function formatStub(qty: Quantity): string {
  if (qty.unit.symbol === "") {
    return String(qty.value);
  }
  return `${qty.value} ${qty.unit.symbol}`;
}

function ok(value: number, def: UnitDef): Result {
  if (!numeric.isFiniteNumber(value)) {
    return precisionLoss();
  }
  const quantityValue: Quantity = { value, unit: toPublic(def) };
  return { ok: true, value: quantityValue, text: formatStub(quantityValue) };
}

function resolve(qty: Quantity): UnitDef | Result {
  const def = lookupUnit(qty.unit.id);
  if (def === undefined) {
    return unknownUnit(qty.unit.id);
  }
  if (!numeric.isFiniteNumber(qty.value)) {
    return precisionLoss();
  }
  return def;
}

function isDef(value: UnitDef | Result): value is UnitDef {
  return "scale" in value;
}

function toSI(value: number, def: UnitDef): number {
  return numeric.add(numeric.mul(value, def.scale), def.offset);
}

function fromSI(si: number, def: UnitDef): number {
  return numeric.div(numeric.sub(si, def.offset), def.scale);
}

function scalesEqual(a: number, b: number): boolean {
  return (
    Math.abs(numeric.sub(a, b)) <=
    SCALE_EPS * Math.max(1, Math.abs(a), Math.abs(b))
  );
}

function canConvert(from: AffineKind, to: AffineKind): boolean {
  if (from === to) {
    return true;
  }
  if (from === "absolute" && to === "difference") {
    return false;
  }
  if (from === "difference" && to === "absolute") {
    return false;
  }
  return true;
}

function findResultUnit(dim: Dimension, targetScale: number): UnitDef | undefined {
  const matches = unitsMatching(dim).filter((unit) => unit.affine !== "absolute");
  const exact = matches.find((unit) => scalesEqual(unit.scale, targetScale));
  if (exact !== undefined) {
    return exact;
  }
  return matches.find((unit) => scalesEqual(unit.scale, 1));
}

function largerUnit(a: UnitDef, b: UnitDef): UnitDef {
  return a.scale >= b.scale ? a : b;
}

function compoundToken(left: UnitDef, right: UnitDef | undefined, op: "·" | "/" | "√"): string {
  if (op === "√") {
    return `√${left.symbol || left.id}`;
  }
  const a = left.symbol || left.id;
  const b = right === undefined ? "" : right.symbol || right.id;
  return `${a}${op}${b}`;
}

export function quantity(value: number, unitId = DIMENSIONLESS_ID): Result {
  if (!numeric.isFiniteNumber(value)) {
    return precisionLoss();
  }
  const def = lookupUnit(unitId);
  if (def === undefined) {
    return unknownUnit(unitId);
  }
  return ok(value, def);
}

export function convert(qty: Quantity, toId: string): Result {
  const fromDef = resolve(qty);
  if (!isDef(fromDef)) {
    return fromDef;
  }
  const toDef = lookupUnit(toId);
  if (toDef === undefined) {
    return unknownUnit(toId);
  }
  if (!dimensionsEqual(fromDef.dimension, toDef.dimension)) {
    return mismatch(toPublic(fromDef), toPublic(toDef));
  }
  if (!canConvert(fromDef.affine, toDef.affine)) {
    return mismatch(toPublic(fromDef), toPublic(toDef));
  }
  return ok(fromSI(toSI(qty.value, fromDef), toDef), toDef);
}

function addAssimilated(bare: number, other: Quantity, otherDef: UnitDef): Result {
  return ok(numeric.add(other.value, bare), otherDef);
}

export function add(a: Quantity, b: Quantity): Result {
  const aDef = resolve(a);
  if (!isDef(aDef)) {
    return aDef;
  }
  const bDef = resolve(b);
  if (!isDef(bDef)) {
    return bDef;
  }

  const aNone = isDimensionless(aDef.dimension);
  const bNone = isDimensionless(bDef.dimension);
  if (aNone && bNone) {
    return ok(numeric.add(a.value, b.value), aDef);
  }
  if (aNone) {
    return addAssimilated(a.value, b, bDef);
  }
  if (bNone) {
    return addAssimilated(b.value, a, aDef);
  }
  if (!dimensionsEqual(aDef.dimension, bDef.dimension)) {
    return mismatch(toPublic(aDef), toPublic(bDef));
  }

  if (aDef.affine === "absolute" && bDef.affine === "absolute") {
    return mismatch(toPublic(aDef), toPublic(bDef));
  }
  if (aDef.affine === "absolute") {
    return ok(fromSI(numeric.add(toSI(a.value, aDef), toSI(b.value, bDef)), aDef), aDef);
  }
  if (bDef.affine === "absolute") {
    return ok(fromSI(numeric.add(toSI(a.value, aDef), toSI(b.value, bDef)), bDef), bDef);
  }

  const dest = largerUnit(aDef, bDef);
  return ok(fromSI(numeric.add(toSI(a.value, aDef), toSI(b.value, bDef)), dest), dest);
}

function differenceCounterpart(def: UnitDef): UnitDef | undefined {
  if (def.affine === "absolute") {
    return def.differenceId === undefined ? undefined : lookupUnit(def.differenceId);
  }
  return def;
}

export function sub(a: Quantity, b: Quantity): Result {
  const aDef = resolve(a);
  if (!isDef(aDef)) {
    return aDef;
  }
  const bDef = resolve(b);
  if (!isDef(bDef)) {
    return bDef;
  }

  const aNone = isDimensionless(aDef.dimension);
  const bNone = isDimensionless(bDef.dimension);
  if (aNone && bNone) {
    return ok(numeric.sub(a.value, b.value), aDef);
  }
  if (bNone) {
    return ok(numeric.sub(a.value, b.value), aDef);
  }
  if (aNone) {
    if (bDef.affine === "absolute") {
      return mismatch(toPublic(aDef), toPublic(bDef));
    }
    return ok(numeric.sub(a.value, b.value), bDef);
  }
  if (!dimensionsEqual(aDef.dimension, bDef.dimension)) {
    return mismatch(toPublic(aDef), toPublic(bDef));
  }

  if (aDef.affine === "absolute" && bDef.affine === "absolute") {
    const delta = differenceCounterpart(aDef);
    if (delta === undefined) {
      return mismatch(toPublic(aDef), toPublic(bDef));
    }
    return ok(fromSI(numeric.sub(toSI(a.value, aDef), toSI(b.value, bDef)), delta), delta);
  }
  if (aDef.affine === "absolute") {
    return ok(fromSI(numeric.sub(toSI(a.value, aDef), toSI(b.value, bDef)), aDef), aDef);
  }
  if (bDef.affine === "absolute") {
    return mismatch(toPublic(aDef), toPublic(bDef));
  }

  const dest = largerUnit(aDef, bDef);
  return ok(fromSI(numeric.sub(toSI(a.value, aDef), toSI(b.value, bDef)), dest), dest);
}

export function mul(a: Quantity, b: Quantity): Result {
  const aDef = resolve(a);
  if (!isDef(aDef)) {
    return aDef;
  }
  const bDef = resolve(b);
  if (!isDef(bDef)) {
    return bDef;
  }
  if (aDef.affine === "absolute" || bDef.affine === "absolute") {
    return mismatch(toPublic(aDef), toPublic(bDef));
  }

  const aNone = isDimensionless(aDef.dimension);
  const bNone = isDimensionless(bDef.dimension);
  if (aNone && bNone) {
    return ok(numeric.mul(a.value, b.value), aDef);
  }
  if (aNone) {
    return ok(numeric.mul(a.value, b.value), bDef);
  }
  if (bNone) {
    return ok(numeric.mul(a.value, b.value), aDef);
  }

  const dim = mulDimensions(aDef.dimension, bDef.dimension);
  if (isDimensionless(dim)) {
    const dimensionless = lookupUnit(DIMENSIONLESS_ID);
    if (dimensionless === undefined) {
      return unknownUnit(DIMENSIONLESS_ID);
    }
    return ok(numeric.mul(toSI(a.value, aDef), toSI(b.value, bDef)), dimensionless);
  }
  const dest = findResultUnit(dim, numeric.mul(aDef.scale, bDef.scale));
  if (dest === undefined) {
    return unknownUnit(compoundToken(aDef, bDef, "·"));
  }
  return ok(fromSI(numeric.mul(toSI(a.value, aDef), toSI(b.value, bDef)), dest), dest);
}

export function div(a: Quantity, b: Quantity): Result {
  const aDef = resolve(a);
  if (!isDef(aDef)) {
    return aDef;
  }
  const bDef = resolve(b);
  if (!isDef(bDef)) {
    return bDef;
  }
  if (aDef.affine === "absolute" || bDef.affine === "absolute") {
    return mismatch(toPublic(aDef), toPublic(bDef));
  }

  const aNone = isDimensionless(aDef.dimension);
  const bNone = isDimensionless(bDef.dimension);
  if (bNone) {
    return ok(numeric.div(a.value, b.value), aDef);
  }
  if (aNone) {
    const dim = divDimensions(aDef.dimension, bDef.dimension);
    const dest = findResultUnit(dim, numeric.div(1, bDef.scale));
    if (dest === undefined) {
      return unknownUnit(compoundToken(aDef, bDef, "/"));
    }
    return ok(fromSI(numeric.div(toSI(a.value, aDef), toSI(b.value, bDef)), dest), dest);
  }

  const dim = divDimensions(aDef.dimension, bDef.dimension);
  if (isDimensionless(dim)) {
    const dimensionless = lookupUnit(DIMENSIONLESS_ID);
    if (dimensionless === undefined) {
      return unknownUnit(DIMENSIONLESS_ID);
    }
    return ok(numeric.div(toSI(a.value, aDef), toSI(b.value, bDef)), dimensionless);
  }
  const dest = findResultUnit(dim, numeric.div(aDef.scale, bDef.scale));
  if (dest === undefined) {
    return unknownUnit(compoundToken(aDef, bDef, "/"));
  }
  return ok(fromSI(numeric.div(toSI(a.value, aDef), toSI(b.value, bDef)), dest), dest);
}

export function sqrt(qty: Quantity): Result {
  const def = resolve(qty);
  if (!isDef(def)) {
    return def;
  }
  if (def.affine === "absolute") {
    return mismatch(toPublic(def), toPublic(def));
  }
  const dim = scaleDimension(def.dimension, rational(1, 2));
  const si = numeric.sqrt(toSI(qty.value, def));
  if (isDimensionless(dim)) {
    const dimensionless = lookupUnit(DIMENSIONLESS_ID);
    if (dimensionless === undefined) {
      return unknownUnit(DIMENSIONLESS_ID);
    }
    return ok(si, dimensionless);
  }
  const dest = findResultUnit(dim, numeric.sqrt(def.scale));
  if (dest === undefined) {
    return unknownUnit(compoundToken(def, undefined, "√"));
  }
  return ok(fromSI(si, dest), dest);
}
