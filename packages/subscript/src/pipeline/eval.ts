import { add, convert, div, mul, quantity, sqrt, sub } from "../quantity/index.ts";
import * as numeric from "../quantity/numeric.ts";
import {
  isValidEpoch,
  lookupZone,
  retarget,
  toZonedTime,
  zoneWall,
  type TzEngine,
} from "../time/index.ts";
import { isZonedTime, type Instant, type Quantity, type Result } from "../types.ts";
import type { Ast } from "./token.ts";

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

function notAnExpression(): Result {
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
  return quantity(numeric.pow(base.value, exponent.value));
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
    case "zoned": {
      if (ast.inner.kind !== "clock" || !isValidEpoch(ctx.instant.epochMilliseconds)) {
        return notAnExpression();
      }
      const zone = lookupZone(ast.zoneId);
      if (zone === undefined) {
        return notAnExpression();
      }
      const today = zoneWall(ctx.instant.epochMilliseconds, zone, ctx.engine);
      const local = {
        year: today.year,
        month: today.month,
        day: today.day,
        hour: ast.inner.hour,
        minute: ast.inner.minute,
        second: ast.inner.second,
      };
      const zoned = toZonedTime(local, zone, ctx.engine);
      return zoned === undefined ? notAnExpression() : okZoned(zoned);
    }
    case "convert-zone": {
      const toZone = lookupZone(ast.toZoneId);
      if (toZone === undefined) {
        return notAnExpression();
      }
      if (ast.expr.kind === "now") {
        const epoch = ctx.instant.epochMilliseconds;
        if (!isValidEpoch(epoch)) {
          return notAnExpression();
        }
        const utc = new Date(epoch);
        return okZoned({
          kind: "zoned-time",
          epochMilliseconds: epoch,
          timeZone: toZone.id,
          label: toZone.label,
          sourceYear: utc.getUTCFullYear(),
          sourceMonth: utc.getUTCMonth() + 1,
          sourceDay: utc.getUTCDate(),
        });
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
    case "unary": {
      const inner = evaluateAst(ast.inner, ctx);
      if (!inner.ok) {
        return inner;
      }
      if (isZonedTime(inner.value)) {
        return notAnExpression();
      }
      return quantity(-inner.value.value, inner.value.unit.id);
    }
    case "sqrt": {
      const inner = evaluateAst(ast.inner, ctx);
      if (!inner.ok) {
        return inner;
      }
      if (isZonedTime(inner.value)) {
        return notAnExpression();
      }
      return sqrt(inner.value);
    }
    case "convert": {
      const inner = evaluateAst(ast.expr, ctx);
      if (!inner.ok) {
        return inner;
      }
      if (isZonedTime(inner.value)) {
        return notAnExpression();
      }
      return convert(inner.value, ast.toId);
    }
    case "binary": {
      const left = evaluateAst(ast.left, ctx);
      if (!left.ok) {
        return left;
      }
      const right = evaluateAst(ast.right, ctx);
      if (!right.ok) {
        return right;
      }
      if (isZonedTime(left.value) || isZonedTime(right.value)) {
        return notAnExpression();
      }
      switch (ast.op) {
        case "+":
          return add(left.value, right.value);
        case "-":
          return sub(left.value, right.value);
        case "*":
          return mul(left.value, right.value);
        case "/":
          return div(left.value, right.value);
        case "^":
          return power(left.value, right.value);
      }
    }
  }
}
