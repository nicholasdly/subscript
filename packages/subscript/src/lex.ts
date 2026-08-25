import type { Normalized } from "./normalize.ts";
import type { ConverterWord, OperatorChar, Token } from "./token.ts";
import { isLetter } from "./units/aliases.ts";
import { matchTrie, type TrieNode } from "./units/trie.ts";

const OPERATORS = new Set<string>(["+", "-", "*", "/", "^", "(", ")"]);

function isWhitespace(ch: string): boolean {
  return /\s/u.test(ch);
}

function isMark(ch: string): boolean {
  return /\p{M}/u.test(ch);
}

function origSpan(
  map: number[],
  origLength: number,
  start: number,
  end: number,
): { start: number; end: number } {
  if (start >= end) {
    const at = start < map.length ? map[start] : origLength;
    return { start: at ?? origLength, end: at ?? origLength };
  }
  const origStart = map[start] ?? origLength;
  const origEnd = end >= map.length ? origLength : (map[end] ?? origLength);
  return { start: origStart, end: Math.max(origEnd, origStart) };
}

function skipWs(text: string, i: number): number {
  let j = i;
  while (j < text.length) {
    const cp = text.codePointAt(j);
    if (cp === undefined) {
      break;
    }
    const ch = String.fromCodePoint(cp);
    if (!isWhitespace(ch)) {
      break;
    }
    j += ch.length;
  }
  return j;
}

function parseNumber(text: string, start: number): { value: number; end: number } | undefined {
  let i = start;
  let sawDigit = false;
  while (i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) {
    sawDigit = true;
    i += 1;
  }
  if (i < text.length && text.charAt(i) === ".") {
    i += 1;
    while (i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) {
      sawDigit = true;
      i += 1;
    }
  }
  if (!sawDigit) {
    return undefined;
  }
  if (i === start) {
    return undefined;
  }
  const raw = text.slice(start, i);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return { value, end: i };
}

function peekNonWs(text: string, i: number): string {
  const j = skipWs(text, i);
  if (j >= text.length) {
    return "";
  }
  return String.fromCodePoint(text.codePointAt(j) ?? 32);
}

function unknownRun(text: string, start: number): number {
  const first = String.fromCodePoint(text.codePointAt(start) ?? 32);
  if (!isLetter(first) && !isMark(first)) {
    return start + first.length;
  }
  let i = start;
  while (i < text.length) {
    const ch = String.fromCodePoint(text.codePointAt(i) ?? 32);
    if (!isLetter(ch) && !isMark(ch)) {
      break;
    }
    i += ch.length;
  }
  return i;
}

function tokenAt(
  kind: Token["kind"],
  raw: string,
  span: { start: number; end: number },
  extra: Partial<Token> = {},
): Token {
  return {
    kind,
    start: span.start,
    end: span.end,
    raw,
    ...extra,
  };
}

export function lex(normalized: Normalized, trie: TrieNode): Token[] {
  const { text, map, origLength } = normalized;
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    i = skipWs(text, i);
    if (i >= text.length) {
      break;
    }

    const num = parseNumber(text, i);
    if (num !== undefined) {
      const span = origSpan(map, origLength, i, num.end);
      tokens.push(tokenAt("number", text.slice(i, num.end), span, { value: num.value }));
      i = num.end;
      continue;
    }

    const hit = matchTrie(trie, text, i);
    if (hit !== undefined) {
      const end = i + hit.length;
      const span = origSpan(map, origLength, i, end);
      const raw = text.slice(i, end);
      if (hit.kind === "function") {
        if (peekNonWs(text, end) === "(") {
          tokens.push(tokenAt("function", raw, span, { name: "sqrt" }));
        } else {
          tokens.push(tokenAt("unknown", raw, span));
        }
        i = end;
        continue;
      }
      if (hit.kind === "ambiguous") {
        const unit: Token = tokenAt("unit", raw, span, { unitId: hit.unitId });
        const converter: Token = tokenAt("converter", raw, span, {
          converter: hit.converter,
          alt: unit,
        });
        tokens.push(converter);
        i = end;
        continue;
      }
      if (hit.kind === "unit") {
        tokens.push(tokenAt("unit", raw, span, { unitId: hit.unitId }));
        i = end;
        continue;
      }
      tokens.push(tokenAt("converter", raw, span, { converter: hit.converter }));
      i = end;
      continue;
    }

    const ch = String.fromCodePoint(text.codePointAt(i) ?? 32);
    if (OPERATORS.has(ch)) {
      const end = i + ch.length;
      tokens.push(
        tokenAt("operator", ch, origSpan(map, origLength, i, end), {
          op: ch as OperatorChar,
        }),
      );
      i = end;
      continue;
    }

    const end = unknownRun(text, i);
    tokens.push(tokenAt("unknown", text.slice(i, end), origSpan(map, origLength, i, end)));
    i = end;
  }

  return tokens;
}

export type { ConverterWord };
