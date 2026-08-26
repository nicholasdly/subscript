/**
 * Stage 4: token-stream rewrites that keep the grammar small.
 *
 * `5 ft 11 in` becomes `5 ft + 11 in`. The inserted `+` spans no source text.
 */
import type { Token } from "./token.ts";

/**
 * The inserted `+` stands for no source text, so it spans nothing and `spans()`
 * leaves the whitespace between the two quantities uncoloured.
 */
function implicitPlus(after: Token): Token {
  return { kind: "operator", op: "+", start: after.end, end: after.end, raw: "+" };
}

/** `5 ft 11 in` means `5 ft + 11 in`. */
export function rewrite(tokens: readonly Token[]): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const feet = tokens[i];
    const foot = tokens[i + 1];
    const inches = tokens[i + 2];
    const inch = tokens[i + 3];
    if (
      feet?.kind === "number" &&
      foot?.kind === "unit" &&
      foot.unitId === "foot" &&
      inches?.kind === "number" &&
      inch?.kind === "unit" &&
      inch.unitId === "inch"
    ) {
      out.push(feet, foot, implicitPlus(foot), inches, inch);
      i += 4;
      continue;
    }
    if (feet !== undefined) {
      out.push(feet);
    }
    i += 1;
  }

  return out;
}
