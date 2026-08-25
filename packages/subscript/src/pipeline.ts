import type { Formatter } from "./format.ts";
import { lex } from "./lex.ts";
import { INPUT_LENGTH_LIMIT } from "./limits.ts";
import { normalize } from "./normalize.ts";
import * as numeric from "./numeric.ts";
import { parse } from "./parse.ts";
import { add, convert, div, mul, quantity, sqrt, sub } from "./quantity.ts";
import { enumerateReadings, readsInAsConverter } from "./rank.ts";
import { rewrite } from "./rewrite.ts";
import type { Ast, Token } from "./token.ts";
import type { Alternate, LimitName, Quantity, Result, Span, SpanKind } from "./types.ts";
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
    case "unit":
      return "unit";
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

function evaluateAst(ast: Ast): Result {
  switch (ast.kind) {
    case "number":
      return quantity(ast.value);
    case "quantity":
      return quantity(ast.value, ast.unitId);
    case "unary": {
      const inner = evaluateAst(ast.inner);
      // Negating the literal, not scaling it: `-20 °C` is a temperature, not 20 × -1.
      return inner.ok ? quantity(-inner.value.value, inner.value.unit.id) : inner;
    }
    case "sqrt": {
      const inner = evaluateAst(ast.inner);
      return inner.ok ? sqrt(inner.value) : inner;
    }
    case "convert": {
      const inner = evaluateAst(ast.expr);
      return inner.ok ? convert(inner.value, ast.toId) : inner;
    }
    case "binary": {
      const left = evaluateAst(ast.left);
      if (!left.ok) {
        return left;
      }
      const right = evaluateAst(ast.right);
      if (!right.ok) {
        return right;
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

export function runPipeline(input: string, trie: TrieNode, format: Formatter): PipelineOutput {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return { result: limitExceeded("input-length"), spans: [] };
  }

  const readings = enumerateReadings(lex(normalize(input), trie));
  if (readings === undefined) {
    return nothing;
  }

  const evaluated: Reading[] = [];
  for (const reading of readings) {
    const tokens = rewrite(reading);
    const parsed = parse(tokens);
    if (parsed.ok) {
      evaluated.push({ result: evaluateAst(parsed.ast), tokens });
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
