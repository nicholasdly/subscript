import type { Formatter } from "./format.ts";
import { lex } from "./lex.ts";
import { INPUT_LENGTH_LIMIT } from "./limits.ts";
import { normalize } from "./normalize.ts";
import * as numeric from "./numeric.ts";
import { parse } from "./parse.ts";
import { add, convert, div, mul, quantity, sqrt, sub } from "./quantity.ts";
import { enumerateReadings, readsInAsConverter } from "./rank.ts";
import { newSession, type QuoteSession } from "./rates.ts";
import { rewrite } from "./rewrite.ts";
import type { Ast, Token } from "./token.ts";
import {
  isZonedTime,
  type Alternate,
  type AmbiguousClock,
  type Instant,
  type LimitName,
  type NowFn,
  type Quantity,
  type Result,
  type Span,
  type SpanKind,
} from "./types.ts";
import { lookupZone, retarget, toZonedTime, zoneWall, type TzEngine } from "./tz.ts";
import { isCurrency } from "./units/kinds.ts";
import { lookupUnit } from "./units/lookup.ts";
import type { TrieNode } from "./units/trie.ts";

export type PipelineOutput = {
  readonly result: Result;
  readonly spans: readonly Span[];
};

const notAnExpression: Result = { ok: false, reason: { kind: "not-an-expression" } };
const nothing: PipelineOutput = { result: notAnExpression, spans: [] };

function limitExceeded(limit: LimitName): Result {
  return { ok: false, reason: { kind: "limit-exceeded", limit } };
}

function spanKind(token: Token): SpanKind {
  switch (token.kind) {
    case "number":
    case "clock":
    case "now":
      return "number";
    case "timezone":
      return "timezone";
    case "unit": {
      const def = lookupUnit(token.unitId);
      return def !== undefined && isCurrency(def) ? "currency" : "unit";
    }
    case "converter":
      return "converter";
    case "function":
      return "operator";
    case "unknown":
      return "unknown";
    case "operator":
      return token.op === "(" || token.op === ")" ? "punctuation" : "operator";
  }
}

