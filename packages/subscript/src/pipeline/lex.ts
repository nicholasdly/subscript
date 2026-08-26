import { isValidOffset, offsetZoneId } from "../time/index.ts";
import type { AmbiguousClock } from "../types.ts";
import { charAt, foldChar, isLetter, isMark, skipWhitespace } from "./chars.ts";
import { sourceIndex, type Normalized } from "./normalize.ts";
import type { LexToken, Located, OperatorChar } from "./token.ts";
import { matchTrie, type TrieNode } from "./trie.ts";

/**
 * Stage 2: string → tokens.
 *
 * Numbers, clocks, UTC offsets, operators, then leftmost-longest trie match
 * for units, converters, zones, and `now`. `in` is flagged ambiguous (converter
 * or inch); `rank.ts` expands those readings.
 */

const OPERATORS: readonly OperatorChar[] = ["+", "-", "*", "/", "^", "(", ")"];

/** Operators are single ASCII characters, so a plain character compare is enough. */
function operatorAt(text: string, index: number): OperatorChar | undefined {
  const ch = text.charAt(index);
  return OPERATORS.find((operator) => operator === ch);
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

function foldedSlice(text: string, from: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += foldChar(charAt(text, from + i));
  }
  return out;
}

function meridiemAt(text: string, from: number): { mer: "am" | "pm"; end: number } | undefined {
  const start = skipWhitespace(text, from);
  const pair = foldedSlice(text, start, 2);
  if (pair !== "am" && pair !== "pm") {
    return undefined;
  }
  const end = start + 2;
  if (isLetter(charAt(text, end))) {
    return undefined;
  }
  return { mer: pair, end };
}

function clockFollowsHour(text: string, hourEnd: number): boolean {
  if (text.charAt(hourEnd) === ":") {
    return true;
  }
  return meridiemAt(text, hourEnd) !== undefined;
}

function applyMeridiem(
  hour: number,
  minute: number,
  second: number,
  mer: "am" | "pm" | undefined,
  ambiguousClock: AmbiguousClock,
): { hour: number; minute: number; second: number } | undefined {
  if (mer !== undefined) {
    if (hour === 0 || hour > 12) {
      return undefined;
    }
    if (hour === 12) {
      return { hour: mer === "am" ? 0 : 12, minute, second };
    }
    return { hour: mer === "pm" ? hour + 12 : hour, minute, second };
  }
  if (ambiguousClock === "preferDaytime" && hour >= 1 && hour <= 6) {
    return { hour: hour + 12, minute, second };
  }
  return { hour, minute, second };
}

function readClock(
  text: string,
  from: number,
  ambiguousClock: AmbiguousClock,
): { hour: number; minute: number; second: number; end: number } | undefined {
  if (!isDigit(text, from)) {
    return undefined;
  }

  let hourEnd = from + 1;
  let hour = Number(text.charAt(from));
  if (isDigit(text, from + 1)) {
    const two = Number(text.slice(from, from + 2));
    const afterTwo = from + 2;
    if (two <= 23 && clockFollowsHour(text, afterTwo)) {
      hour = two;
      hourEnd = afterTwo;
    } else if (!clockFollowsHour(text, hourEnd)) {
      return undefined;
    }
  } else if (!clockFollowsHour(text, hourEnd)) {
    return undefined;
  }

  let i = hourEnd;
  let minute = 0;
  let second = 0;
  let hasColon = false;
  if (text.charAt(i) === ":") {
    if (!isDigit(text, i + 1) || !isDigit(text, i + 2)) {
      return undefined;
    }
    minute = Number(text.slice(i + 1, i + 3));
    if (minute > 59) {
      return undefined;
    }
    hasColon = true;
    i += 3;
    if (text.charAt(i) === ":") {
      if (!isDigit(text, i + 1) || !isDigit(text, i + 2)) {
        return undefined;
      }
      second = Number(text.slice(i + 1, i + 3));
      if (second > 59) {
        return undefined;
      }
      i += 3;
    }
  }

  const mer = meridiemAt(text, i);
  if (!hasColon && mer === undefined) {
    return undefined;
  }
  const applied = applyMeridiem(hour, minute, second, mer?.mer, ambiguousClock);
  if (applied === undefined) {
    return undefined;
  }
  return { ...applied, end: mer === undefined ? i : mer.end };
}

function readHourMinutes(
  text: string,
  from: number,
): { hours: number; minutes: number; end: number } | undefined {
  if (!isDigit(text, from)) {
    return undefined;
  }
  let i = from + 1;
  let hours = Number(text.charAt(from));
  if (isDigit(text, i)) {
    hours = Number(text.slice(from, i + 1));
    i += 1;
  }
  if (!isValidOffset(hours, 0)) {
    return undefined;
  }
  let minutes = 0;
  if (isDigit(text, i)) {
    if (i - from !== 2 || !isDigit(text, i + 1) || isDigit(text, i + 2)) {
      return undefined;
    }
    minutes = Number(text.slice(i, i + 2));
    if (!isValidOffset(hours, minutes)) {
      return undefined;
    }
    return { hours, minutes, end: i + 2 };
  }
  if (text.charAt(i) === ":") {
    if (!isDigit(text, i + 1) || !isDigit(text, i + 2)) {
      return undefined;
    }
    minutes = Number(text.slice(i + 1, i + 3));
    if (!isValidOffset(hours, minutes)) {
      return undefined;
    }
    i += 3;
  }
  return { hours, minutes, end: i };
}

function readOffsetZone(text: string, from: number): { zoneId: string; end: number } | undefined {
  const first = foldChar(charAt(text, from));
  if (first === "z" && !isLetter(charAt(text, from + 1))) {
    return { zoneId: offsetZoneId(0), end: from + 1 };
  }

  const prefix = foldedSlice(text, from, 3);
  if (prefix !== "utc" && prefix !== "gmt") {
    return undefined;
  }
  let i = from + 3;
  if (isLetter(charAt(text, i))) {
    return undefined;
  }
  const sign = text.charAt(i);
  if (sign !== "+" && sign !== "-") {
    return { zoneId: offsetZoneId(0), end: i };
  }
  const rest = readHourMinutes(text, i + 1);
  if (rest === undefined) {
    return undefined;
  }
  const offsetMinutes = (rest.hours * 60 + rest.minutes) * (sign === "-" ? -1 : 1);
  return { zoneId: offsetZoneId(offsetMinutes), end: rest.end };
}

/**
 * Tokenize a normalized string. `in` is an `ambiguous` token (converter or
 * inch); `enumerateReadings` splits those before parse.
 */
export function lex(
  normalized: Normalized,
  trie: TrieNode,
  ambiguousClock: AmbiguousClock = "literal24",
): LexToken[] {
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

    const clock = readClock(text, i, ambiguousClock);
    if (clock !== undefined) {
      tokens.push({
        ...at(i, clock.end),
        kind: "clock",
        hour: clock.hour,
        minute: clock.minute,
        second: clock.second,
      });
      i = clock.end;
      continue;
    }

    const offset = readOffsetZone(text, i);
    if (offset !== undefined) {
      tokens.push({ ...at(i, offset.end), kind: "timezone", zoneId: offset.zoneId });
      i = offset.end;
      continue;
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
          tokens.push(
            charAt(text, skipWhitespace(text, end)) === "("
              ? { ...located, kind: "function", name: value.name }
              : { ...located, kind: "unknown" },
          );
          break;
        case "timezone":
          tokens.push({ ...located, kind: "timezone", zoneId: value.zoneId });
          break;
        case "now":
          tokens.push({ ...located, kind: "now" });
          break;
      }
      i = end;
      continue;
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
