/**
 * The evaluation pipeline.
 *
 *   normalize → lex → readings → rewrite → parse → eval → format
 *
 * `runPipeline` is what `createSubscript().evaluate` calls.
 * `spansForInput` walks the same stages without evaluating, for syntax highlighting.
 *
 * Each stage is a sibling file named after the step.
 */
import { INPUT_LENGTH_LIMIT } from "../limits.ts";
import type { Formatter } from "../quantity/format.ts";
import type { TzEngine } from "../time/index.ts";
import {
  isZonedTime,
  type Alternate,
  type AmbiguousClock,
  type LimitName,
  type NowFn,
  type Quantity,
  type Result,
  type Span,
  type SpanKind,
} from "../types.ts";
import { evaluateAst } from "./eval.ts";
import { lex } from "./lex.ts";
import { normalize } from "./normalize.ts";
import { parse } from "./parse.ts";
import { enumerateReadings, readsInAsConverter } from "./rank.ts";
import { rewrite } from "./rewrite.ts";
import type { Ast, Token } from "./token.ts";
import type { TrieNode } from "./trie.ts";

export type PipelineOutput = {
  readonly result: Result;
  readonly spans: readonly Span[];
};

function notAnExpression(): Result {
  return { ok: false, reason: { kind: "not-an-expression" } };
}

function nothing(): PipelineOutput {
  return { result: notAnExpression(), spans: [] };
}

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
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  return spans;
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

/**
 * Run normalize → lex → readings → rewrite → parse → eval → format.
 * Prefers the reading that spends `in` as a converter whenever that reading
 * evaluates; otherwise the first success. `alternates` lists other successes.
 */
export function runPipeline(
  input: string,
  trie: TrieNode,
  format: Formatter,
  now: NowFn,
  ambiguousClock: AmbiguousClock,
  engine: TzEngine,
): PipelineOutput {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return { result: limitExceeded("input-length"), spans: [] };
  }

  const readings = enumerateReadings(lex(normalize(input), trie, ambiguousClock));
  if (readings === undefined) {
    return nothing();
  }

  const ctx = { instant: now(), engine };
  const evaluated: Reading[] = [];
  for (const reading of readings) {
    const tokens = rewrite(reading);
    const parsed = parse(tokens);
    if (parsed.ok) {
      evaluated.push({ result: evaluateAst(parsed.ast, ctx), tokens });
    } else if (parsed.limit !== undefined) {
      evaluated.push({ result: limitExceeded(parsed.limit), tokens });
    }
  }

  const succeeded = evaluated.filter((reading) => reading.result.ok);
  const winner =
    succeeded.find((reading) => readsInAsConverter(reading.tokens)) ?? succeeded[0] ?? evaluated[0];
  if (winner === undefined) {
    return nothing();
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

function isUnitless(ast: Ast): boolean {
  switch (ast.kind) {
    case "number":
      return true;
    case "unary":
    case "sqrt":
      return isUnitless(ast.inner);
    case "binary":
      return isUnitless(ast.left) && isUnitless(ast.right);
    default:
      return false;
  }
}

/** Parse and rank without evaluating, so coloring stays cheap. */
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

  const parsed: { ast: Ast; tokens: readonly Token[] }[] = [];
  for (const reading of readings) {
    const tokens = rewrite(reading);
    const result = parse(tokens);
    if (result.ok) {
      parsed.push({ ast: result.ast, tokens });
    }
  }

  const viableConverter = parsed.find(
    (reading) =>
      readsInAsConverter(reading.tokens) &&
      !(reading.ast.kind === "convert" && isUnitless(reading.ast.expr)),
  );
  const winner =
    viableConverter ?? parsed.find((reading) => !readsInAsConverter(reading.tokens)) ?? parsed[0];
  return winner === undefined ? [] : spansFor(winner.tokens);
}
