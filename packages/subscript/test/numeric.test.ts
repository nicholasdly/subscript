import assert from "node:assert/strict";
import { test } from "node:test";

import { add, div, isFiniteNumber, mul, sqrt, sub } from "../src/numeric.ts";

test("add, sub, mul, div wrap float64 arithmetic", () => {
  assert.equal(add(2, 3), 5);
  assert.equal(sub(5, 3), 2);
  assert.equal(mul(4, 2.5), 10);
  assert.equal(div(9, 3), 3);
});

test("sqrt wraps Math.sqrt", () => {
  assert.equal(sqrt(9), 3);
});

test("isFiniteNumber rejects NaN and infinities", () => {
  assert.equal(isFiniteNumber(0), true);
  assert.equal(isFiniteNumber(1.5), true);
  assert.equal(isFiniteNumber(NaN), false);
  assert.equal(isFiniteNumber(Infinity), false);
  assert.equal(isFiniteNumber(-Infinity), false);
});
