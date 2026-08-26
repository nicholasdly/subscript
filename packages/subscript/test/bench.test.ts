import { describe, test } from "vitest";

import { evaluate } from "../src/index.ts";

const INPUTS = ["20 c to f", "5 ft 11 in cm", "(2 + 3) * 4 km in miles"];

describe("throughput", () => {
  test("1000 evaluations of the three exit inputs finish under 2s", { timeout: 2000 }, () => {
    for (let i = 0; i < 1000; i++) {
      for (const input of INPUTS) {
        evaluate(input);
      }
    }
  });
});
