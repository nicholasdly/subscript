import { createFormatter } from "./format.ts";
import { runPipeline, spansForInput } from "./pipeline.ts";
import type { NowFn, Result, Span } from "./types.ts";
import { trieFor } from "./units/trie.ts";

export type SubscriptConfig = {
  locale?: string;
  /**
   * Compact dimensionless magnitudes (`300k`, `3.3M`) and compact money
   * (`$1.5k`, `$1B`). Default true. Display-only: `2.5k` as input is still
   * 2.5 kelvin.
   */
  compact?: boolean;
  /** Injected clock. Unused until M5 wires time zones. */
  now?: NowFn;
  /** Defaults to globalThis.fetch. Tests inject a stub; Redis later wraps this. */
  fetch?: typeof globalThis.fetch;
};

export type Subscript = {
  evaluate(input: string): Promise<Result>;
  spans(input: string): readonly Span[];
};

export function createSubscript(config: SubscriptConfig = {}): Subscript {
  const trie = trieFor(config.locale ?? "en-US");
  const format = createFormatter({ compact: config.compact ?? true });
  const fetchFn = config.fetch ?? ((input, init) => globalThis.fetch(input, init));

  return {
    evaluate(input: string): Promise<Result> {
      return runPipeline(input, trie, format, fetchFn).then((output) => output.result);
    },
    spans(input: string): readonly Span[] {
      return spansForInput(input, trie);
    },
  };
}
