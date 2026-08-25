import { runPipeline } from "./pipeline.ts";
import type { Instant, NowFn, RateProvider, Result, Span } from "./types.ts";
import { buildTrie } from "./units/trie.ts";

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
  const trie = buildTrie(locale);
  void now;
  void rates;

  return {
    evaluate(input: string): Result {
      return runPipeline(input, trie).result;
    },
    spans(input: string): readonly Span[] {
      return runPipeline(input, trie).spans;
    },
  };
}
