import { describe, expect, test } from "vitest";

import { addChecked, isFiniteNumber, subChecked } from "../../src/quantity/numeric.ts";

describe("isFiniteNumber", () => {
  test.each([
    [0, true],
    [1.5, true],
    [NaN, false],
    [Infinity, false],
    [-Infinity, false],
  ] as const)("isFiniteNumber(%s) is %s", (value, expected) => {
    expect(isFiniteNumber(value)).toBe(expected);
  });
});

describe("checked arithmetic", () => {
  test.each([
    [1e100, 1],
    [1e16, 1],
  ])("addChecked(%d, %d) refuses a lost addend", (a, b) => {
    expect(addChecked(a, b)).toEqual({ ok: false });
  });

  test("addChecked of zero plus a value keeps the value", () => {
    expect(addChecked(0, 5)).toEqual({ ok: true, value: 5 });
  });

  test("subChecked snaps cancellation residue to zero", () => {
    expect(subChecked(Math.sqrt(2), 2 ** 0.5)).toEqual({ ok: true, value: 0 });
  });

  test("subChecked keeps a small magnitude that is not cancellation", () => {
    expect(subChecked(1e-13, 0)).toEqual({ ok: true, value: 1e-13 });
  });
});
