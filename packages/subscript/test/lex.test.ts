import assert from "node:assert/strict";
import { test } from "node:test";

import { lex } from "../src/lex.ts";
import { normalize } from "../src/normalize.ts";
import { buildTrie } from "../src/units/trie.ts";

const trie = buildTrie("en-US");

function tokens(input: string) {
  return lex(normalize(input), trie);
}

test("min is minute, not metre", () => {
  const [number, unit] = tokens("1 min");
  assert.equal(number?.kind, "number");
  assert.equal(unit?.kind, "unit");
  assert.equal(unit?.unitId, "minute");
});

test("m in ft: m is metre, in is ambiguous", () => {
  const result = tokens("1 m in ft");
  assert.equal(result[1]?.kind, "unit");
  assert.equal(result[1]?.unitId, "metre");
  assert.equal(result[2]?.kind, "converter");
  assert.equal(result[2]?.converter, "in");
  assert.equal(result[2]?.alt?.kind, "unit");
  assert.equal(result[2]?.alt?.unitId, "inch");
  assert.equal(result[3]?.kind, "unit");
  assert.equal(result[3]?.unitId, "foot");
});

test("2km is number then kilometre", () => {
  const result = tokens("2km");
  assert.equal(result.length, 2);
  assert.equal(result[0]?.kind, "number");
  assert.equal(result[0]?.value, 2);
  assert.equal(result[1]?.kind, "unit");
  assert.equal(result[1]?.unitId, "kilometre");
});

test("offsets for 20 c to f match the original string", () => {
  const result = tokens("20 c to f");
  assert.deepEqual(
    result.map((token) => ({ start: token.start, end: token.end, kind: token.kind })),
    [
      { start: 0, end: 2, kind: "number" },
      { start: 3, end: 4, kind: "unit" },
      { start: 5, end: 7, kind: "converter" },
      { start: 8, end: 9, kind: "unit" },
    ],
  );
});

test("minimum does not match min", () => {
  const result = tokens("minimum");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "unknown");
});
