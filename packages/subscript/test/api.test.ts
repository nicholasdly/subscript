import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubscript, evaluate, type Result } from "../src/index.ts";
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

test("evaluate currently rejects every seed input as not-an-expression", () => {
  for (const input of seedInputs) {
    const result = evaluate(input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason.kind, "not-an-expression");
    }
  }
});

test("createSubscript().evaluate matches evaluate", () => {
  const subscript = createSubscript();
  for (const input of seedInputs) {
    assert.deepEqual(subscript.evaluate(input), evaluate(input));
  }
});

test("spans returns an empty list", () => {
  const subscript = createSubscript();
  const result: Result = subscript.evaluate("20 c to f");
  assert.equal(result.ok, false);
  assert.deepEqual(subscript.spans("20 c to f"), []);
});
