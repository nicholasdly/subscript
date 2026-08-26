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
  locale?: string;
  /**
   * Compact dimensionless magnitudes (`300k`, `3.3M`). Default true.
   * Display-only: `2.5k` as input is still 2.5 kelvin.
   */
  compact?: boolean;
  /** Injected clock. Tests pass a fixed instant; the default reads Date.now. */
  now?: NowFn;
  /** Default `"literal24"`: `3:00` is 03:00. */
  ambiguousClock?: AmbiguousClock;
};

export type Subscript = {
  evaluate(input: string): Result;
  spans(input: string): readonly Span[];
};

export function createSubscript(config: SubscriptConfig = {}): Subscript {
  const trie = trieFor(config.locale ?? "en-US");
  const engine = createTzEngine();
  const format = createFormatter({ compact: config.compact ?? true }, engine);
  const now: NowFn = config.now ?? (() => ({ epochMilliseconds: Date.now() }));
  const ambiguousClock: AmbiguousClock = config.ambiguousClock ?? "literal24";

  return {
    evaluate(input: string): Result {
      return runPipeline(input, trie, format, now, ambiguousClock, engine).result;
    },
    spans(input: string): readonly Span[] {
      return spansForInput(input, trie, ambiguousClock);
    },
  };
}
