import assert from "node:assert/strict";
import { test } from "node:test";

import {
  add,
  convert,
  div,
  mul,
  quantity,
  sqrt,
  sub,
  type Failure,
  type Quantity,
  type Result,
} from "../src/index.ts";
import { newSession } from "../src/rates.ts";
import { fetchCalls, resetFetchCalls, stubFetch } from "./fetch-stub.ts";

function assertQty(result: Result, id: string, value: number, eps = 0): void {
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.unit.id, id);
    if (eps === 0) {
      assert.equal(result.value.value, value);
    } else {
      assert.ok(Math.abs(result.value.value - value) <= eps);
    }
  }
}

function assertFail(result: Result, kind: Failure["kind"]): void {
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, kind);
  }
}

function q(value: number, unitId?: string): Quantity {
  const result = quantity(value, unitId);
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`quantity(${value}, ${unitId}) failed`);
  }
  return result.value;
}

test("c-to-f", async () => {
  assertQty(await convert(q(20, "celsius"), "fahrenheit"), "fahrenheit", 68, 1e-12);
});

test("f-to-c", async () => {
  assertQty(await convert(q(68, "fahrenheit"), "celsius"), "celsius", 20);
});

test("c-to-k", async () => {
  assertQty(await convert(q(20, "celsius"), "kelvin"), "kelvin", 293.15);
});

test("abs-plus-abs-c", async () => {
  assertFail(await add(q(20, "celsius"), q(5, "celsius")), "dimension-mismatch");
});

test("abs-plus-delta-c", async () => {
  assertQty(await add(q(20, "celsius"), q(5, "delta-celsius")), "celsius", 25);
});

test("abs-plus-kelvin", async () => {
  assertQty(await add(q(20, "celsius"), q(5, "kelvin")), "celsius", 25);
});

test("abs-minus-abs", async () => {
  assertQty(await sub(q(25, "celsius"), q(20, "celsius")), "delta-celsius", 5);
});

test("abs-times-two", () => {
  assertFail(mul(q(20, "celsius"), q(2)), "dimension-mismatch");
});

test("delta-times-two", () => {
  assertQty(mul(q(5, "delta-celsius"), q(2)), "delta-celsius", 10);
});

test("c-to-delta-c", async () => {
  assertFail(await convert(q(20, "celsius"), "delta-celsius"), "dimension-mismatch");
});

test("m-to-ft", async () => {
  assertQty(await convert(q(1, "metre"), "foot"), "foot", 1 / 0.3048, 1e-12);
});

test("km-plus-m", async () => {
  assertQty(await add(q(1, "kilometre"), q(1000, "metre")), "kilometre", 2);
});

test("bare-plus-km", async () => {
  assertQty(await add(q(300), q(20, "kilometre")), "kilometre", 320);
});

test("m-times-m", () => {
  assertQty(mul(q(10, "metre"), q(10, "metre")), "metre-squared", 100);
});

test("kg-times-litre", () => {
  const result = mul(q(3, "kilogram"), q(3, "litre"));
  assertFail(result, "unknown-unit");
  if (!result.ok && result.reason.kind === "unknown-unit") {
    assert.equal(result.reason.token, "kg·L");
  }
});

test("m-div-s", async () => {
  assertQty(await div(q(10, "metre"), q(2, "second")), "metre-per-second", 5);
});

test("sqrt-m2", () => {
  assertQty(sqrt(q(4, "metre-squared")), "metre", 2);
});

test("sqrt-m", () => {
  assertFail(sqrt(q(4, "metre")), "unknown-unit");
});

test("m-plus-kg", async () => {
  assertFail(await add(q(1, "metre"), q(1, "kilogram")), "dimension-mismatch");
});

test("unknown-id", () => {
  const result = quantity(1, "c");
  assertFail(result, "unknown-unit");
  if (!result.ok && result.reason.kind === "unknown-unit") {
    assert.equal(result.reason.token, "c");
  }
});

test("us-vs-imp-gallon", async () => {
  const inch = 0.0254;
  assertQty(await convert(q(1, "us-gallon"), "litre"), "litre", (231 * inch * inch * inch) / 0.001);
  assertQty(await convert(q(1, "imperial-gallon"), "litre"), "litre", (4.54609 * 0.001) / 0.001);
});

test("year-in-days", async () => {
  assertQty(await convert(q(1, "year"), "day"), "day", 365.2425);
});

test("quantity never throws on non-finite values or empty ids", () => {
  assert.doesNotThrow(() => quantity(NaN));
  assert.doesNotThrow(() => quantity(Infinity, "metre"));
  assert.doesNotThrow(() => quantity(1, ""));
  assertFail(quantity(NaN), "precision-loss");
  assertFail(quantity(Infinity, "metre"), "precision-loss");
  assertFail(quantity(1, ""), "unknown-unit");
});

test("adding a lost addend is precision-loss", async () => {
  assertFail(await add(q(1e100), q(1)), "precision-loss");
});

test("subtracting two close irrationals snaps to zero", async () => {
  const result = await sub(q(Math.sqrt(2)), q(2 ** 0.5));
  assertQty(result, "1", 0);
  if (result.ok) {
    assert.equal(result.text, "0");
  }
});

test("quantity accepts ISO currency ids", () => {
  assertQty(quantity(100, "usd"), "usd", 100);
  assertQty(quantity(100, "try"), "try", 100);
});

test("usd to eur quotes the stub", async () => {
  const rates = newSession(stubFetch);
  assertQty(await convert(q(100, "usd"), "eur", rates), "eur", 50);
});

test("same-currency convert does not fetch", async () => {
  resetFetchCalls();
  const rates = newSession(stubFetch);
  assertQty(await convert(q(100, "usd"), "usd", rates), "usd", 100);
  assert.equal(fetchCalls, 0);
});

test("mixed currency add is last-wins", async () => {
  const rates = newSession(stubFetch);
  assertQty(await add(q(200, "usd"), q(200, "eur"), rates), "eur", 300);
});

test("same-currency add does not fetch", async () => {
  resetFetchCalls();
  const rates = newSession(stubFetch);
  assertQty(await add(q(10, "usd"), q(5, "usd"), rates), "usd", 15);
  assert.equal(fetchCalls, 0);
});

test("cross-currency convert without a rate is rate-unavailable", async () => {
  const rates = newSession(stubFetch);
  assertFail(await convert(q(100, "usd"), "kzt", rates), "rate-unavailable");
});

test("pounds to usd is dimension-mismatch", async () => {
  assertFail(await convert(q(100, "pound"), "usd"), "dimension-mismatch");
});
