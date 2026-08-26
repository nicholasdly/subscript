/**
 * Natural-language arithmetic, unit conversion, and time zones.
 *
 * Start here. `evaluate` and `createSubscript` are the public API.
 * Quantity helpers (`add`, `convert`, …) skip parsing and work on values.
 *
 *   create.ts / evaluate.ts  — entry points
 *   pipeline/                — how a string becomes a Result
 *   quantity/                — dimensional arithmetic (no parsing)
 *   time/                    — clocks and time zones
 *   units/                   — the unit catalog
 *
 * Pipeline stages are also exported from `./internals.ts` (not semver-stable).
 * Design intent lives in `docs/plan.md`; settled facts in `docs/history.md`.
 */
export { createSubscript } from "./create.ts";
export type { Subscript, SubscriptConfig } from "./create.ts";
export { evaluate } from "./evaluate.ts";
export { add, convert, div, mul, quantity, sqrt, sub } from "./quantity/index.ts";
export { isZonedTime } from "./types.ts";
export type {
  Alternate,
  AmbiguousClock,
  Candidate,
  EvalValue,
  Failure,
  Instant,
  LimitName,
  NowFn,
  Quantity,
  Result,
  Span,
  SpanKind,
  Unit,
  ZonedTime,
} from "./types.ts";
