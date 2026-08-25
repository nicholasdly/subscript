import { MAX_ALIAS_LENGTH } from "../limits.ts";
import type { ConverterWord } from "../token.ts";
import {
  aliasesFor,
  foldChar,
  isAllLetters,
  isLetter,
  type UnitAlias,
} from "./aliases.ts";
import { UNITS } from "./table.ts";

export type TrieHit =
  | { kind: "unit"; unitId: string; length: number; allLetters: boolean }
  | {
      kind: "ambiguous";
      length: number;
      allLetters: boolean;
      converter: ConverterWord;
      unitId: string;
    }
  | { kind: "converter"; converter: ConverterWord; length: number; allLetters: boolean }
  | { kind: "function"; name: "sqrt"; length: number; allLetters: boolean };

type TrieValue =
  | { kind: "unit"; unitId: string }
  | { kind: "converter"; converter: ConverterWord }
  | { kind: "function"; name: "sqrt" }
  | { kind: "ambiguous"; converter: ConverterWord; unitId: string };

type TrieNode = {
  children: Map<string, TrieNode>;
  value?: TrieValue;
  allLetters: boolean;
};

function newNode(): TrieNode {
  return { children: new Map(), allLetters: false };
}

function collapseSpaces(alias: string): string {
  return alias.normalize("NFC").replace(/\s+/g, " ").trim();
}

function insert(root: TrieNode, alias: string, value: TrieValue): void {
  const key = collapseSpaces(alias);
  if (key.length === 0 || key.length > MAX_ALIAS_LENGTH) {
    return;
  }
  let node = root;
  for (const ch of key) {
    const folded = foldChar(ch);
    let child = node.children.get(folded);
    if (child === undefined) {
      child = newNode();
      node.children.set(folded, child);
    }
    node = child;
  }
  node.allLetters = isAllLetters(key);
  if (node.value === undefined) {
    node.value = value;
    return;
  }
  if (node.value.kind === "ambiguous") {
    return;
  }
  if (node.value.kind === "unit" && value.kind === "converter") {
    node.value = {
      kind: "ambiguous",
      converter: value.converter,
      unitId: node.value.unitId,
    };
    return;
  }
  if (node.value.kind === "converter" && value.kind === "unit") {
    node.value = {
      kind: "ambiguous",
      converter: node.value.converter,
      unitId: value.unitId,
    };
  }
}

const SKIP_SYMBOLS = new Set([
  "",
  "gal",
  "imp gal",
  "fl oz",
  "imp fl oz",
  "\u0394\u00b0C",
  "\u0394\u00b0F",
]);
const SKIP_IDS = new Set(["1", "delta-celsius", "delta-fahrenheit"]);

function insertUnitAliases(root: TrieNode, aliases: readonly UnitAlias[]): void {
  for (const row of aliases) {
    insert(root, row.alias, { kind: "unit", unitId: row.id });
  }
}

function insertSymbols(root: TrieNode): void {
  for (const unit of UNITS) {
    if (SKIP_IDS.has(unit.id) || SKIP_SYMBOLS.has(unit.symbol)) {
      continue;
    }
    insert(root, unit.symbol, { kind: "unit", unitId: unit.id });
  }
}

export function buildTrie(locale: string): TrieNode {
  const root = newNode();
  insertUnitAliases(root, aliasesFor(locale));
  insertSymbols(root);
  insert(root, "to", { kind: "converter", converter: "to" });
  insert(root, "in", { kind: "converter", converter: "in" });
  insert(root, "as", { kind: "converter", converter: "as" });
  insert(root, "\u2192", { kind: "converter", converter: "\u2192" });
  insert(root, "sqrt", { kind: "function", name: "sqrt" });
  insert(root, "in", { kind: "unit", unitId: "inch" });
  return root;
}

function isWhitespace(ch: string): boolean {
  return /\s/u.test(ch);
}

export function matchTrie(root: TrieNode, text: string, start: number): TrieHit | undefined {
  let node = root;
  let i = start;
  let consumed = 0;
  const hits: { end: number; node: TrieNode }[] = [];

  while (i < text.length && consumed < MAX_ALIAS_LENGTH) {
    const cp = text.codePointAt(i);
    if (cp === undefined) {
      break;
    }
    const ch = String.fromCodePoint(cp);
    if (isWhitespace(ch)) {
      const spaceChild = node.children.get(" ");
      if (spaceChild === undefined) {
        break;
      }
      node = spaceChild;
      let j = i + ch.length;
      while (j < text.length) {
        const nextCp = text.codePointAt(j);
        if (nextCp === undefined) {
          break;
        }
        const nextCh = String.fromCodePoint(nextCp);
        if (!isWhitespace(nextCh)) {
          break;
        }
        j += nextCh.length;
      }
      consumed += 1;
      i = j;
    } else {
      const child = node.children.get(foldChar(ch));
      if (child === undefined) {
        break;
      }
      node = child;
      i += ch.length;
      consumed += ch.length;
    }
    if (node.value !== undefined) {
      hits.push({ end: i, node });
    }
  }

  for (let h = hits.length - 1; h >= 0; h--) {
    const hit = hits[h];
    if (hit === undefined) {
      continue;
    }
    const nextCh =
      hit.end < text.length ? String.fromCodePoint(text.codePointAt(hit.end) ?? 32) : "";
    const blocked = hit.node.allLetters && nextCh !== "" && isLetter(nextCh);
    if (blocked || hit.node.value === undefined) {
      continue;
    }
    const length = hit.end - start;
    const allLetters = hit.node.allLetters;
    const value = hit.node.value;
    if (value.kind === "unit") {
      return { kind: "unit", unitId: value.unitId, length, allLetters };
    }
    if (value.kind === "converter") {
      return { kind: "converter", converter: value.converter, length, allLetters };
    }
    if (value.kind === "function") {
      return { kind: "function", name: value.name, length, allLetters };
    }
    return {
      kind: "ambiguous",
      length,
      allLetters,
      converter: value.converter,
      unitId: value.unitId,
    };
  }

  return undefined;
}

export type { TrieNode };
