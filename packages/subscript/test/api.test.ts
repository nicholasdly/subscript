import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript, evaluate } from "../src/index.ts";
import { accept } from "./fixtures/accept.ts";
import { reject } from "./fixtures/reject.ts";

const seedInputs = [
  "20 c to f",
  ...accept.map((fixture) => fixture.input),
  ...reject.map((fixture) => fixture.input),
];

test("evaluate never throws on seed inputs", () => {
  for (const input of seedInputs) {
    assert.doesNotThrow(() => evaluate(input));
  }
});

test("createSubscript().evaluate matches evaluate", () => {
  const subscript = createSubscript();
  for (const input of seedInputs) {
    assert.deepEqual(subscript.evaluate(input), evaluate(input));
  }
});

test("spans colors 20 c to f", () => {
  const subscript = createSubscript();
  assert.deepEqual(subscript.spans("20 c to f"), [
    { start: 0, end: 2, kind: "number" },
    { start: 3, end: 4, kind: "unit" },
    { start: 5, end: 7, kind: "converter" },
    { start: 8, end: 9, kind: "unit" },
  ]);
});

test("compact can be disabled per instance", () => {
  const subscript = createSubscript({ compact: false });
  const result = subscript.evaluate("1000");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, "1000");
  }
});
