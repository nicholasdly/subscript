import type { Token } from "./token.ts";

function isFoot(token: Token): boolean {
  return token.kind === "unit" && token.unitId === "foot";
}

function isInch(token: Token): boolean {
  return token.kind === "unit" && token.unitId === "inch";
}

function plusBetween(left: Token, right: Token): Token {
  return {
    kind: "operator",
    start: left.end,
    end: right.start,
    raw: "+",
    op: "+",
  };
}

export function rewrite(tokens: readonly Token[]): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const a = tokens[i];
    const b = tokens[i + 1];
    const c = tokens[i + 2];
    const d = tokens[i + 3];
    if (
      a !== undefined &&
      b !== undefined &&
      c !== undefined &&
      d !== undefined &&
      a.kind === "number" &&
      isFoot(b) &&
      c.kind === "number" &&
      isInch(d)
    ) {
      out.push(a, b, plusBetween(b, c), c, d);
      i += 4;
      continue;
    }
    if (a !== undefined) {
      out.push(a);
    }
    i += 1;
  }
  return out;
}

export function withoutAlt(token: Token): Token {
  if (token.alt === undefined) {
    return token;
  }
  const { alt: _alt, ...rest } = token;
  return rest;
}
