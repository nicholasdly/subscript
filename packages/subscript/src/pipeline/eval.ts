import { EXPONENT_ABS_LIMIT } from "../limits.ts";
import { add, convert, div, mul, quantity, sqrt, sub } from "../quantity/index.ts";
import {
  isValidEpoch,
  lookupZone,
  retarget,
  toZonedTime,
  zoneWall,
  type TzEngine,
} from "../time/index.ts";
import { isZonedTime, type Failure, type Instant, type Quantity, type Result } from "../types.ts";
import type { Ast, BinaryOp } from "./token.ts";

/**
 * Stage 6: walk the AST into a Quantity or ZonedTime.
 *
 * Arithmetic delegates to `quantity/`; time queries delegate to `time/`.
 * The formatted `text` is filled in later by the conductor.
 */

/** Clock and zone engine for one evaluation. `text` is filled in later. */
export type EvalCtx = {
  readonly instant: Instant;
  readonly engine: TzEngine;
};

/** Like {@link Result}, but a success is always a Quantity (never a ZonedTime). */
type QuantityResult =
  | { readonly ok: true; readonly value: Quantity; readonly text: string }
  | { readonly ok: false; readonly reason: Failure };

function notAnExpression(): Extract<Result, { ok: false }> {
  return { ok: false, reason: { kind: "not-an-expression" } };
}

function okZoned(value: ReturnType<typeof retarget>): Result {
  return { ok: true, value, text: "" };
}

/** `^` is dimensionless-only: a dimensioned base is not an exponentiation we can name. */
function power(base: Quantity, exponent: Quantity): Result {
  if (base.unit.id !== "1" || exponent.unit.id !== "1") {
    return {
      ok: false,
      reason: { kind: "dimension-mismatch", from: base.unit, to: exponent.unit },
    };
  }
  if (Math.abs(exponent.value) > EXPONENT_ABS_LIMIT) {
    return { ok: false, reason: { kind: "limit-exceeded", limit: "exponent-magnitude" } };
  }
  return quantity(base.value ** exponent.value);
}

function applyOp(op: BinaryOp, left: Quantity, right: Quantity): Result {
  switch (op) {
    case "+":
      return add(left, right);
    case "-":
      return sub(left, right);
    case "*":
      return mul(left, right);
    case "/":
      return div(left, right);
    case "^":
      return power(left, right);
  }
}

/** Evaluate a child that must be a Quantity. Time values cannot mix with arithmetic. */
function evalQuantity(ast: Ast, ctx: EvalCtx): QuantityResult {
  const result = evaluateAst(ast, ctx);
  if (!result.ok) {
    return result;
  }
  if (isZonedTime(result.value)) {
    return notAnExpression();
  }
  return { ok: true, value: result.value, text: result.text };
}

/** A clock in a zone, dated from the injected `now`. */
function evaluateZoned(ast: Extract<Ast, { kind: "zoned" }>, ctx: EvalCtx): Result {
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
function nowInZone(ctx: EvalCtx, timeZone: string, label: string): Result {
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

function evaluateConvertZone(ast: Extract<Ast, { kind: "convert-zone" }>, ctx: EvalCtx): Result {
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

function evaluateUnary(ast: Extract<Ast, { kind: "unary" }>, ctx: EvalCtx): Result {
  const inner = evalQuantity(ast.inner, ctx);
  if (!inner.ok) {
    return inner;
  }
  return quantity(-inner.value.value, inner.value.unit.id);
}

function evaluateSqrt(ast: Extract<Ast, { kind: "sqrt" }>, ctx: EvalCtx): Result {
  const inner = evalQuantity(ast.inner, ctx);
  if (!inner.ok) {
    return inner;
  }
  return sqrt(inner.value);
}

function evaluateConvert(ast: Extract<Ast, { kind: "convert" }>, ctx: EvalCtx): Result {
  const inner = evalQuantity(ast.expr, ctx);
  if (!inner.ok) {
    return inner;
  }
  return convert(inner.value, ast.toId);
}

function evaluateBinary(ast: Extract<Ast, { kind: "binary" }>, ctx: EvalCtx): Result {
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

export function evaluateAst(ast: Ast, ctx: EvalCtx): Result {
  switch (ast.kind) {
    case "number":
      return quantity(ast.value);
    case "quantity":
      return quantity(ast.value, ast.unitId);
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
  }
}
