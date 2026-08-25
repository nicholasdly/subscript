import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dimension,
  dimensionsEqual,
  mulDimensions,
  rational,
  rationalsEqual,
  scaleDimension,
} from "../src/dimension.ts";
import { AREA, LENGTH } from "../src/units/kinds.ts";

test("rational reduces by gcd and normalizes sign", () => {
  assert.deepEqual(rational(2, 4), { n: 1, d: 2 });
  assert.deepEqual(rational(-2, -4), { n: 1, d: 2 });
  assert.deepEqual(rational(2, -4), { n: -1, d: 2 });
  assert.deepEqual(rational(0, 4), { n: 0, d: 1 });
});

test("rationalsEqual compares reduced pairs", () => {
  assert.equal(rationalsEqual(rational(2, 4), rational(1, 2)), true);
  assert.equal(rationalsEqual(rational(1, 2), rational(1, 3)), false);
});

test("metre × metre is area, sqrt(area) is length", () => {
  const m2 = mulDimensions(LENGTH, LENGTH);
  assert.equal(dimensionsEqual(m2, AREA), true);
  const root = scaleDimension(m2, rational(1, 2));
  assert.equal(dimensionsEqual(root, LENGTH), true);
});

test("dimension() defaults to all-zero exponents", () => {
  const none = dimension();
  assert.ok(none.every((exponent) => exponent.n === 0 && exponent.d === 1));
});
