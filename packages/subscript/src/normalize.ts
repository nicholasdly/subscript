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

function meridiemDots(source: string, index: number): "am" | "pm" | undefined {
  if (source.charAt(index + 1) !== "." || source.charAt(index + 3) !== ".") {
    return undefined;
  }
  const first = source.charAt(index).toLowerCase();
  const third = source.charAt(index + 2).toLowerCase();
  if (third !== "m") {
    return undefined;
  }
  if (first === "a") {
    return "am";
  }
  if (first === "p") {
    return "pm";
  }
  return undefined;
}

export function normalize(input: string): Normalized {
  const source = input.normalize("NFC");
  const out: string[] = [];
  const starts: number[] = [];
  let index = 0;

  while (index < source.length) {
    const mer = meridiemDots(source, index);
    if (mer !== undefined) {
      out.push(mer);
      starts.push(index, index + 2);
      index += 4;
      continue;
    }
    const code = source.codePointAt(index);
    if (code === undefined) {
      break;
    }
    const ch = String.fromCodePoint(code);
    const replacement = REWRITES[ch] ?? ch;
    out.push(replacement);
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