/** Tokens the rewriter invented span nothing, so they colour nothing. */
function spansFor(tokens: readonly Token[]): Span[] {
  const spans: Span[] = [];
  for (const token of tokens) {
    if (token.start < token.end) {
      spans.push({ start: token.start, end: token.end, kind: spanKind(token) });
    }
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  return spans;
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

type EvalCtx = {
  readonly instant: Instant;
  readonly engine: TzEngine;
};

function okZoned(value: ReturnType<typeof retarget>): Result {
  return { ok: true, value, text: "" };
}

async function evaluateAst(ast: Ast, rates: QuoteSession, ctx: EvalCtx): Promise<Result> {
  switch (ast.kind) {
    case "number":
      return quantity(ast.value);
    case "quantity":
      return quantity(ast.value, ast.unitId);
    case "clock":
    case "now":
      return notAnExpression;
    case "zoned": {
      if (ast.inner.kind !== "clock") {
        return notAnExpression;
      }
      const zone = lookupZone(ast.zoneId);
      if (zone === undefined) {
        return notAnExpression;
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
      return zoned === undefined ? notAnExpression : okZoned(zoned);
    }
    case "convert-zone": {
      const toZone = lookupZone(ast.toZoneId);
      if (toZone === undefined) {
        return notAnExpression;
      }
      if (ast.expr.kind === "now") {
        const epoch = ctx.instant.epochMilliseconds;
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
      const inner = await evaluateAst(ast.expr, rates, ctx);
      if (!inner.ok) {
        return inner;
      }
      if (!isZonedTime(inner.value)) {
        return notAnExpression;
      }
      return okZoned(retarget(inner.value, toZone));
    }
    case "unary": {
      const inner = await evaluateAst(ast.inner, rates, ctx);
      if (!inner.ok) {
        return inner;
      }
      if (isZonedTime(inner.value)) {
        return notAnExpression;
      }
      return quantity(-inner.value.value, inner.value.unit.id);
    }
    case "sqrt": {
      const inner = await evaluateAst(ast.inner, rates, ctx);
      if (!inner.ok) {
        return inner;
      }
      if (isZonedTime(inner.value)) {
        return notAnExpression;
      }
      return sqrt(inner.value);
    }
    case "convert": {
      const inner = await evaluateAst(ast.expr, rates, ctx);
      if (!inner.ok) {
        return inner;
      }
      if (isZonedTime(inner.value)) {
        return notAnExpression;
      }
      return convert(inner.value, ast.toId, rates);
    }
    case "binary": {
      const left = await evaluateAst(ast.left, rates, ctx);
      if (!left.ok) {
        return left;
      }
      const right = await evaluateAst(ast.right, rates, ctx);
      if (!right.ok) {
        return right;
      }
      if (isZonedTime(left.value) || isZonedTime(right.value)) {
        return notAnExpression;
      }
      switch (ast.op) {
        case "+":
          return add(left.value, right.value, rates);
        case "-":
          return sub(left.value, right.value, rates);
        case "*":
          return mul(left.value, right.value);
        case "/":
          return div(left.value, right.value, rates);
        case "^":
          return power(left.value, right.value);
      }
    }
  }
}

type Reading = {
  readonly result: Result;
  readonly tokens: readonly Token[];
};

function sameQuantity(a: Quantity, b: Quantity): boolean {
  return a.unit.id === b.unit.id && a.value === b.value;
}

/** Other readings that also evaluated, to a different answer than the winner's. */
function alternatesFor(
  winner: Reading,
  succeeded: readonly Reading[],
  format: Formatter,
): Alternate[] {
  const alternates: Alternate[] = [];
  for (const reading of succeeded) {
    if (
      reading === winner ||
      !reading.result.ok ||
      !winner.result.ok ||
      isZonedTime(reading.result.value) ||
      isZonedTime(winner.result.value) ||
      sameQuantity(reading.result.value, winner.result.value)
    ) {
      continue;
    }
    alternates.push({
      value: reading.result.value,
      text: format(reading.result.value),
      reason: readsInAsConverter(reading.tokens) ? "in as converter" : "in as inch",
    });
  }
  return alternates;
}

function withFormat(
  result: Extract<Result, { ok: true }>,
  format: Formatter,
): Extract<Result, { ok: true }> {
  return { ...result, text: format(result.value) };
}

export async function runPipeline(
  input: string,
  trie: TrieNode,
  format: Formatter,
  fetchFn: typeof globalThis.fetch,
  now: NowFn,
  ambiguousClock: AmbiguousClock,
  engine: TzEngine,
): Promise<PipelineOutput> {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return { result: limitExceeded("input-length"), spans: [] };
  }

  const readings = enumerateReadings(lex(normalize(input), trie, ambiguousClock));
  if (readings === undefined) {
    return nothing;
  }

  const rates = newSession(fetchFn);
  const ctx: EvalCtx = { instant: now(), engine };
  const evaluated: Reading[] = [];
  for (const reading of readings) {
    const tokens = rewrite(reading);
    const parsed = parse(tokens);
    if (parsed.ok) {
      evaluated.push({ result: await evaluateAst(parsed.ast, rates, ctx), tokens });
    } else if (parsed.limit !== undefined) {
      evaluated.push({ result: limitExceeded(parsed.limit), tokens });
    }
  }

  const succeeded = evaluated.filter((reading) => reading.result.ok);
  const winner =
    succeeded.find((reading) => readsInAsConverter(reading.tokens)) ?? succeeded[0] ?? evaluated[0];
  if (winner === undefined) {
    return nothing;
  }
  if (!winner.result.ok) {
    return { result: winner.result, spans: [] };
  }

  const alternates = alternatesFor(winner, succeeded, format);
  const result = withFormat(winner.result, format);
  return {
    result: alternates.length > 0 ? { ...result, alternates } : result,
    spans: spansFor(winner.tokens),
  };
}

/** Parse and rank without evaluating, so coloring never quotes Frankfurter. */
export function spansForInput(
  input: string,
  trie: TrieNode,
  ambiguousClock: AmbiguousClock = "literal24",
): readonly Span[] {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return [];
  }

  const readings = enumerateReadings(lex(normalize(input), trie, ambiguousClock));
  if (readings === undefined) {
    return [];
  }

  const parsed: { tokens: readonly Token[] }[] = [];
  for (const reading of readings) {
    const tokens = rewrite(reading);
    const result = parse(tokens);
    if (result.ok) {
      parsed.push({ tokens });
    }
  }

  const winner = parsed.find((reading) => readsInAsConverter(reading.tokens)) ?? parsed[0];
  return winner === undefined ? [] : spansFor(winner.tokens);
}
