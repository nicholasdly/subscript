import assert from "node:assert/strict";
import { test } from "node:test";

import {
  add,
  addChecked,
  div,
  isFiniteNumber,
  mul,
  sqrt,
  sub,
  subChecked,
} from "../src/quantity/numeric.ts";

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

test("addChecked refuses a lost addend", () => {
  assert.deepEqual(addChecked(1e100, 1), { ok: false });
  assert.deepEqual(addChecked(1e16, 1), { ok: false });
});

test("addChecked of zero plus a value keeps the value", () => {
  assert.deepEqual(addChecked(0, 5), { ok: true, value: 5 });
});

test("subChecked snaps cancellation residue to zero", () => {
  assert.deepEqual(subChecked(Math.sqrt(2), 2 ** 0.5), { ok: true, value: 0 });
});

test("subChecked keeps a small magnitude that is not cancellation", () => {
  assert.deepEqual(subChecked(1e-13, 0), { ok: true, value: 1e-13 });
});
