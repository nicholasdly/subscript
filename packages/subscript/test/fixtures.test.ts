import { describe, expect, test } from "vitest";

import { createSubscript, isZonedTime, type Alternate, type Result } from "../src/index.ts";
import { toWall } from "../src/time/index.ts";
import { accept } from "./fixtures/accept.ts";
import { reject } from "./fixtures/reject.ts";
import { REFERENCE_INSTANT, type Fixture } from "./fixtures/types.ts";

const FAILURE_KINDS = [
  "not-an-expression",
  "dimension-mismatch",
  "unknown-unit",
  "precision-loss",
  "limit-exceeded",
] as const;

const fixtures: Fixture[] = [...accept, ...reject];

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

function asResult(alternate: Alternate): Result {
  return { ok: true, value: alternate.value, text: alternate.text };
}

function expectAlternates(
  result: Extract<Result, { ok: true }>,
  expected: Extract<Fixture["expect"], { ok: true }>,
): void {
  if (!("unitId" in expected) || expected.alternates === undefined) {
    expect.soft(result.alternates).toBeUndefined();
    return;
  }
  const wanted = expected.alternates;
  expect.soft(result.alternates).toHaveLength(wanted.length);
  if (result.alternates === undefined) {
    return;
  }
  for (const [i, alternate] of result.alternates.entries()) {
    const exp = wanted[i];
    if (exp === undefined) {
      continue;
    }
    expect.soft(alternate.text).toBe(exp.text);
    expect.soft(alternate.reason).toBe(exp.reason);
    expect.soft(asResult(alternate)).toBeQuantity(exp.unitId, exp.value, exp.eps);
  }
}

function expectFixture(result: Result, expected: Fixture["expect"]): void {
  if (!expected.ok) {
    expect.soft(result).toFailWith(expected.reason);
    return;
  }
  expect.soft(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect.soft(result.text).toBe(expected.text);
  if ("zoned" in expected) {
    expect.soft(isZonedTime(result.value)).toBe(true);
    if (!isZonedTime(result.value)) {
      return;
    }
    expect.soft(result.value).toMatchObject({
      timeZone: expected.zoned.timeZone,
      label: expected.zoned.label,
    });
    expect.soft(toWall(result.value)).toMatchObject({
      hour: expected.zoned.hour,
      minute: expected.zoned.minute,
    });
    expectAlternates(result, expected);
    return;
  }
  expect.soft(result).toBeQuantity(expected.unitId, expected.value, expected.eps);
  expectAlternates(result, expected);
}

function runFixture(fixture: Fixture): void {
  const subscript = createSubscript({
    locale: fixture.locale ?? "en-US",
    now: () => fixture.now ?? REFERENCE_INSTANT,
  });
  const result = subscript.evaluate(fixture.input);
  expectWellFormed(result);
  expectFixture(result, fixture.expect);
}

describe("fixtures", () => {
  test("names are unique", () => {
    const names = fixtures.map((fixture) => fixture.name);
    expect(names).toEqual([...new Set(names)]);
  });

  describe("accept", () => {
    const pending = accept.filter((fixture) => fixture.todo);
    test.each(accept.filter((fixture) => !fixture.todo))("$name", runFixture);
    if (pending.length > 0) {
      test.todo.each(pending)("$name", runFixture);
    }
  });

  describe("reject", () => {
    const pending = reject.filter((fixture) => fixture.todo);
    test.each(reject.filter((fixture) => !fixture.todo))("$name", runFixture);
    if (pending.length > 0) {
      test.todo.each(pending)("$name", runFixture);
    }
  });
});
