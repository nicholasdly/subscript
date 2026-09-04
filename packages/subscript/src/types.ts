/**
 * Public result types: Quantity, ZonedTime, Result, Span, Failure.
 *
 * A successful evaluation is a {@link Quantity} or a {@link ZonedTime}.
 * Failures are a {@link Failure} tagged by `kind`. Nothing in the public API
 * throws for input-shaped reasons.
 */
export type Instant = {
  /** UTC milliseconds since the Unix epoch. */
  readonly epochMilliseconds: number;
};

/** Clock used for `now` and for dating a clock like `3pm PST`. */
export type NowFn = () => Instant;

/**
 * How to read a clock that has no am/pm.
 *
 * `"literal24"` (default): `3:00` is 03:00.
 * `"preferDaytime"`: 1:00–6:59 without am/pm is PM.
 */
export type AmbiguousClock = "literal24" | "preferDaytime";

/**
 * A cap that fired. Untrusted input is rejected rather than hanging the host.
 *
 * `"input-length"`: more than 256 characters.
 * `"parse-depth"`: nesting deeper than 32.
 * `"node-count"`: more than 64 AST nodes.
 * `"exponent-magnitude"`: `|exponent|` for `^` greater than 1000.
 */
export type LimitName = "input-length" | "parse-depth" | "node-count" | "exponent-magnitude";

/** A unit as callers see it: catalog `id` (`metre`) and display `symbol` (`m`). */
export interface Unit {
  readonly id: string;
  readonly symbol: string;
}

/**
 * A number with a unit. Dimensionless values use `{ id: "1", symbol: "" }`.
 * Affine offsets stay internal; this is only the magnitude and its unit.
 */
export interface Quantity {
  readonly value: number;
  readonly unit: Unit;
}

/**
 * A civil time in a known zone. Discriminated by `kind: "zoned-time"`.
 * Narrow a {@link Result} value with {@link isZonedTime}.
 */
export type ZonedTime = {
  readonly kind: "zoned-time";
  readonly epochMilliseconds: number;
  /** Catalog id (`pst`, `asia-tokyo`) or a synthetic offset id (`utc-0800`). */
  readonly timeZone: string;
  /** Short label used in `text` (`JST`, `PST`, `PT`). */
  readonly label: string;
  /** Source calendar date, used to print a rolled-over day. */
  readonly sourceYear: number;
  readonly sourceMonth: number;
  readonly sourceDay: number;
};

/** What a successful evaluation holds. Narrow with {@link isZonedTime}. */
export type EvalValue = Quantity | ZonedTime;

/** True when `value` is a {@link ZonedTime}, not a {@link Quantity}. */
export function isZonedTime(value: EvalValue): value is ZonedTime {
  return "kind" in value && value.kind === "zoned-time";
}

/**
 * Another reading that also evaluated, to a different quantity.
 * Today the reason is `"in as converter"` versus `"in as inch"`.
 */
export type Alternate = {
  readonly value: Quantity;
  readonly text: string;
  readonly reason: string;
};

/**
 * Token class for `spans()`, used to colour input as the user types.
 *
 * `"converter"` is `to` / `in` / `as` / `→`. `"unknown"` is leftover text.
 */
export type SpanKind =
  | "number"
  | "unit"
  | "timezone"
  | "operator"
  | "converter"
  | "punctuation"
  | "unknown";

/** A half-open `[start, end)` range in the original input, before normalize. */
export type Span = {
  readonly start: number;
  readonly end: number;
  readonly kind: SpanKind;
};

/**
 * Why evaluation failed.
 *
 * `"not-an-expression"`: the string is not a query this package accepts.
 * `"dimension-mismatch"`: the operands cannot combine or convert.
 * `"unknown-unit"`: a catalog id or derived name cannot be resolved.
 * `"precision-loss"`: float64 would drop an addend or overflow.
 * `"limit-exceeded"`: an input, depth, node, or exponent cap fired.
 */
export type Failure =
  | { readonly kind: "not-an-expression" }
  | { readonly kind: "dimension-mismatch"; readonly from: Unit; readonly to: Unit }
  | { readonly kind: "unknown-unit"; readonly token: string }
  | { readonly kind: "precision-loss" }
  | { readonly kind: "limit-exceeded"; readonly limit: LimitName };

/**
 * Unformatted success or failure. Quantity arithmetic and AST eval return this.
 * The conductor, and the public quantity helpers, attach `text` to make a
 * {@link Result} or {@link QuantityResult}.
 */
export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: Failure };

/**
 * Outcome of a quantity helper (`add`, `convert`, …). Success is always a
 * {@link Quantity}; callers do not need {@link isZonedTime}.
 */
export type QuantityResult =
  | { readonly ok: true; readonly value: Quantity; readonly text: string }
  | { readonly ok: false; readonly reason: Failure };

/**
 * Outcome of `evaluate`. Check `ok` before reading `value`.
 *
 * `text` is the display string (six significant figures, compact `k`/`M`/`G`
 * on dimensionless magnitudes). `alternates` is present when another reading
 * of the same input also evaluated, to a different quantity.
 */
export type Result =
  | {
      readonly ok: true;
      readonly value: EvalValue;
      readonly text: string;
      readonly alternates?: readonly Alternate[];
    }
  | { readonly ok: false; readonly reason: Failure };
