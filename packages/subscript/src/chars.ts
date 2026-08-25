const WHITESPACE = /\s/u;
const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;

/**
 * The whole code point at `index`, or `""` past the end. Surrogate pairs stay
 * intact, and `""` fails every predicate below, so callers can treat it as EOF.
 */
export function charAt(text: string, index: number): string {
  const code = text.codePointAt(index);
  return code === undefined ? "" : String.fromCodePoint(code);
}

export function isWhitespace(ch: string): boolean {
  return WHITESPACE.test(ch);
}

export function isLetter(ch: string): boolean {
  return LETTER.test(ch);
}

export function isMark(ch: string): boolean {
  return MARK.test(ch);
}

export function isAllLetters(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  for (const ch of text) {
    if (!isLetter(ch)) {
      return false;
    }
  }
  return true;
}

export function skipWhitespace(text: string, from: number): number {
  let i = from;
  for (;;) {
    const ch = charAt(text, i);
    if (ch === "" || !isWhitespace(ch)) {
      return i;
    }
    i += ch.length;
  }
}

/** Aliases are ASCII plus `°` and superscripts, so ASCII folding is enough. */
export function foldChar(ch: string): string {
  const code = ch.charCodeAt(0);
  return code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : ch;
}
