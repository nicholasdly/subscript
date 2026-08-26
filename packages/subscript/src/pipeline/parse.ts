/**
 * Stage 5: tokens → AST.
 *
 * Time queries are a few exact shapes (`3pm PST in Tokyo`). Everything else is
 * a Pratt parser; leftover tokens mean the input is not an expression.
 */
import { NODE_COUNT_LIMIT, PARSE_DEPTH_LIMIT } from "../limits.ts";
import type { LimitName } from "../types.ts";
import type { Ast, BinaryOp, Token } from "./token.ts";

export type ParseResult =
  | { readonly ok: true; readonly ast: Ast }
  | { readonly ok: false; readonly limit?: LimitName };

function failedParse(): ParseResult {
  return { ok: false };
}

type Binding = { readonly lbp: number; readonly rbp: number };

const BINARY: Record<BinaryOp, Binding> = {
  "+": { lbp: 10, rbp: 10 },
  "-": { lbp: 10, rbp: 10 },
  "*": { lbp: 20, rbp: 20 },
  "/": { lbp: 20, rbp: 20 },
  "^": { lbp: 30, rbp: 29 },
};

const PREFIX_BP = BINARY["^"].lbp; // Exponentiation binds inside unary minus.
const POSTFIX_UNIT_BP = 50;
const IMPLICIT_MUL_BP = 20;

/**
 * Pratt parser. Every node goes through `node` and every recursion through
 * `enter`, so a limit stops the parse instead of the stack.
 */
class Parser {
  private readonly tokens: readonly Token[];
  private index = 0;
  private depth = 0;
  private nodes = 0;
  private limit: LimitName | undefined;

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  parse(convertTo: string | undefined): ParseResult {
    let ast = this.parseExpr(0);
    if (ast === undefined || this.index < this.tokens.length) {
      return this.failure();
    }
    if (convertTo !== undefined) {
      ast = this.node({ kind: "convert", expr: ast, toId: convertTo });
      if (ast === undefined) {
        return this.failure();
      }
    }
    return { ok: true, ast };
  }

  private failure(): ParseResult {
    return this.limit === undefined ? failedParse() : { ok: false, limit: this.limit };
  }

  private node<T extends Ast>(ast: T): T | undefined {
    this.nodes += 1;
    if (this.nodes > NODE_COUNT_LIMIT) {
      this.limit = "node-count";
      return undefined;
    }
    return ast;
  }

  private enter(): boolean {
    if (this.depth >= PARSE_DEPTH_LIMIT) {
      this.limit = "parse-depth";
      return false;
    }
    this.depth += 1;
    return true;
  }

