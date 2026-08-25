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

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * NFC can shorten the input, so normalize each grapheme and retain its original
 * offset. Most input is already NFC and needs no extra map.
 */
function normalizeNfc(input: string): { text: string; starts?: readonly number[] } {
  const text = input.normalize("NFC");
  if (text === input) {
    return { text };
  }

  const parts: string[] = [];
  const starts: number[] = [];
  for (const { segment, index } of graphemes.segment(input)) {
    const normalized = segment.normalize("NFC");
    parts.push(normalized);
    for (let unit = 0; unit < normalized.length; unit += 1) {
      starts.push(index);
    }
  }
  starts.push(input.length);
  return { text: parts.join(""), starts };
}

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
  const normalized = normalizeNfc(input);
  const source = normalized.text;
  const out: string[] = [];
  const starts: number[] = [];
  const sourceStart = (index: number): number => normalized.starts?.[index] ?? index;
  let index = 0;

  while (index < source.length) {
    const mer = meridiemDots(source, index);
    if (mer !== undefined) {
      out.push(mer);
      starts.push(sourceStart(index), sourceStart(index + 2));
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
      starts.push(sourceStart(index));
    }
    index += ch.length;
  }
  starts.push(input.length);

  return { text: out.join(""), starts };
}

export function sourceIndex(normalized: Normalized, index: number): number {
  return normalized.starts[index] ?? normalized.starts.at(-1) ?? 0;
}
