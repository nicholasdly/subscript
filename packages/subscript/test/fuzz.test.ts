import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript, type Result } from "../src/index.ts";
import { stubFetch } from "./fetch-stub.ts";

const SEED = 0x51b5c210;
const ALPHABET =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00b0";

function lcg(state: number): () => number {
  let current = state >>> 0;
  return () => {
    current = (Math.imul(current, 1664525) + 1013904223) >>> 0;
    return current;
  };
}

const FAILURE_KINDS = new Set([
  "not-an-expression",
  "dimension-mismatch",
  "unknown-unit",
  "ambiguous",
  "rate-unavailable",
  "rate-pending",
  "precision-loss",
  "limit-exceeded",
]);

function assertWellFormed(result: Result): void {
  assert.equal(typeof result, "object");
  assert.notEqual(result, null);
  assert.equal(typeof result.ok, "boolean");
  if (result.ok) {
    assert.equal(typeof result.text, "string");
    assert.equal(typeof result.value, "object");
  } else {
    assert.equal(typeof result.reason, "object");
    assert.ok(FAILURE_KINDS.has(result.reason.kind), result.reason.kind);
  }
}

test("seeded random strings never throw and always return a Result", async () => {
  const subscript = createSubscript({ fetch: stubFetch });
  const started = Date.now();
  const next = lcg(SEED);
  for (let n = 0; n < 1000; n++) {
    const length = next() % 65;
    let input = "";
    for (let i = 0; i < length; i++) {
      input += ALPHABET.charAt(next() % ALPHABET.length);
    }
    const result = await subscript.evaluate(input);
    assertWellFormed(result);
  }
  assert.ok(Date.now() - started < 5000, "fuzz exceeded 5s");
});