  private leave(): void {
    this.depth -= 1;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private advance(): Token | undefined {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private parseExpr(minBp: number): Ast | undefined {
    let left = this.parsePrefix();

    while (left !== undefined) {
      const token = this.peek();
      if (token === undefined) {
        break;
      }
      if (token.kind === "unit" && POSTFIX_UNIT_BP >= minBp) {
        this.advance();
        left = this.applyUnit(left, token.unitId);
        continue;
      }
      if (token.kind !== "operator") {
        break;
      }
      if (token.op === "(") {
        // `2(3+4)` is `2 * (3+4)`; the prefix parser consumes the group.
        if (IMPLICIT_MUL_BP < minBp) {
          break;
        }
        const right = this.parsePrefix();
        left =
          right === undefined ? undefined : this.node({ kind: "binary", op: "*", left, right });
        continue;
      }
      if (token.op === ")") {
        break;
      }
      const binding = BINARY[token.op];
      if (binding.lbp < minBp) {
        break;
      }
      this.advance();
      const right = this.parseExpr(binding.rbp + 1);
      left =
        right === undefined ? undefined : this.node({ kind: "binary", op: token.op, left, right });
    }

    return left;
  }

  /** A unit after a bare number makes a quantity; after anything else it multiplies. */
  private applyUnit(left: Ast, unitId: string): Ast | undefined {
    if (left.kind === "number") {
      return this.node({ kind: "quantity", value: left.value, unitId });
    }
    const one = this.node({ kind: "quantity", value: 1, unitId });
    return one === undefined ? undefined : this.node({ kind: "binary", op: "*", left, right: one });
  }

  private parsePrefix(): Ast | undefined {
    const token = this.advance();
    if (token === undefined) {
      return undefined;
    }
    if (token.kind === "number") {
      return this.node({ kind: "number", value: token.value });
    }
    if (token.kind === "function") {
      const open = this.advance();
      return open?.kind === "operator" && open.op === "(" ? this.parseGroup("sqrt") : undefined;
    }
    if (token.kind !== "operator") {
      return undefined;
    }
    if (token.op === "(") {
      return this.parseGroup("group");
    }
    if (token.op === "-") {
      if (!this.enter()) {
        return undefined;
      }
      const inner = this.parseExpr(PREFIX_BP);
      this.leave();
      return inner === undefined ? undefined : this.node({ kind: "unary", op: "-", inner });
    }
    return undefined;
  }

  /** Parses up to and including the closing `)`. The opening one is already consumed. */
  private parseGroup(wrap: "group" | "sqrt"): Ast | undefined {
    if (!this.enter()) {
      return undefined;
    }
    const inner = this.parseExpr(0);
    this.leave();
    const close = this.advance();
    if (inner === undefined || close?.kind !== "operator" || close.op !== ")") {
      return undefined;
    }
    return wrap === "group" ? inner : this.node({ kind: "sqrt", inner });
  }
}

function parseTokens(tokens: readonly Token[], convertTo: string | undefined): ParseResult {
  if (
    tokens.some(
      (token) =>
        token.kind === "unknown" ||
        token.kind === "clock" ||
        token.kind === "timezone" ||
        token.kind === "now",
    )
  ) {
    return failedParse();
  }
  return new Parser(tokens).parse(convertTo);
}

function parseTimeQuery(tokens: readonly Token[]): ParseResult | undefined {
  const first = tokens[0];
  if (first === undefined || (first.kind !== "clock" && first.kind !== "now")) {
    return undefined;
  }

  if (
    tokens.length === 4 &&
    tokens[0]?.kind === "clock" &&
    tokens[1]?.kind === "timezone" &&
    tokens[2]?.kind === "converter" &&
    tokens[3]?.kind === "timezone"
  ) {
    return {
      ok: true,
      ast: {
        kind: "convert-zone",
        expr: {
          kind: "zoned",
          inner: {
            kind: "clock",
            hour: tokens[0].hour,
            minute: tokens[0].minute,
            second: tokens[0].second,
          },
          zoneId: tokens[1].zoneId,
        },
        toZoneId: tokens[3].zoneId,
      },
    };
  }

  if (tokens.length === 2 && tokens[0]?.kind === "clock" && tokens[1]?.kind === "timezone") {
    return {
      ok: true,
      ast: {
        kind: "zoned",
        inner: {
          kind: "clock",
          hour: tokens[0].hour,
          minute: tokens[0].minute,
          second: tokens[0].second,
        },
        zoneId: tokens[1].zoneId,
      },
    };
  }

  if (
    tokens.length === 3 &&
    tokens[0]?.kind === "now" &&
    tokens[1]?.kind === "converter" &&
    tokens[2]?.kind === "timezone"
  ) {
    return {
      ok: true,
      ast: { kind: "convert-zone", expr: { kind: "now" }, toZoneId: tokens[2].zoneId },
    };
  }

  return failedParse();
}

/**
 * A trailing `converter unit` or bare trailing `unit` is the conversion target;
 * everything before it is the expression. Anything left over is a failure.
 */
export function parse(tokens: readonly Token[]): ParseResult {
  const time = parseTimeQuery(tokens);
  if (time !== undefined) {
    return time;
  }

  const last = tokens[tokens.length - 1];
  const previous = tokens[tokens.length - 2];

  if (last?.kind === "unit" && previous?.kind === "converter") {
    return parseTokens(tokens.slice(0, -2), last.unitId);
  }
  if (last?.kind === "unit" && previous?.kind === "unit") {
    const converted = parseTokens(tokens.slice(0, -1), last.unitId);
    if (converted.ok || converted.limit !== undefined) {
      return converted;
    }
  }
  return parseTokens(tokens, undefined);
}
