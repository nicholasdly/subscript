import assert from "node:assert/strict";
import { test } from "node:test";

import { formatQuantity } from "../src/format.ts";
import type { Quantity } from "../src/index.ts";

function q(value: number, id = "metre", symbol = "m"): Quantity {
  return { value, unit: { id, symbol } };
}

test("a dimensionless quantity prints without a symbol", () => {
  assert.equal(formatQuantity(q(20, "1", "")), "20");
});

test("float noise near an integer prints as the integer", () => {
  assert.equal(formatQuantity(q(67.99999999999999)), "68 m");
  assert.equal(formatQuantity(q(9270.999999999998)), "9271 m");
});

test("the nudge is relative, so small magnitudes survive", () => {
  assert.equal(formatQuantity(q(1e-13)), "1e-13 m");
  assert.equal(formatQuantity(q(0.5)), "0.5 m");
  assert.equal(formatQuantity(q(0)), "0 m");
});

test("a value that is not near an integer prints in full", () => {
  assert.equal(formatQuantity(q(27.939999999999998)), "27.939999999999998 m");
});
