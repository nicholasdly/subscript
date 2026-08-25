import { formatQuantity } from "./format.ts";
import { lex } from "./lex.ts";
import { INPUT_LENGTH_LIMIT } from "./limits.ts";
import { normalize } from "./normalize.ts";
import { parse } from "./parse.ts";
import {
  add,
  convert,
  div,
  mul,
  quantity,
  sqrt,
  sub,
} from "./quantity.ts";
import { enumerateReadings, scoreReading } from "./rank.ts";
import { rewrite } from "./rewrite.ts";
import type { Ast } from "./token.ts";
import type { Alternate, Result, Span, SpanKind } from "./types.ts";
import * as numeric from "./numeric.ts";
import type { TrieNode } from "./units/trie.ts";

export type PipelineOutput = {
  readonly result: Result;
  readonly spans: readonly Span[];
};

const notAnExpression: Result = {
  ok: false,
  reason: { kind: "not-an-expression" },
};

function spanKind(token: { kind: string; op?: string }): SpanKind {
  if (token.kind === "number") {
    return "number";
  }
  if (token.kind === "unit") {
    return "unit";
  }
  if (token.kind === "converter") {
    return "converter";
  }
  if (token.kind === "function") {
    return "operator";
  }
  if (token.kind === "unknown") {
    return "unknown";
  }
  if (token.op === "(" || token.op === ")") {
    return "punctuation";
  }
  return "operator";
}

function spansFor(tokens: readonly { start: number; end: number; kind: string; op?: string }[]): Span[] {
  return tokens.map((token) => ({
    start: token.start,
    end: token.end,
    kind: spanKind(token),
  }));
}

function evaluateAst(ast: Ast): Result {
  switch (ast.kind) {
    case "number":
      return quantity(ast.value);
    case "quantity":
      return quantity(ast.value, ast.unitId);
    case "unary": {
      const inner = evaluateAst(ast.inner);
      if (!inner.ok) {
        return inner;
      }
      const neg = quantity(-1);
      if (!neg.ok) {
        return neg;
      }
      return mul(neg.value, inner.value);
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
      if (ast.op === "+") {
        return add(left.value, right.value);
      }
      if (ast.op === "-") {
        return sub(left.value, right.value);
      }
      if (ast.op === "*") {
        return mul(left.value, right.value);
      }
      if (ast.op === "/") {
        return div(left.value, right.value);
      }
      if (left.value.unit.id !== "1" || right.value.unit.id !== "1") {
        return {
          ok: false,
          reason: {
            kind: "dimension-mismatch",
            from: left.value.unit,
            to: right.value.unit,
          },
        };
      }
      const value = numeric.pow(left.value.value, right.value.value);
      return quantity(value);
    }
    case "sqrt": {
      const inner = evaluateAst(ast.inner);
      if (!inner.ok) {
        return inner;
      }
      return sqrt(inner.value);
    }
    case "convert": {
      const inner = evaluateAst(ast.expr);
      if (!inner.ok) {
        return inner;
      }
      return convert(inner.value, ast.toId);
    }
  }
}

type Candidate = {
  readonly score: number;
  readonly result: Result;
  readonly tokens: ReturnType<typeof rewrite>;
};

function qtyKey(result: Result): string | undefined {
  if (!result.ok) {
    return undefined;
  }
  return `${result.value.unit.id}:${result.value.value}`;
}

export function runPipeline(input: string, trie: TrieNode): PipelineOutput {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return {
      result: { ok: false, reason: { kind: "limit-exceeded", limit: "input-length" } },
      spans: [],
    };
  }

  const normalized = normalize(input);
  const lexed = lex(normalized, trie);
  const forks = enumerateReadings(lexed);
  if (forks === undefined) {
    return { result: notAnExpression, spans: [] };
  }

  const candidates: Candidate[] = [];
  for (const reading of forks) {
    const tokens = rewrite(reading);
    const parsed = parse(tokens);
    if (!parsed.ok) {
      if (parsed.limit !== undefined) {
        candidates.push({
          score: -1,
          result: { ok: false, reason: { kind: "limit-exceeded", limit: parsed.limit } },
          tokens,
        });
      }
      continue;
    }
    const result = evaluateAst(parsed.ast);
    const score = result.ok ? scoreReading(tokens, parsed.ast) : 0;
    candidates.push({ score, result, tokens });
  }

  const successes = candidates.filter((c) => c.result.ok);
  const pickFrom = successes.length > 0 ? successes : candidates;
  if (pickFrom.length === 0) {
    return { result: notAnExpression, spans: [] };
  }
  pickFrom.sort((a, b) => b.score - a.score);
  const winner = pickFrom[0];
  if (winner === undefined) {
    return { result: notAnExpression, spans: [] };
  }

  if (!winner.result.ok) {
    return { result: winner.result, spans: [] };
  }

  const winnerKey = qtyKey(winner.result);
  const alternates: Alternate[] = [];
  for (const other of successes) {
    if (other === winner) {
      continue;
    }
    if (!other.result.ok) {
      continue;
    }
    if (qtyKey(other.result) === winnerKey) {
      continue;
    }
    alternates.push({
      value: other.result.value,
      text: formatQuantity(other.result.value),
      reason: other.tokens.some((t) => t.kind === "converter" && t.converter === "in")
        ? "in as converter"
        : "in as inch",
    });
  }

  const result: Result =
    alternates.length > 0
      ? { ...winner.result, alternates }
      : winner.result;

  return { result, spans: spansFor(winner.tokens) };
}
