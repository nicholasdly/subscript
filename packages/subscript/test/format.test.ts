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

test("float noise that is not an integer rounds to six significant figures", () => {
  assert.equal(formatQuantity(q(27.939999999999998)), "27.94 m");
});

test("conversions round to six significant figures", () => {
  assert.equal(formatQuantity(q(1 / 0.3048, "foot", "ft")), "3.28084 ft");
  assert.equal(formatQuantity(q(3.785411784, "litre", "L")), "3.78541 L");
});

test("compact thousand is on by default for dimensionless values", () => {
  assert.equal(formatQuantity(q(1000, "1", "")), "1k");
});

test("compact can be turned off", () => {
  assert.equal(formatQuantity(q(1000, "1", ""), { compact: false }), "1000");
});

test("compact does not attach to a unit", () => {
  assert.equal(formatQuantity(q(1000)), "1000 m");
});

test("compact million uses M", () => {
  assert.equal(formatQuantity(q(3.3e6, "1", "")), "3.3M");
});

test("metre-squared keeps its symbol", () => {
  assert.equal(formatQuantity(q(100, "metre-squared", "m\u00b2")), "100 m\u00b2");
});

test("negative zero prints as 0", () => {
  assert.equal(formatQuantity(q(-0, "1", "")), "0");
});

test("usd uses currency style, not six sig figs", () => {
  assert.equal(formatQuantity(q(1, "usd", "$")), "$1.00");
  assert.equal(formatQuantity(q(1.5, "usd", "$")), "$1.50");
});

test("jpy has no minor unit", () => {
  assert.equal(formatQuantity(q(1, "jpy", "¥")), "¥1");
});

test("compact thousand on money uses k", () => {
  assert.equal(formatQuantity(q(1500, "usd", "$")), "$1.5k");
});

test("compact off prints money with fraction digits", () => {
  assert.equal(formatQuantity(q(1500, "usd", "$"), { compact: false }), "$1500.00");
});

test("compact billion on money uses B not G", () => {
  assert.equal(formatQuantity(q(1e9, "usd", "$")), "$1B");
});
