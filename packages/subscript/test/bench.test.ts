import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluate } from "../src/index.ts";

test("1000 evaluations of the three exit inputs finish under 2s", () => {
  const inputs = ["20 c to f", "5 ft 11 in cm", "(2 + 3) * 4 km in miles"];
  const started = Date.now();
  for (let i = 0; i < 1000; i++) {
    for (const input of inputs) {
      evaluate(input);
    }
  }
  assert.ok(Date.now() - started < 2000);
});
