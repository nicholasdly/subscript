export type ConverterWord = "to" | "in" | "as" | "\u2192";

export type OperatorChar = "+" | "-" | "*" | "/" | "^" | "(" | ")";

export type BinaryOp = "+" | "-" | "*" | "/" | "^";

/** Where a token sits in the original input, before normalization. */
export type Located = {
  readonly start: number;
  readonly end: number;
  readonly raw: string;
};

export type Token =
  | (Located & { readonly kind: "number"; readonly value: number })
  | (Located & { readonly kind: "unit"; readonly unitId: string })
  | (Located & { readonly kind: "converter"; readonly converter: ConverterWord })
  | (Located & { readonly kind: "operator"; readonly op: OperatorChar })
  | (Located & { readonly kind: "function"; readonly name: "sqrt" })
  | (Located & {
      readonly kind: "clock";
      readonly hour: number;
      readonly minute: number;
      readonly second: number;
    })
  | (Located & { readonly kind: "timezone"; readonly zoneId: string })
  | (Located & { readonly kind: "now" })
  | (Located & { readonly kind: "unknown" });

/**
 * A span with two readings. Only `in` (converter or inch) is ambiguous in M2.
 * `enumerateReadings` splits it, so the parser never sees one.
 */
export type AmbiguousToken = Located & {
  readonly kind: "ambiguous";
  readonly converter: ConverterWord;
  readonly unitId: string;
};

export type LexToken = Token | AmbiguousToken;

export type Ast =
  | { kind: "number"; value: number }
  | { kind: "quantity"; value: number; unitId: string }
  | { kind: "unary"; op: "-"; inner: Ast }
  | { kind: "binary"; op: BinaryOp; left: Ast; right: Ast }
  | { kind: "sqrt"; inner: Ast }
  | { kind: "convert"; expr: Ast; toId: string }
  | { kind: "now" }
  | { kind: "clock"; hour: number; minute: number; second: number }
  | { kind: "zoned"; inner: Ast; zoneId: string }
  | { kind: "convert-zone"; expr: Ast; toZoneId: string };
