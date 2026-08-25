import assert from "node:assert/strict";
import { test } from "node:test";

import { FRANKFURTER_ORIGIN, newSession, quotePair } from "../src/rates.ts";
import { fetchCalls, resetFetchCalls, stubFetch } from "./fetch-stub.ts";

test("identity does not fetch", async () => {
  resetFetchCalls();
  const result = await quotePair("usd", "usd", stubFetch, new Map());
  assert.deepEqual(result, { ok: true, factor: 1 });
  assert.equal(fetchCalls, 0);
});

test("usd to eur is 0.5 against the stub", async () => {
  resetFetchCalls();
  const result = await quotePair("usd", "eur", stubFetch, new Map());
  assert.deepEqual(result, { ok: true, factor: 0.5 });
  assert.equal(fetchCalls, 1);
});

test("the request hits the v2 pair endpoint", async () => {
  const urls: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    urls.push(String(input));
    return stubFetch(input);
  };
  await quotePair("usd", "eur", fetchFn, new Map());
  assert.deepEqual(urls, [`${FRANKFURTER_ORIGIN}/v2/rate/USD/EUR`]);
});

test("a memoized pair is fetched once", async () => {
  resetFetchCalls();
  const session = newSession(stubFetch);
  await quotePair("usd", "eur", session.fetch, session.memo);
  await quotePair("usd", "eur", session.fetch, session.memo);
  assert.equal(fetchCalls, 1);
});

test("a rejected fetch is rate-unavailable", async () => {
  const fetchFn: typeof fetch = async () => {
    throw new Error("network");
  };
  const result = await quotePair("usd", "eur", fetchFn, new Map());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, "rate-unavailable");
    assert.equal(result.reason.currency, "eur");
  }
});

test("HTTP 404 is rate-unavailable", async () => {
  const result = await quotePair("usd", "kzt", stubFetch, new Map());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, "rate-unavailable");
    assert.equal(result.reason.currency, "kzt");
  }
});

test("a non-finite rate is rate-unavailable", async () => {
  const fetchFn: typeof fetch = async () =>
    Response.json({ date: "2013-02-12", base: "USD", quote: "EUR", rate: 0 });
  const result = await quotePair("usd", "eur", fetchFn, new Map());
  assert.equal(result.ok, false);
});

test("an aborted fetch is rate-unavailable", async () => {
  const fetchFn: typeof fetch = async () => {
    throw new DOMException("The operation was aborted.", "AbortError");
  };
  const result = await quotePair("usd", "eur", fetchFn, new Map());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason.kind, "rate-unavailable");
  }
});
