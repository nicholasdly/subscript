export type TokenKind =
  | "number"
  | "unit"
  | "converter"
  | "operator"
  | "function"
  | "unknown";

export type ConverterWord = "to" | "in" | "as" | "\u2192";

export type OperatorChar = "+" | "-" | "*" | "/" | "^" | "(" | ")";

export type Token = {
  readonly kind: TokenKind;
  readonly start: number;
  readonly end: number;
  readonly raw: string;
  readonly value?: number;
  readonly unitId?: string;
  readonly converter?: ConverterWord;
  readonly op?: OperatorChar;
  readonly name?: "sqrt";
  readonly alt?: Token;
};

export type Ast =
  | { kind: "number"; value: number }
  | { kind: "quantity"; value: number; unitId: string }
  | { kind: "unary"; op: "-"; inner: Ast }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Ast; right: Ast }
  | { kind: "sqrt"; inner: Ast }
  | { kind: "convert"; expr: Ast; toId: string };
