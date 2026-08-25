import { charAt, isLetter, isMark, skipWhitespace } from "./chars.ts";
import { sourceIndex, type Normalized } from "./normalize.ts";
import type { LexToken, Located, OperatorChar } from "./token.ts";
import { UPPERCASE_ONLY_IDS } from "./units/aliases.ts";
import { matchTrie, type TrieNode, type TrieValue } from "./units/trie.ts";

const OPERATORS: readonly OperatorChar[] = ["+", "-", "*", "/", "^", "(", ")"];

/** Operators are single ASCII characters, so a plain character compare is enough. */
function operatorAt(text: string, index: number): OperatorChar | undefined {
  const ch = text.charAt(index);
  return OPERATORS.find((operator) => operator === ch);
}

function unitIdOf(value: TrieValue): string | undefined {
  if (value.kind === "unit" || value.kind === "ambiguous") {
    return value.unitId;
  }
  return undefined;
}

/** English-word ISO codes match only as three ASCII capitals. */
function rejectedCase(value: TrieValue, raw: string): boolean {
  const unitId = unitIdOf(value);
  return unitId !== undefined && UPPERCASE_ONLY_IDS.has(unitId) && !/^[A-Z]{3}$/.test(raw);
}

function isDigit(text: string, index: number): boolean {
  const code = text.charCodeAt(index);
  return code >= 48 && code <= 57;
}

/**
 * ASCII digits with at most one `.` and an optional `e`/`E` exponent.
 * No sign on the mantissa (unary minus is Pratt). Incomplete exponents
 * (`1e`, `1e+`) are left for the next token. Overflow is still a number.
 */
function readNumber(text: string, from: number): { value: number; end: number } | undefined {
  let i = from;
  let digits = 0;
  while (isDigit(text, i)) {
    i += 1;
    digits += 1;
  }
  if (text.charAt(i) === ".") {
    i += 1;
    while (isDigit(text, i)) {
      i += 1;
      digits += 1;
    }
  }
  if (digits === 0) {
    return undefined;
  }
  const e = text.charAt(i);
  if (e === "e" || e === "E") {
    let j = i + 1;
    const sign = text.charAt(j);
    if (sign === "+" || sign === "-") {
      j += 1;
    }
    const expStart = j;
    while (isDigit(text, j)) {
      j += 1;
    }
    if (j > expStart) {
      i = j;
    }
  }
  return { value: Number(text.slice(from, i)), end: i };
}

/** A maximal run of letters and marks, or the single character that starts it. */
function readUnknown(text: string, from: number): number {
  const first = charAt(text, from);
  if (!isLetter(first) && !isMark(first)) {
    return from + first.length;
  }
  let i = from;
  for (;;) {
    const ch = charAt(text, i);
    if (!isLetter(ch) && !isMark(ch)) {
      return i;
    }
    i += ch.length;
  }
}

export function lex(normalized: Normalized, trie: TrieNode): LexToken[] {
  const { text } = normalized;
  const tokens: LexToken[] = [];
  let i = 0;

  const at = (from: number, to: number): Located => ({
    start: sourceIndex(normalized, from),
    end: sourceIndex(normalized, to),
    raw: text.slice(from, to),
  });

  while (i < text.length) {
    i = skipWhitespace(text, i);
    if (i >= text.length) {
      break;
    }

    const number = readNumber(text, i);
    if (number !== undefined) {
      tokens.push({ ...at(i, number.end), kind: "number", value: number.value });
      i = number.end;
      continue;
    }

    const match = matchTrie(trie, text, i);
    if (match !== undefined) {
      const end = i + match.length;
      const located = at(i, end);
      const { value } = match;
      if (!rejectedCase(value, located.raw)) {
        switch (value.kind) {
          case "unit":
            tokens.push({ ...located, kind: "unit", unitId: value.unitId });
            break;
          case "converter":
            tokens.push({ ...located, kind: "converter", converter: value.converter });
            break;
          case "ambiguous":
            tokens.push({
              ...located,
              kind: "ambiguous",
              converter: value.converter,
              unitId: value.unitId,
            });
            break;
          case "function":
            // `sqrt` is a function only when a `(` follows; otherwise it is a word.
            tokens.push(
              charAt(text, skipWhitespace(text, end)) === "("
                ? { ...located, kind: "function", name: value.name }
                : { ...located, kind: "unknown" },
            );
            break;
        }
        i = end;
        continue;
      }
    }

    const op = operatorAt(text, i);
    if (op !== undefined) {
      tokens.push({ ...at(i, i + 1), kind: "operator", op });
      i += 1;
      continue;
    }

    const end = readUnknown(text, i);
    tokens.push({ ...at(i, end), kind: "unknown" });
    i = end;
  }

  return tokens;
}
