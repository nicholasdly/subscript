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
 */
export type LimitName = "input-length" | "parse-depth" | "node-count";

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

/** One reading of an ambiguous token, used in {@link Failure} `"ambiguous"`. */
export type Candidate = {
  readonly token: string;
  readonly unit: Unit;
};

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
 * `"ambiguous"`: more than one unit matches and no reading can be chosen.
 *   Not produced for `in` (converter versus inch); that uses {@link Alternate}.
 * `"precision-loss"`: float64 would drop an addend or overflow.
 * `"limit-exceeded"`: an input, depth, or node cap fired.
 */
export type Failure =
  | { readonly kind: "not-an-expression" }
  | { readonly kind: "dimension-mismatch"; readonly from: Unit; readonly to: Unit }
  | { readonly kind: "unknown-unit"; readonly token: string }
  | {
      readonly kind: "ambiguous";
      readonly token: string;
      readonly candidates: readonly Candidate[];
    }
  | { readonly kind: "precision-loss" }
  | { readonly kind: "limit-exceeded"; readonly limit: LimitName };

/**
 * Outcome of `evaluate` and of quantity ops. Check `ok` before reading `value`.
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
