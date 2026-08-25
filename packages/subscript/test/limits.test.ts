import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript } from "../src/index.ts";
import { INPUT_LENGTH_LIMIT, NODE_COUNT_LIMIT, PARSE_DEPTH_LIMIT } from "../src/limits.ts";

const subscript = createSubscript();

test("257 characters is input-length", async () => {
  const result = await subscript.evaluate("x".repeat(INPUT_LENGTH_LIMIT + 1));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, "limit-exceeded");
    if (result.reason.kind === "limit-exceeded") {
      assert.equal(result.reason.limit, "input-length");
    }
  }
});

test("256 characters is not an input-length failure", async () => {
  const result = await subscript.evaluate("x".repeat(INPUT_LENGTH_LIMIT));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.notEqual(result.reason.kind, "limit-exceeded");
  }
});

test("33 nested parens is parse-depth", async () => {
  const depth = PARSE_DEPTH_LIMIT + 1;
  const input = `${"(".repeat(depth)}1${")".repeat(depth)}`;
  const result = await subscript.evaluate(input);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, "limit-exceeded");
    if (result.reason.kind === "limit-exceeded") {
      assert.equal(result.reason.limit, "parse-depth");
    }
  }
});

test("a long addition chain is node-count", async () => {
  const ones = Math.ceil((NODE_COUNT_LIMIT + 3) / 2);
  const input = Array.from({ length: ones }, () => "1").join("+");
  const result = await subscript.evaluate(input);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, "limit-exceeded");
    if (result.reason.kind === "limit-exceeded") {
      assert.equal(result.reason.limit, "node-count");
    }
  }
});
