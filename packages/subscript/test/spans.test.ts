import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript } from "../src/index.ts";

const subscript = createSubscript();

test("20 c to f", () => {
  assert.deepEqual(subscript.spans("20 c to f"), [
    { start: 0, end: 2, kind: "number" },
    { start: 3, end: 4, kind: "unit" },
    { start: 5, end: 7, kind: "converter" },
    { start: 8, end: 9, kind: "unit" },
  ]);
});

test("1 min is number then unit", () => {
  assert.deepEqual(subscript.spans("1 min"), [
    { start: 0, end: 1, kind: "number" },
    { start: 2, end: 5, kind: "unit" },
  ]);
});

test("failure yields no spans", () => {
  assert.deepEqual(subscript.spans("hello world"), []);
});

test("over-length input yields no spans", () => {
  assert.deepEqual(subscript.spans("x".repeat(257)), []);
});
