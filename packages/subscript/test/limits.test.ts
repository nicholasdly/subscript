import { describe, expect, test } from "vitest";

import { createSubscript } from "../src/index.ts";
import {
  EXPONENT_ABS_LIMIT,
  INPUT_LENGTH_LIMIT,
  NODE_COUNT_LIMIT,
  PARSE_DEPTH_LIMIT,
} from "../src/limits.ts";

const subscript = createSubscript();

describe("limit-exceeded", () => {
  test("257 characters is input-length", () => {
    expect(subscript.evaluate("x".repeat(INPUT_LENGTH_LIMIT + 1))).toMatchObject({
      ok: false,
      reason: { kind: "limit-exceeded", limit: "input-length" },
    });
  });

  test("256 characters is not an input-length failure", () => {
    const result = subscript.evaluate("x".repeat(INPUT_LENGTH_LIMIT));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.kind).not.toBe("limit-exceeded");
    }
  });

  test("33 nested parens is parse-depth", () => {
    const depth = PARSE_DEPTH_LIMIT + 1;
    expect(subscript.evaluate(`${"(".repeat(depth)}1${")".repeat(depth)}`)).toMatchObject({
      ok: false,
      reason: { kind: "limit-exceeded", limit: "parse-depth" },
    });
  });

  test("a long addition chain is node-count", () => {
    const ones = Math.ceil((NODE_COUNT_LIMIT + 3) / 2);
    expect(subscript.evaluate(Array.from({ length: ones }, () => "1").join("+"))).toMatchObject({
      ok: false,
      reason: { kind: "limit-exceeded", limit: "node-count" },
    });
  });

  test("an exponent of 1001 is exponent-magnitude", () => {
    expect(subscript.evaluate(`2^${EXPONENT_ABS_LIMIT + 1}`)).toMatchObject({
      ok: false,
      reason: { kind: "limit-exceeded", limit: "exponent-magnitude" },
    });
  });

  test("an exponent of 1000 is allowed", () => {
    expect(subscript.evaluate(`2^${EXPONENT_ABS_LIMIT}`)).toMatchObject({ ok: true });
  });
});
