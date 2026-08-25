import { NODE_COUNT_LIMIT, PARSE_DEPTH_LIMIT } from "./limits.ts";
import type { LimitName } from "./types.ts";
import type { Ast, OperatorChar, Token } from "./token.ts";

export type ParseOk = { readonly ok: true; readonly ast: Ast };
export type ParseErr = {
  readonly ok: false;
  readonly limit?: LimitName;
};
export type ParseResult = ParseOk | ParseErr;

const notExpr: ParseErr = { ok: false };

type Bp = { lbp: number; rbp: number };

const INFIX: Record<string, Bp> = {
  "+": { lbp: 10, rbp: 10 },
  "-": { lbp: 10, rbp: 10 },
  "*": { lbp: 20, rbp: 20 },
  "/": { lbp: 20, rbp: 20 },
  "^": { lbp: 30, rbp: 29 },
};

const PREFIX_BP = 40;
const POSTFIX_UNIT_BP = 50;
const IMPLICIT_MUL_BP = 20;

class Parser {
  i = 0;
  depth = 0;
  nodes = 0;
  limit: LimitName | undefined;
  tokens: readonly Token[];

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  fail(): ParseErr {
    return this.limit === undefined ? notExpr : { ok: false, limit: this.limit };
  }

  peek(): Token | undefined {
    return this.tokens[this.i];
  }

  advance(): Token | undefined {
    const token = this.tokens[this.i];
    this.i += 1;
    return token;
  }

  node<T extends Ast>(ast: T): T | undefined {
    this.nodes += 1;
    if (this.nodes > NODE_COUNT_LIMIT) {
      this.limit = "node-count";
      return undefined;
    }
    return ast;
  }

  enter(): boolean {
    this.depth += 1;
    if (this.depth > PARSE_DEPTH_LIMIT) {
      this.limit = "parse-depth";
      this.depth -= 1;
      return false;
    }
    return true;
  }

  leave(): void {
    this.depth -= 1;
  }

  parseExpr(minBp: number): Ast | undefined {
    let left = this.parsePrefix();
    if (left === undefined) {
      return undefined;
    }
    for (;;) {
      const token = this.peek();
      if (token === undefined) {
        break;
      }
      if (token.kind === "unit" && token.unitId !== undefined && POSTFIX_UNIT_BP >= minBp) {
        this.advance();
        left = this.applyUnit(left, token.unitId);
        if (left === undefined) {
          return undefined;
        }
        continue;
      }
      if (token.kind === "operator" && token.op === "(" && IMPLICIT_MUL_BP >= minBp) {
        const right = this.parsePrefix();
        if (right === undefined) {
          return undefined;
        }
        left = this.node({ kind: "binary", op: "*", left, right });
        if (left === undefined) {
          return undefined;
        }
        continue;
      }
      if (token.kind !== "operator" || token.op === undefined) {
        break;
      }
      const spec = INFIX[token.op];
      if (spec === undefined || spec.lbp < minBp) {
        break;
      }
      this.advance();
      const right = this.parseExpr(spec.rbp + 1);
      if (right === undefined) {
        return undefined;
      }
      left = this.node({
        kind: "binary",
        op: token.op as "+" | "-" | "*" | "/" | "^",
        left,
        right,
      });
      if (left === undefined) {
        return undefined;
      }
    }
    return left;
  }

  applyUnit(left: Ast, unitId: string): Ast | undefined {
    if (left.kind === "number") {
      return this.node({ kind: "quantity", value: left.value, unitId });
    }
    const one = this.node({ kind: "quantity", value: 1, unitId });
    if (one === undefined) {
      return undefined;
    }
    return this.node({ kind: "binary", op: "*", left, right: one });
  }

  parsePrefix(): Ast | undefined {
    const token = this.advance();
    if (token === undefined) {
      return undefined;
    }
    if (token.kind === "number" && token.value !== undefined) {
      return this.node({ kind: "number", value: token.value });
    }
    if (token.kind === "operator" && token.op === "-") {
      if (!this.enter()) {
        return undefined;
      }
      const inner = this.parseExpr(PREFIX_BP);
      this.leave();
      if (inner === undefined) {
        return undefined;
      }
      return this.node({ kind: "unary", op: "-", inner });
    }
    if (token.kind === "operator" && token.op === "(") {
      if (!this.enter()) {
        return undefined;
      }
      const inner = this.parseExpr(0);
      this.leave();
      const close = this.advance();
      if (inner === undefined || close?.op !== ")") {
        return undefined;
      }
      return inner;
    }
    if (token.kind === "function" && token.name === "sqrt") {
      const open = this.advance();
      if (open?.op !== "(") {
        return undefined;
      }
      if (!this.enter()) {
        return undefined;
      }
      const inner = this.parseExpr(0);
      this.leave();
      const close = this.advance();
      if (inner === undefined || close?.op !== ")") {
        return undefined;
      }
      return this.node({ kind: "sqrt", inner });
    }
    return undefined;
  }

  eof(): boolean {
    return this.i >= this.tokens.length;
  }
}

function parseAll(tokens: readonly Token[]): ParseResult {
  if (tokens.some((token) => token.kind === "unknown")) {
    return notExpr;
  }
  const parser = new Parser(tokens);
  const ast = parser.parseExpr(0);
  if (ast === undefined || !parser.eof()) {
    return parser.fail();
  }
  return { ok: true, ast };
}

function wrapConvert(inner: ParseResult, toId: string): ParseResult {
  if (!inner.ok) {
    return inner;
  }
  const parser = new Parser([]);
  parser.nodes = countNodes(inner.ast);
  const ast = parser.node({ kind: "convert", expr: inner.ast, toId });
  if (ast === undefined) {
    return parser.fail();
  }
  return { ok: true, ast };
}

function countNodes(ast: Ast): number {
  switch (ast.kind) {
    case "number":
    case "quantity":
      return 1;
    case "unary":
    case "sqrt":
      return 1 + countNodes(ast.inner);
    case "binary":
      return 1 + countNodes(ast.left) + countNodes(ast.right);
    case "convert":
      return 1 + countNodes(ast.expr);
  }
}

export function parse(tokens: readonly Token[]): ParseResult {
  if (tokens.length === 0) {
    return notExpr;
  }
  const last = tokens[tokens.length - 1];
  const prev = tokens[tokens.length - 2];
  if (
    last?.kind === "unit" &&
    last.unitId !== undefined &&
    prev?.kind === "converter"
  ) {
    return wrapConvert(parseAll(tokens.slice(0, -2)), last.unitId);
  }
  if (last?.kind === "unit" && last.unitId !== undefined && prev?.kind === "unit") {
    const inner = parseAll(tokens.slice(0, -1));
    if (inner.ok) {
      return wrapConvert(inner, last.unitId);
    }
    if (inner.limit !== undefined) {
      return inner;
    }
  }
  return parseAll(tokens);
}

export type { OperatorChar };
