import { MAX_READINGS } from "./limits.ts";
import { withoutAlt } from "./rewrite.ts";
import type { Ast, Token } from "./token.ts";

export function enumerateReadings(tokens: readonly Token[]): Token[][] | undefined {
  let rows: Token[][] = [[]];
  for (const token of tokens) {
    if (token.alt === undefined) {
      for (const row of rows) {
        row.push(token);
      }
      continue;
    }
    const next: Token[][] = [];
    for (const row of rows) {
      next.push([...row, withoutAlt(token)]);
      next.push([...row, withoutAlt(token.alt)]);
    }
    if (next.length > MAX_READINGS) {
      return undefined;
    }
    rows = next;
  }
  return rows;
}

export function scoreReading(tokens: readonly Token[], _ast: Ast): number {
  let score = 1;
  const usedIn = tokens.some(
    (token) => token.kind === "converter" && token.converter === "in",
  );
  if (usedIn) {
    score += 10;
  }
  return score;
}
