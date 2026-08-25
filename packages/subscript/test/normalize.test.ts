import assert from "node:assert/strict";
import { test } from "node:test";

import { normalize, sourceIndex } from "../src/normalize.ts";

test("maps minus, times, divide, and long arrow", () => {
  const result = normalize("1 \u2212 2 \u00d7 3 \u00f7 4 \u27f6 5");
  assert.equal(result.text, "1 - 2 * 3 / 4 \u2192 5");
  assert.equal(result.starts.length, result.text.length + 1);
});

test("maps compatibility celsius and fahrenheit", () => {
  const c = normalize("20\u2103");
  assert.equal(c.text, "20\u00b0C");
  assert.deepEqual(c.starts, [0, 1, 2, 2, 3]);

  const f = normalize("68\u2109");
  assert.equal(f.text, "68\u00b0F");
});

test("the entry past the end is the length of the source", () => {
  const result = normalize("20 c");
  assert.equal(sourceIndex(result, result.text.length), 4);
  assert.equal(sourceIndex(result, result.text.length + 1), 4);
});

test("keeps offsets correct across astral characters", () => {
  const result = normalize("\u{1f600}m");
  assert.equal(result.text, "\u{1f600}m");
  assert.equal(sourceIndex(result, 2), 2);
});

test("keeps original offsets when NFC composes characters", () => {
  const result = normalize("sa\u0303o");
  assert.equal(result.text, "s\u00e3o");
  assert.deepEqual(result.starts, [0, 1, 3, 4]);
});

test("does not fold case or collapse spaces", () => {
  assert.equal(normalize("20  C").text, "20  C");
});

test("folds a.m. and p.m. to am and pm", () => {
  const result = normalize("3 p.m. PST");
  assert.equal(result.text, "3 pm PST");
});
