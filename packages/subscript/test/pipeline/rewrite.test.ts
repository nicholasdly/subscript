import { describe, expect, test } from "vitest";

import { lex } from "../../src/pipeline/lex.ts";
import { normalize } from "../../src/pipeline/normalize.ts";
import { enumerateReadings } from "../../src/pipeline/rank.ts";
import { rewrite } from "../../src/pipeline/rewrite.ts";
import type { Token } from "../../src/pipeline/token.ts";
import { trieFor } from "../../src/pipeline/trie.ts";

const trie = trieFor("en-US");

function readings(input: string): Token[][] {
  return enumerateReadings(lex(normalize(input), trie)) ?? [];
}

function hasUnit(tokens: readonly Token[], unitId: string): boolean {
  return tokens.some((token) => token.kind === "unit" && token.unitId === unitId);
}

describe("mixed customary length", () => {
  test("inserts + between feet and inches", () => {
    const inchReading = readings("5 ft 11 in").find((tokens) => hasUnit(tokens, "inch"));
    expect(inchReading).toBeDefined();
    const rewritten = rewrite(inchReading!);
    expect(rewritten.map((token) => token.kind)).toEqual([
      "number",
      "unit",
      "operator",
      "number",
      "unit",
    ]);
    expect(rewritten[2]?.raw).toBe("+");
  });

  test("the inserted + spans no source text", () => {
    const inchReading = readings("5 ft  11 in").find((tokens) => hasUnit(tokens, "inch"));
    expect(inchReading).toBeDefined();
    const plus = rewrite(inchReading!)[2];
    expect(plus?.start).toBe(plus?.end);
  });

  test("does not insert + between metres and centimetres", () => {
    const [only] = readings("5 m 11 cm");
    expect(only).toBeDefined();
    expect(rewrite(only!).some((token) => token.kind === "operator")).toBe(false);
  });
});
