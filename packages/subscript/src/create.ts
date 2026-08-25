import type { Instant, NowFn, RateProvider, Result, Span } from "./types.ts";

const notAnExpression: Result = {
  ok: false,
  reason: { kind: "not-an-expression" },
};

function defaultNow(): Instant {
  return { epochMilliseconds: Date.now() };
}

export type SubscriptConfig = {
  locale?: string;
  now?: NowFn;
  rates?: RateProvider;
};

export type Subscript = {
  evaluate(input: string): Result;
  spans(input: string): readonly Span[];
};

export function createSubscript(config: SubscriptConfig = {}): Subscript {
  const locale = config.locale ?? "en-US";
  const now = config.now ?? defaultNow;
  const rates = config.rates;

  return {
    evaluate(_input: string): Result {
      void locale;
      void now;
      void rates;
      return notAnExpression;
    },
    spans(_input: string): readonly Span[] {
      return [];
    },
  };
}
