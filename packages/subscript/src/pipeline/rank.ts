/**
 * Stage 3: expand ambiguous tokens into candidate readings.
 *
 * Today that is only `in` (converter vs inch). The conductor parses each
 * reading and picks a winner.
 */
import { MAX_READINGS } from "../limits.ts";
import type { LexToken, Token } from "./token.ts";

/**
 * Every combination of readings for the ambiguous tokens in the stream, or
 * `undefined` when there are too many to be worth trying.
 */
export function enumerateReadings(tokens: readonly LexToken[]): Token[][] | undefined {
  let rows: Token[][] = [[]];

  for (const token of tokens) {
    if (token.kind !== "ambiguous") {
      for (const row of rows) {
        row.push(token);
      }
      continue;
    }
    if (rows.length * 2 > MAX_READINGS) {
      return undefined;
    }
    const { start, end, raw } = token;
    const asConverter: Token = { start, end, raw, kind: "converter", converter: token.converter };
    const asUnit: Token = { start, end, raw, kind: "unit", unitId: token.unitId };
    rows = rows.flatMap((row) => [
      [...row, asConverter],
      [...row, asUnit],
    ]);
  }

  return rows;
}

/** The reading that spends `in` on a conversion wins whenever it evaluates. */
export function readsInAsConverter(tokens: readonly Token[]): boolean {
  return tokens.some((token) => token.kind === "converter" && token.converter === "in");
}
