import assert from "node:assert/strict";
import { test } from "node:test";

import { normalize } from "../src/normalize.ts";

test("maps minus, times, divide, and long arrow", () => {
  const result = normalize("1 \u2212 2 \u00d7 3 \u00f7 4 \u27f6 5");
  assert.equal(result.text, "1 - 2 * 3 / 4 \u2192 5");
  assert.equal(result.map.length, result.text.length);
});

test("maps compatibility celsius and fahrenheit", () => {
  const c = normalize("20\u2103");
  assert.equal(c.text, "20\u00b0C");
  assert.equal(c.map[0], 0);
  assert.equal(c.map[1], 1);
  assert.equal(c.map[2], 2);
  assert.equal(c.map[3], 2);

  const f = normalize("68\u2109");
  assert.equal(f.text, "68\u00b0F");
});

test("does not fold case or collapse spaces", () => {
  const result = normalize("20  C");
  assert.equal(result.text, "20  C");
});
