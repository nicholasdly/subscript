export type Normalized = {
  readonly text: string;
  /**
   * Source index of every character in `text`, plus one entry past the end, so
   * a token running from `i` to `j` maps to `starts[i]`..`starts[j]`.
   */
  readonly starts: readonly number[];
};

/** Characters rewritten before lexing. A replacement may be longer than one character. */
const REWRITES: Record<string, string> = {
  "\u2212": "-", // minus sign
  "\u00d7": "*", // multiplication sign
  "\u22c5": "*", // dot operator
  "\u00f7": "/", // division sign
  "\u27f6": "\u2192", // long rightwards arrow; the lexer knows one arrow
  "\u2103": "\u00b0C", // degree celsius
  "\u2109": "\u00b0F", // degree fahrenheit
};

export function normalize(input: string): Normalized {
  const source = input.normalize("NFC");
  const out: string[] = [];
  const starts: number[] = [];
  let index = 0;

  for (const ch of source) {
    const replacement = REWRITES[ch] ?? ch;
    out.push(replacement);
    // One entry per UTF-16 unit, because `text` is indexed that way.
    for (let unit = 0; unit < replacement.length; unit += 1) {
      starts.push(index);
    }
    index += ch.length;
  }
  starts.push(source.length);

  return { text: out.join(""), starts };
}

export function sourceIndex(normalized: Normalized, index: number): number {
  return normalized.starts[index] ?? 0;
}
