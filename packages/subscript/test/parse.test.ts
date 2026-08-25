import assert from "node:assert/strict";
import { test } from "node:test";

import { lex } from "../src/lex.ts";
import { normalize } from "../src/normalize.ts";
import { parse } from "../src/parse.ts";
import { enumerateReadings } from "../src/rank.ts";
import { rewrite } from "../src/rewrite.ts";
import { trieFor } from "../src/units/trie.ts";

const trie = trieFor("en-US");

function ast(input: string) {
  const readings = enumerateReadings(lex(normalize(input), trie));
  assert.ok(readings);
  const converted = readings.find((tokens) =>
    tokens.some((token) => token.kind === "converter" && token.converter === "in"),
  );
  const tokens = rewrite(converted ?? readings[0]!);
  return parse(tokens);
}

test("3pm PST in Tokyo is convert-zone", () => {
  const result = ast("3pm PST in Tokyo");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.ast.kind, "convert-zone");
    if (result.ast.kind === "convert-zone") {
      assert.equal(result.ast.toZoneId, "asia-tokyo");
      assert.equal(result.ast.expr.kind, "zoned");
    }
  }
});

test("3pm PST is zoned without convert", () => {
  const result = ast("3pm PST");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.ast.kind, "zoned");
  }
});

test("now in Tokyo is convert-zone of now", () => {
  const result = ast("now in Tokyo");
  assert.equal(result.ok, true);
  if (result.ok && result.ast.kind === "convert-zone") {
    assert.equal(result.ast.expr.kind, "now");
    assert.equal(result.ast.toZoneId, "asia-tokyo");
  }
});

test("quantity parse is unchanged for 20 c to f", () => {
  const result = ast("20 c to f");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.ast.kind, "convert");
  }
});
