/**
 * The evaluation pipeline.
 *
 *   normalize → lex → readings → parse → eval → format
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
import type { Ast, Token } from "./token.ts";
import type { TrieNode } from "./trie.ts";

function notAnExpression(): Result {
  return { ok: false, reason: { kind: "not-an-expression" } };
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

/** Zero-width tokens (if any) span nothing, so they colour nothing. */
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

type EvaluatedReading = {
  readonly result: Result;
  readonly tokens: readonly Token[];
};

type ParsedReading = {
  readonly ast: Ast;
  readonly tokens: readonly Token[];
};

function sameQuantity(a: Quantity, b: Quantity): boolean {
  return a.unit.id === b.unit.id && a.value === b.value;
}

/** Other readings that also evaluated, to a different answer than the winner's. */
function alternatesFor(
  winner: EvaluatedReading,
  succeeded: readonly EvaluatedReading[],
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

/**
 * Eval winner: a converter reading that evaluated, else the first success.
 * Spans winner: a converter reading that parsed and is not unitless-`in`.
 *
 * Highlighting does not evaluate, so the rules differ on purpose. Keep them
 * next to each other so `in` vs inch cannot drift in only one path.
 */
function evalWinner(evaluated: readonly EvaluatedReading[]): EvaluatedReading | undefined {
  const succeeded = evaluated.filter((reading) => reading.result.ok);
  return (
    succeeded.find((reading) => readsInAsConverter(reading.tokens)) ?? succeeded[0] ?? evaluated[0]
  );
}

function spansWinner(parsed: readonly ParsedReading[]): ParsedReading | undefined {
  const viableConverter = parsed.find(
    (reading) =>
      readsInAsConverter(reading.tokens) &&
      !(reading.ast.kind === "convert" && isUnitless(reading.ast.expr)),
  );
  return (
    viableConverter ?? parsed.find((reading) => !readsInAsConverter(reading.tokens)) ?? parsed[0]
  );
}

/**
 * Run normalize → lex → readings → parse → eval → format.
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
): Result {
  if (input.length > INPUT_LENGTH_LIMIT) {
    return limitExceeded("input-length");
  }

  const readings = enumerateReadings(lex(normalize(input), trie, ambiguousClock));
  if (readings === undefined) {
    return notAnExpression();
  }

  const ctx = { instant: now(), engine };
  const evaluated: EvaluatedReading[] = [];
  for (const tokens of readings) {
    const parsed = parse(tokens);
    if (parsed.ok) {
      evaluated.push({ result: evaluateAst(parsed.ast, ctx), tokens });
    } else if (parsed.limit !== undefined) {
      evaluated.push({ result: limitExceeded(parsed.limit), tokens });
    }
  }

  const winner = evalWinner(evaluated);
  if (winner === undefined) {
    return notAnExpression();
  }
  if (!winner.result.ok) {
    return winner.result;
  }

  const succeeded = evaluated.filter((reading) => reading.result.ok);
  const result = withFormat(winner.result, format);
  const alternates = alternatesFor(winner, succeeded, format);
  return alternates.length > 0 ? { ...result, alternates } : result;
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

  const parsed: ParsedReading[] = [];
  for (const tokens of readings) {
    const result = parse(tokens);
    if (result.ok) {
      parsed.push({ ast: result.ast, tokens });
    }
  }

  const winner = spansWinner(parsed);
  return winner === undefined ? [] : spansFor(winner.tokens);
}
