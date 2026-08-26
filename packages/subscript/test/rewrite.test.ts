import assert from "node:assert/strict";
import { test } from "node:test";

import { lex } from "../src/pipeline/lex.ts";
import { normalize } from "../src/pipeline/normalize.ts";
import { enumerateReadings } from "../src/pipeline/rank.ts";
import { rewrite } from "../src/pipeline/rewrite.ts";
import type { Token } from "../src/pipeline/token.ts";
import { trieFor } from "../src/pipeline/trie.ts";

const trie = trieFor("en-US");

function readings(input: string): Token[][] {
  return enumerateReadings(lex(normalize(input), trie)) ?? [];
}

function hasUnit(tokens: readonly Token[], unitId: string): boolean {
  return tokens.some((token) => token.kind === "unit" && token.unitId === unitId);
}

test("inserts + between feet and inches", () => {
  const inchReading = readings("5 ft 11 in").find((tokens) => hasUnit(tokens, "inch"));
  assert.ok(inchReading);
  const rewritten = rewrite(inchReading);
  assert.deepEqual(
    rewritten.map((token) => token.kind),
    ["number", "unit", "operator", "number", "unit"],
  );
  assert.equal(rewritten[2]?.raw, "+");
});

test("the inserted + spans no source text", () => {
  const inchReading = readings("5 ft  11 in").find((tokens) => hasUnit(tokens, "inch"));
  assert.ok(inchReading);
  const plus = rewrite(inchReading)[2];
  assert.equal(plus?.start, plus?.end);
});

test("does not insert + between metres and centimetres", () => {
  const [only] = readings("5 m 11 cm");
  assert.ok(only);
  assert.equal(
    rewrite(only).some((token) => token.kind === "operator"),
    false,
  );
});
