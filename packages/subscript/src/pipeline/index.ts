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
  type EvalValue,
  type LimitName,
  type NowFn,
  type Outcome,
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
import type { Token } from "./token.ts";
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
    default: {
      const _never: never = token;
      return _never;
    }
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

type Reading = {
  readonly result: Outcome<EvalValue>;
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
  if (!winner.result.ok || isZonedTime(winner.result.value)) {
    return [];
  }
  const winnerValue = winner.result.value;
  const alternates: Alternate[] = [];
  for (const reading of succeeded) {
    if (
      reading === winner ||
      !reading.result.ok ||
      isZonedTime(reading.result.value) ||
      sameQuantity(reading.result.value, winnerValue)
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
  outcome: Extract<Outcome<EvalValue>, { ok: true }>,
  format: Formatter,
): Extract<Result, { ok: true }> {
  return { ok: true, value: outcome.value, text: format(outcome.value) };
}

/** Prefer a reading that spends `in` as a converter; otherwise the first candidate. */
function preferConverter<T extends { tokens: readonly Token[] }>(
  candidates: readonly T[],
): T | undefined {
  return candidates.find((candidate) => readsInAsConverter(candidate.tokens)) ?? candidates[0];
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
  const evaluated: Reading[] = [];
  for (const tokens of readings) {
    const parsed = parse(tokens);
    if (parsed.ok) {
      evaluated.push({ result: evaluateAst(parsed.ast, ctx), tokens });
    } else if (parsed.limit !== undefined) {
      evaluated.push({ result: limitExceeded(parsed.limit), tokens });
    }
  }

  const succeeded = evaluated.filter((reading) => reading.result.ok);
  const winner = preferConverter(succeeded) ?? evaluated[0];
  if (winner === undefined) {
    return notAnExpression();
  }
  if (!winner.result.ok) {
    return winner.result;
  }

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

  const parsed: { tokens: readonly Token[] }[] = [];
  for (const tokens of readings) {
    const result = parse(tokens);
    if (result.ok) {
      parsed.push({ tokens });
    }
  }

  const winner = preferConverter(parsed);
  return winner === undefined ? [] : spansFor(winner.tokens);
}
