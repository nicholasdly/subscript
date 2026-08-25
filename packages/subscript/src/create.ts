import { runPipeline } from "./pipeline.ts";
import type { NowFn, RateProvider, Result, Span } from "./types.ts";
import { trieFor } from "./units/trie.ts";

export type SubscriptConfig = {
  locale?: string;
  /** Injected clock. Unused until M5 wires time zones. */
  now?: NowFn;
  /** Injected rate source. Unused until M4 wires currency. */
  rates?: RateProvider;
};

export type Subscript = {
  evaluate(input: string): Result;
  spans(input: string): readonly Span[];
};

export function createSubscript(config: SubscriptConfig = {}): Subscript {
  const trie = trieFor(config.locale ?? "en-US");

  return {
    evaluate(input: string): Result {
      return runPipeline(input, trie).result;
    },
    spans(input: string): readonly Span[] {
      return runPipeline(input, trie).spans;
    },
  };
}
