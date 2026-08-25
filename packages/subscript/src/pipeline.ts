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
import type { Alternate, LimitName, Quantity, Result, Span, SpanKind } from "./types.ts";
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
      return "number";
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

async function evaluateAst(ast: Ast, rates: QuoteSession): Promise<Result> {
  switch (ast.kind) {
    case "number":
      return quantity(ast.value);
    case "quantity":
      return quantity(ast.value, ast.unitId);
    case "unary": {
      const inner = await evaluateAst(ast.inner, rates);
      return inner.ok ? quantity(-inner.value.value, inner.value.unit.id) : inner;
    }
    case "sqrt": {
      const inner = await evaluateAst(ast.inner, rates);
      return inner.ok ? sqrt(inner.value) : inner;
    }
    case "convert": {
      const inner = await evaluateAst(ast.expr, rates);
      return inner.ok ? convert(inner.value, ast.toId, rates) : inner;
    }
    case "binary": {
      const left = await evaluateAst(ast.left, rates);
      if (!left.ok) {
        return left;
      }
      const right = await evaluateAst(ast.right, rates);
      if (!right.ok) {
        return right;
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
): Promise<PipelineOutput> {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return { result: limitExceeded("input-length"), spans: [] };
  }

  const readings = enumerateReadings(lex(normalize(input), trie));
  if (readings === undefined) {
    return nothing;
  }

  const rates = newSession(fetchFn);
  const evaluated: Reading[] = [];
  for (const reading of readings) {
    const tokens = rewrite(reading);
    const parsed = parse(tokens);
    if (parsed.ok) {
      evaluated.push({ result: await evaluateAst(parsed.ast, rates), tokens });
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
export function spansForInput(input: string, trie: TrieNode): readonly Span[] {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return [];
  }

  const readings = enumerateReadings(lex(normalize(input), trie));
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
