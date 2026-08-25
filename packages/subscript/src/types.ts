export type Instant = { readonly epochMilliseconds: number };
export type NowFn = () => Instant;

export type LimitName = "input-length" | "parse-depth" | "node-count";

export interface Unit {
  readonly id: string;
  readonly symbol: string;
}

export interface Quantity {
  readonly value: number;
  readonly unit: Unit;
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
  | { kind: "not-an-expression" }
  | { kind: "dimension-mismatch"; from: Unit; to: Unit }
  | { kind: "unknown-unit"; token: string }
  | { kind: "ambiguous"; token: string; candidates: readonly Candidate[] }
  | { kind: "rate-unavailable"; currency: string }
  | { kind: "rate-pending"; currency: string }
  | { kind: "precision-loss" }
  | { kind: "limit-exceeded"; limit: LimitName };

export type Result =
  | { ok: true; value: Quantity; text: string; alternates?: readonly Alternate[] }
  | { ok: false; reason: Failure };
