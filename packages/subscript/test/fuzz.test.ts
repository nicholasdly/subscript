import { describe, expect, test } from "vitest";

import { createSubscript, type Result } from "../src/index.ts";

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

const FAILURE_KINDS = [
  "not-an-expression",
  "dimension-mismatch",
  "unknown-unit",
  "ambiguous",
  "precision-loss",
  "limit-exceeded",
] as const;

function expectWellFormed(result: Result): void {
  expect(result).toEqual(expect.objectContaining({ ok: expect.any(Boolean) }));
  if (result.ok) {
    expect(result.text).toEqual(expect.any(String));
    expect(result.value).toEqual(expect.any(Object));
    return;
  }
  expect(result.reason).toEqual(expect.any(Object));
  expect(FAILURE_KINDS).toContain(result.reason.kind);
}

describe("fuzz", () => {
  test("seeded random strings never throw and always return a Result", { timeout: 5000 }, () => {
    const subscript = createSubscript();
    const next = lcg(SEED);
    for (let n = 0; n < 1000; n++) {
      const length = next() % 65;
      let input = "";
      for (let i = 0; i < length; i++) {
        input += ALPHABET.charAt(next() % ALPHABET.length);
      }
      expectWellFormed(subscript.evaluate(input));
    }
  });
});
