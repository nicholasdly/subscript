/**
 * Stage 5: tokens → AST.
 *
 * Time queries are a few exact shapes (`3pm PST in Tokyo`). Everything else is
 * a Pratt parser; leftover tokens mean the input is not an expression.
 * Adjacent quantities (`5 ft 11 in`, `5 m 11 cm`) are addition, same as `+`.
 */
import { NODE_COUNT_LIMIT, PARSE_DEPTH_LIMIT } from "../limits.ts";
import type { LimitName } from "../types.ts";
import type { Ast, BinaryOp, Token } from "./token.ts";

/** Success, or a failed parse. `limit` is set when a cap fired rather than a grammar miss. */
export type ParseResult =
  | { readonly ok: true; readonly ast: Ast }
  | { readonly ok: false; readonly limit?: LimitName };

function failedParse(): ParseResult {
  return { ok: false };
}

function okParse(ast: Ast): ParseResult {
  return { ok: true, ast };
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
const IMPLICIT_ADD_BP = BINARY["+"].lbp;

function isUnitBearing(ast: Ast): boolean {
  switch (ast.kind) {
    case "quantity":
    case "convert":
      return true;
    case "unary":
    case "sqrt":
      return isUnitBearing(ast.inner);
    case "binary":
      return isUnitBearing(ast.left) || isUnitBearing(ast.right);
    default:
      return false;
  }
}

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
    return okParse(ast);
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
      // `5 ft 11 in` / `5 m 11 cm`: a quantity beside another quantity is `+`.
      if (
        token.kind === "number" &&
        this.tokens[this.index + 1]?.kind === "unit" &&
        isUnitBearing(left) &&
        IMPLICIT_ADD_BP >= minBp
      ) {
        const right = this.parseExpr(BINARY["+"].rbp + 1);
        left =
          right === undefined ? undefined : this.node({ kind: "binary", op: "+", left, right });
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

function clockExpr(token: Extract<Token, { kind: "clock" }>): Extract<Ast, { kind: "clock" }> {
  return {
    kind: "clock",
    hour: token.hour,
    minute: token.minute,
    second: token.second,
  };
}

/** `3pm PST` */
function zonedClock(clock: Token | undefined, zone: Token | undefined): ParseResult | undefined {
  if (
    clock === undefined ||
    zone === undefined ||
    clock.kind !== "clock" ||
    zone.kind !== "timezone"
  ) {
    return undefined;
  }
  return okParse({
    kind: "zoned",
    inner: clockExpr(clock),
    zoneId: zone.zoneId,
  });
}

/** `now in Tokyo` */
function convertedNow(
  now: Token | undefined,
  converter: Token | undefined,
  zone: Token | undefined,
): ParseResult | undefined {
  if (
    now === undefined ||
    converter === undefined ||
    zone === undefined ||
    now.kind !== "now" ||
    converter.kind !== "converter" ||
    zone.kind !== "timezone"
  ) {
    return undefined;
  }
  return okParse({ kind: "convert-zone", expr: { kind: "now" }, toZoneId: zone.zoneId });
}

/** `3pm PST in Tokyo` */
function convertedClock(
  clock: Token | undefined,
  from: Token | undefined,
  converter: Token | undefined,
  to: Token | undefined,
): ParseResult | undefined {
  if (
    clock === undefined ||
    from === undefined ||
    converter === undefined ||
    to === undefined ||
    clock.kind !== "clock" ||
    from.kind !== "timezone" ||
    converter.kind !== "converter" ||
    to.kind !== "timezone"
  ) {
    return undefined;
  }
  return okParse({
    kind: "convert-zone",
    expr: { kind: "zoned", inner: clockExpr(clock), zoneId: from.zoneId },
    toZoneId: to.zoneId,
  });
}

function parseTimeQuery(tokens: readonly Token[]): ParseResult | undefined {
  const first = tokens[0];
  if (first === undefined || (first.kind !== "clock" && first.kind !== "now")) {
    return undefined;
  }

  if (tokens.length === 2) {
    return zonedClock(tokens[0], tokens[1]) ?? failedParse();
  }
  if (tokens.length === 3) {
    return convertedNow(tokens[0], tokens[1], tokens[2]) ?? failedParse();
  }
  if (tokens.length === 4) {
    return convertedClock(tokens[0], tokens[1], tokens[2], tokens[3]) ?? failedParse();
  }
  return failedParse();
}

/**
 * Tokens to AST. Time queries are a few exact shapes (`3pm PST in Tokyo`);
 * everything else is Pratt. A trailing `to ft` (or a bare trailing unit) is
 * the conversion target. Leftover tokens mean the input is not an expression.
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
