import { EXPONENT_ABS_LIMIT } from "../limits.ts";
import * as qty from "../quantity/ops.ts";
import {
  isValidEpoch,
  lookupZone,
  retarget,
  toZonedTime,
  zoneWall,
  type TzEngine,
} from "../time/index.ts";
import {
  isZonedTime,
  type EvalValue,
  type Instant,
  type Outcome,
  type Quantity,
  type ZonedTime,
} from "../types.ts";
import type { Ast, BinaryOp } from "./token.ts";

/**
 * Stage 6: walk the AST into a Quantity or ZonedTime.
 *
 * Arithmetic delegates to `quantity/ops`; time queries delegate to `time/`.
 * The formatted `text` is filled in later by the conductor.
 */

/** Clock and zone engine for one evaluation. */
export type EvalCtx = {
  readonly instant: Instant;
  readonly engine: TzEngine;
};

function notAnExpression(): Outcome<never> {
  return { ok: false, reason: { kind: "not-an-expression" } };
}

function okZoned(value: ZonedTime): Outcome<EvalValue> {
  return { ok: true, value };
}

/** `^` is dimensionless-only: a dimensioned base is not an exponentiation we can name. */
function power(base: Quantity, exponent: Quantity): Outcome<Quantity> {
  if (base.unit.id !== "1" || exponent.unit.id !== "1") {
    return {
      ok: false,
      reason: { kind: "dimension-mismatch", from: base.unit, to: exponent.unit },
    };
  }
  if (Math.abs(exponent.value) > EXPONENT_ABS_LIMIT) {
    return { ok: false, reason: { kind: "limit-exceeded", limit: "exponent-magnitude" } };
  }
  return qty.quantity(base.value ** exponent.value);
}

function applyOp(op: BinaryOp, left: Quantity, right: Quantity): Outcome<Quantity> {
  switch (op) {
    case "+":
      return qty.add(left, right);
    case "-":
      return qty.sub(left, right);
    case "*":
      return qty.mul(left, right);
    case "/":
      return qty.div(left, right);
    case "^":
      return power(left, right);
    default: {
      const _never: never = op;
      return _never;
    }
  }
}

/** Evaluate a child that must be a Quantity. Time values cannot mix with arithmetic. */
function evalQuantity(ast: Ast, ctx: EvalCtx): Outcome<Quantity> {
  const result = evaluateAst(ast, ctx);
  if (!result.ok) {
    return result;
  }
  if (isZonedTime(result.value)) {
    return notAnExpression();
  }
  return { ok: true, value: result.value };
}

/** A clock in a zone, dated from the injected `now`. */
function evaluateZoned(ast: Extract<Ast, { kind: "zoned" }>, ctx: EvalCtx): Outcome<EvalValue> {
  if (ast.inner.kind !== "clock") {
    return notAnExpression();
  }
  if (!isValidEpoch(ctx.instant.epochMilliseconds)) {
    return notAnExpression();
  }
  const zone = lookupZone(ast.zoneId);
  if (zone === undefined) {
    return notAnExpression();
  }
  const today = zoneWall(ctx.instant.epochMilliseconds, zone, ctx.engine);
  const zoned = toZonedTime(
    { ...today, hour: ast.inner.hour, minute: ast.inner.minute, second: ast.inner.second },
    zone,
    ctx.engine,
  );
  if (zoned === undefined) {
    return notAnExpression();
  }
  return okZoned(zoned);
}

/** The injected clock, displayed in the target zone. */
function nowInZone(ctx: EvalCtx, timeZone: string, label: string): Outcome<EvalValue> {
  const epoch = ctx.instant.epochMilliseconds;
  if (!isValidEpoch(epoch)) {
    return notAnExpression();
  }
  const utc = new Date(epoch);
  return okZoned({
    kind: "zoned-time",
    epochMilliseconds: epoch,
    timeZone,
    label,
    sourceYear: utc.getUTCFullYear(),
    sourceMonth: utc.getUTCMonth() + 1,
    sourceDay: utc.getUTCDate(),
  });
}

function evaluateConvertZone(
  ast: Extract<Ast, { kind: "convert-zone" }>,
  ctx: EvalCtx,
): Outcome<EvalValue> {
  const toZone = lookupZone(ast.toZoneId);
  if (toZone === undefined) {
    return notAnExpression();
  }
  if (ast.expr.kind === "now") {
    return nowInZone(ctx, toZone.id, toZone.label);
  }
  const inner = evaluateAst(ast.expr, ctx);
  if (!inner.ok) {
    return inner;
  }
  if (!isZonedTime(inner.value)) {
    return notAnExpression();
  }
  return okZoned(retarget(inner.value, toZone));
}

function evaluateUnary(ast: Extract<Ast, { kind: "unary" }>, ctx: EvalCtx): Outcome<EvalValue> {
  const inner = evalQuantity(ast.inner, ctx);
  if (!inner.ok) {
    return inner;
  }
  return qty.quantity(-inner.value.value, inner.value.unit.id);
}

function evaluateSqrt(ast: Extract<Ast, { kind: "sqrt" }>, ctx: EvalCtx): Outcome<EvalValue> {
  const inner = evalQuantity(ast.inner, ctx);
  if (!inner.ok) {
    return inner;
  }
  return qty.sqrt(inner.value);
}

function evaluateConvert(ast: Extract<Ast, { kind: "convert" }>, ctx: EvalCtx): Outcome<EvalValue> {
  const inner = evalQuantity(ast.expr, ctx);
  if (!inner.ok) {
    return inner;
  }
  return qty.convert(inner.value, ast.toId);
}

function evaluateBinary(ast: Extract<Ast, { kind: "binary" }>, ctx: EvalCtx): Outcome<EvalValue> {
  const left = evalQuantity(ast.left, ctx);
  if (!left.ok) {
    return left;
  }
  const right = evalQuantity(ast.right, ctx);
  if (!right.ok) {
    return right;
  }
  return applyOp(ast.op, left.value, right.value);
}

export function evaluateAst(ast: Ast, ctx: EvalCtx): Outcome<EvalValue> {
  switch (ast.kind) {
    case "number":
      return qty.quantity(ast.value);
    case "quantity":
      return qty.quantity(ast.value, ast.unitId);
    case "clock":
    case "now":
      return notAnExpression();
    case "zoned":
      return evaluateZoned(ast, ctx);
    case "convert-zone":
      return evaluateConvertZone(ast, ctx);
    case "unary":
      return evaluateUnary(ast, ctx);
    case "sqrt":
      return evaluateSqrt(ast, ctx);
    case "convert":
      return evaluateConvert(ast, ctx);
    case "binary":
      return evaluateBinary(ast, ctx);
    default: {
      const _never: never = ast;
      return _never;
    }
  }
}
