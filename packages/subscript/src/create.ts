import { createFormatter } from "./format.ts";
import { runPipeline } from "./pipeline.ts";
import type { NowFn, RateProvider, Result, Span } from "./types.ts";
import { trieFor } from "./units/trie.ts";

export type SubscriptConfig = {
  locale?: string;
  /**
   * Compact dimensionless magnitudes (`300k`, `3.3M`). Default true.
   * Display-only: `2.5k` as input is still 2.5 kelvin.
   */
  compact?: boolean;
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
  const format = createFormatter({ compact: config.compact ?? true });

  return {
    evaluate(input: string): Result {
      return runPipeline(input, trie, format).result;
    },
    spans(input: string): readonly Span[] {
      return runPipeline(input, trie, format).spans;
    },
  };
}
