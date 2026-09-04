/**
 * Token and AST shapes. The parser never sees an `ambiguous` token; `rank.ts`
 * splits those first.
 */

/** `to`, `in`, `as`, or `→`. `in` may also be inch; that is {@link AmbiguousToken}. */
export type ConverterWord = "to" | "in" | "as" | "\u2192";

export type OperatorChar = "+" | "-" | "*" | "/" | "^" | "(" | ")";

export type BinaryOp = "+" | "-" | "*" | "/" | "^";

/** Where a token sits in the original input, before normalization. */
export type Located = {
  readonly start: number;
  readonly end: number;
  /** Slice of the normalized string, not the original graphemes. */
  readonly raw: string;
};

/**
 * A token the parser may see. `clock` / `now` / `timezone` are time-query
 * only; leftover `unknown` fails the parse.
 */
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
 * A span with two readings: converter `in`, or the unit inch.
 * `enumerateReadings` splits it, so the parser never sees one.
 */
export type AmbiguousToken = Located & {
  readonly kind: "ambiguous";
};

export type LexToken = Token | AmbiguousToken;

/**
 * Evaluated by `evaluateAst`. Time queries use `zoned` / `convert-zone`;
 * arithmetic uses the rest. Bare `now` and `clock` are not expressions until
 * they sit inside a zoned node.
 */
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
