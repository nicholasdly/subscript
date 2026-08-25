import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript } from "../src/index.ts";
import { fetchCalls, resetFetchCalls, stubFetch } from "./fetch-stub.ts";

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

test("the + inserted between feet and inches is not coloured", () => {
  assert.deepEqual(subscript.spans("5 ft 11 in"), [
    { start: 0, end: 1, kind: "number" },
    { start: 2, end: 4, kind: "unit" },
    { start: 5, end: 7, kind: "number" },
    { start: 8, end: 10, kind: "unit" },
  ]);
});

test("11 in cm colors in as the inch unit used by evaluation", () => {
  assert.deepEqual(subscript.spans("11 in cm"), [
    { start: 0, end: 2, kind: "number" },
    { start: 3, end: 5, kind: "unit" },
    { start: 6, end: 8, kind: "unit" },
  ]);
});

test("parentheses and sqrt colour as punctuation and operator", () => {
  assert.deepEqual(subscript.spans("sqrt(4)"), [
    { start: 0, end: 4, kind: "operator" },
    { start: 4, end: 5, kind: "punctuation" },
    { start: 5, end: 6, kind: "number" },
    { start: 6, end: 7, kind: "punctuation" },
  ]);
});

test("failure yields no spans", () => {
  assert.deepEqual(subscript.spans("hello world"), []);
});

test("a scientific number is one number span", () => {
  assert.deepEqual(subscript.spans("1e100"), [{ start: 0, end: 5, kind: "number" }]);
});

test("over-length input yields no spans", () => {
  assert.deepEqual(subscript.spans("x".repeat(257)), []);
});

test("100 usd in eur colors currency and does not fetch", () => {
  resetFetchCalls();
  const quoted = createSubscript({ fetch: stubFetch });
  assert.deepEqual(quoted.spans("100 usd in eur"), [
    { start: 0, end: 3, kind: "number" },
    { start: 4, end: 7, kind: "currency" },
    { start: 8, end: 10, kind: "converter" },
    { start: 11, end: 14, kind: "currency" },
  ]);
  assert.equal(fetchCalls, 0);
});

test("$100 colors the symbol then the digits", () => {
  assert.deepEqual(subscript.spans("$100"), [
    { start: 0, end: 1, kind: "currency" },
    { start: 1, end: 4, kind: "number" },
  ]);
});

test("3pm PST in Tokyo colors clock, zones, and converter", () => {
  resetFetchCalls();
  assert.deepEqual(subscript.spans("3pm PST in Tokyo"), [
    { start: 0, end: 3, kind: "number" },
    { start: 4, end: 7, kind: "timezone" },
    { start: 8, end: 10, kind: "converter" },
    { start: 11, end: 16, kind: "timezone" },
  ]);
  assert.equal(fetchCalls, 0);
});
