import assert from "node:assert/strict";
import { test } from "node:test";

import { lex } from "../src/lex.ts";
import { normalize } from "../src/normalize.ts";
import { enumerateReadings } from "../src/rank.ts";
import { rewrite } from "../src/rewrite.ts";
import type { Token } from "../src/token.ts";
import { trieFor } from "../src/units/trie.ts";

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

test("swaps prefix $ before a number", () => {
  const [only] = readings("$100");
  assert.ok(only);
  const rewritten = rewrite(only);
  assert.equal(rewritten[0]?.kind, "number");
  assert.equal(rewritten[1]?.kind, "unit");
  if (rewritten[1]?.kind === "unit") {
    assert.equal(rewritten[1].unitId, "usd");
  }
});

test("does not swap usd before a number", () => {
  const [only] = readings("usd 100");
  assert.ok(only);
  const rewritten = rewrite(only);
  assert.equal(rewritten[0]?.kind, "unit");
  assert.equal(rewritten[1]?.kind, "number");
});

test("does not treat non-currency symbols as prefixes", () => {
  for (const input of ["\u00b0C 20", "m\u00b2 2"]) {
    const [only] = readings(input);
    assert.ok(only);
    const rewritten = rewrite(only);
    assert.equal(rewritten[0]?.kind, "unit");
    assert.equal(rewritten[1]?.kind, "number");
  }
});
