import { expect } from "vitest";

import { isZonedTime, type Failure, type Result } from "../src/index.ts";

expect.extend({
  toBeQuantity(received: Result, unitId: string, value: number, eps = 0) {
    if (!received.ok) {
      return {
        pass: false,
        message: () => `expected a quantity, got failure ${received.reason.kind}`,
        actual: received,
        expected: { ok: true, unitId, value },
      };
    }
    if (isZonedTime(received.value)) {
      return {
        pass: false,
        message: () => "expected a quantity, got a zoned time",
        actual: received.value,
        expected: { unitId, value },
      };
    }
    const actualId = received.value.unit.id;
    const actualValue = received.value.value;
    const close = eps === 0 ? actualValue === value : Math.abs(actualValue - value) <= eps;
    const pass = actualId === unitId && close;
    return {
      pass,
      message: () =>
        pass
          ? `expected not ${unitId} ${value}`
          : `expected ${unitId} ${value}${eps === 0 ? "" : ` \u00b1${eps}`}, got ${actualId} ${actualValue}`,
      actual: { unitId: actualId, value: actualValue },
      expected: { unitId, value },
    };
  },

  toFailWith(received: Result, kind: Failure["kind"]) {
    if (received.ok) {
      return {
        pass: false,
        message: () => `expected failure ${kind}, got ${received.text}`,
        actual: received,
        expected: { ok: false, kind },
      };
    }
    const pass = received.reason.kind === kind;
    return {
      pass,
      message: () =>
        pass
          ? `expected not to fail with ${kind}`
          : `expected failure ${kind}, got ${received.reason.kind}`,
      actual: received.reason.kind,
      expected: kind,
    };
  },
});
