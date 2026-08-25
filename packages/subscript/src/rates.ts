import type { Failure } from "./types.ts";

export const FRANKFURTER_ORIGIN = "https://api.frankfurter.dev";

export type Factor =
  | { ok: true; factor: number }
  | { ok: false; reason: Extract<Failure, { kind: "rate-unavailable" }> };

export type QuoteSession = {
  fetch: typeof globalThis.fetch;
  memo: Map<string, Promise<Factor>>;
};

export function newSession(fetchFn: typeof globalThis.fetch = globalThis.fetch): QuoteSession {
  return { fetch: fetchFn, memo: new Map() };
}

function unavailable(currency: string): Factor {
  return { ok: false, reason: { kind: "rate-unavailable", currency } };
}

async function fetchPair(
  fromId: string,
  toId: string,
  fetchFn: typeof globalThis.fetch,
): Promise<Factor> {
  try {
    const url = `${FRANKFURTER_ORIGIN}/v2/rate/${fromId.toUpperCase()}/${toId.toUpperCase()}`;
    const response = await fetchFn(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return unavailable(toId);
    }
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("rate" in data)) {
      return unavailable(toId);
    }
    const rate = data.rate;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return unavailable(toId);
    }
    return { ok: true, factor: rate };
  } catch {
    return unavailable(toId);
  }
}

export function quotePair(
  fromId: string,
  toId: string,
  fetchFn: typeof globalThis.fetch,
  memo: Map<string, Promise<Factor>>,
): Promise<Factor> {
  if (fromId === toId) {
    return Promise.resolve({ ok: true, factor: 1 });
  }
  const key = `${fromId}/${toId}`;
  const existing = memo.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const pending = fetchPair(fromId, toId, fetchFn);
  memo.set(key, pending);
  return pending;
}
