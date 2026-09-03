/**
 * Configured engine. Builds the alias trie, timezone helpers, and formatters
 * once; each `evaluate` call runs `pipeline/`.
 */
import { runPipeline, spansForInput } from "./pipeline/index.ts";
import { trieFor } from "./pipeline/trie.ts";
import { createFormatter } from "./quantity/format.ts";
import { createTzEngine } from "./time/index.ts";
import type { AmbiguousClock, NowFn, Result, Span } from "./types.ts";

export type SubscriptConfig = {
  /**
   * BCP 47 tag used to pick volume aliases. `en-GB` treats gallon, pint, cup,
   * quart, tablespoon, and fluid ounce as imperial; every other locale treats
   * them as US. Default `"en-US"`.
   */
  locale?: string;
  /**
   * Compact dimensionless magnitudes (`300k`, `3.3M`). Default true.
   * Display-only: `2.5k` as input is still 2.5 kelvin.
   */
  compact?: boolean;
  /** Injected clock. Tests pass a fixed instant; the default reads Date.now. */
  now?: NowFn;
  /**
   * How to read a clock that has no am/pm. Default `"literal24"`: `3:00` is 03:00.
   * `"preferDaytime"` treats 1:00–6:59 without am/pm as PM.
   */
  ambiguousClock?: AmbiguousClock;
};

/**
 * A reusable evaluator. Prefer this over the free `evaluate` when you call
 * `evaluate` on every keystroke, inject `now`, or need {@link Subscript.spans}.
 */
export type Subscript = {
  /** Evaluate a natural-language query. Same contract as the free `evaluate`. */
  evaluate(input: string): Result;
  /**
   * Semantic spans for syntax highlighting. Does not evaluate.
   * Positions refer to the original input, not the normalized string.
   */
  spans(input: string): readonly Span[];
};

/**
 * Build a configured evaluator. Reuses the alias trie and `Intl` formatters
 * across calls. Pass `now` for a deterministic clock in tests.
 */
export function createSubscript(config: SubscriptConfig = {}): Subscript {
  const trie = trieFor(config.locale ?? "en-US");
  const engine = createTzEngine();
  const format = createFormatter({ compact: config.compact ?? true }, engine);
  const now: NowFn = config.now ?? (() => ({ epochMilliseconds: Date.now() }));
  const ambiguousClock: AmbiguousClock = config.ambiguousClock ?? "literal24";

  return {
    evaluate(input: string): Result {
      return runPipeline(input, trie, format, now, ambiguousClock, engine);
    },
    spans(input: string): readonly Span[] {
      return spansForInput(input, trie, ambiguousClock);
    },
  };
}
