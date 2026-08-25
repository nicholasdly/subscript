export type Instant = { readonly epochMilliseconds: number };
export type NowFn = () => Instant;
export type AmbiguousClock = "literal24" | "preferDaytime";

export type LimitName = "input-length" | "parse-depth" | "node-count";

export interface Unit {
  readonly id: string;
  readonly symbol: string;
}

export interface Quantity {
  readonly value: number;
  readonly unit: Unit;
}

export type ZonedTime = {
  readonly kind: "zoned-time";
  readonly epochMilliseconds: number;
  /** Catalog id (`pst`, `asia-tokyo`) or a synthetic offset id (`utc-0800`). */
  readonly timeZone: string;
  /** Short label used in `text` (`JST`, `PST`, `PT`). */
  readonly label: string;
  readonly sourceYear: number;
  readonly sourceMonth: number;
  readonly sourceDay: number;
};

export type EvalValue = Quantity | ZonedTime;

export function isZonedTime(value: EvalValue): value is ZonedTime {
  return "kind" in value && value.kind === "zoned-time";
}

export type Candidate = {
  readonly token: string;
  readonly unit: Unit;
};

export type Alternate = {
  readonly value: Quantity;
  readonly text: string;
  readonly reason: string;
};

export type SpanKind =
  | "number"
  | "unit"
  | "currency"
  | "timezone"
  | "operator"
  | "converter"
  | "punctuation"
  | "unknown";

export type Span = {
  readonly start: number;
  readonly end: number;
  readonly kind: SpanKind;
};

export type Failure =
  | { readonly kind: "not-an-expression" }
  | { readonly kind: "dimension-mismatch"; readonly from: Unit; readonly to: Unit }
  | { readonly kind: "unknown-unit"; readonly token: string }
  | {
      readonly kind: "ambiguous";
      readonly token: string;
      readonly candidates: readonly Candidate[];
    }
  | { readonly kind: "rate-unavailable"; readonly currency: string }
  | { readonly kind: "rate-pending"; readonly currency: string }
  | { readonly kind: "precision-loss" }
  | { readonly kind: "limit-exceeded"; readonly limit: LimitName };

export type Result =
  | {
      readonly ok: true;
      readonly value: EvalValue;
      readonly text: string;
      readonly alternates?: readonly Alternate[];
    }
  | { readonly ok: false; readonly reason: Failure };
