import { MAX_ALIAS_LENGTH } from "../limits.ts";
import { ZONE_ALIASES } from "../time/aliases.ts";
import { aliasesFor, UNIT_ALIASES, volumeLocale, type VolumeLocale } from "../units/aliases.ts";
import type { UnitDef } from "../units/kinds.ts";
import { UNITS } from "../units/table.ts";
import { charAt, foldChar, isAllLetters, isLetter, isWhitespace, skipWhitespace } from "./chars.ts";
import type { ConverterWord } from "./token.ts";

/**
 * The alias trie the lexer matches against.
 *
 * Built once from unit aliases, unit symbols, converters, `now`, and zone
 * aliases. Leftmost-longest match; letter keys need a word boundary so
 * `minimum` is not `min`.
 */

export type TrieValue =
  | { kind: "unit"; unitId: string }
  | { kind: "converter"; converter: ConverterWord }
  | { kind: "function"; name: "sqrt" }
  | { kind: "ambiguous"; converter: ConverterWord; unitId: string }
  | { kind: "timezone"; zoneId: string }
  | { kind: "now" };

export type TrieMatch = {
  readonly value: TrieValue;
  readonly length: number;
};

type TrieNode = {
  children: Map<string, TrieNode>;
  value?: TrieValue;
  /** True when the key ending here is all letters, so it needs a word boundary. */
  allLetters: boolean;
};

function newNode(): TrieNode {
  return { children: new Map(), allLetters: false };
}

function insert(root: TrieNode, alias: string, value: TrieValue): void {
  const key = alias.normalize("NFC").replace(/\s+/g, " ").trim();
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
  node.value = merge(node.value, value);
}

/** A key inserted as both a unit and a converter becomes one ambiguous reading. */
function merge(existing: TrieValue | undefined, added: TrieValue): TrieValue {
  if (existing === undefined) {
    return added;
  }
  if (existing.kind === "unit" && added.kind === "converter") {
    return { kind: "ambiguous", converter: added.converter, unitId: existing.unitId };
  }
  if (existing.kind === "converter" && added.kind === "unit") {
    return { kind: "ambiguous", converter: existing.converter, unitId: added.unitId };
  }
  return existing;
}

/** Ids whose spelling depends on the locale, so only §5 aliases may reach them. */
const LOCALE_SCOPED_IDS = new Set(
  UNIT_ALIASES.filter((row) => row.locale !== undefined).map((row) => row.id),
);

function symbolIsTypeable(unit: UnitDef): boolean {
  return unit.symbol !== "" && unit.affine !== "difference" && !LOCALE_SCOPED_IDS.has(unit.id);
}

function build(volume: VolumeLocale): TrieNode {
  const root = newNode();
  for (const row of aliasesFor(volume)) {
    insert(root, row.alias, { kind: "unit", unitId: row.id });
  }
  for (const unit of UNITS) {
    if (symbolIsTypeable(unit)) {
      insert(root, unit.symbol, { kind: "unit", unitId: unit.id });
    }
  }
  insert(root, "to", { kind: "converter", converter: "to" });
  insert(root, "as", { kind: "converter", converter: "as" });
  insert(root, "\u2192", { kind: "converter", converter: "\u2192" });
  insert(root, "sqrt", { kind: "function", name: "sqrt" });
  insert(root, "in", { kind: "converter", converter: "in" });
  insert(root, "in", { kind: "unit", unitId: "inch" });
  insert(root, "now", { kind: "now" });
  for (const row of ZONE_ALIASES) {
    insert(root, row.alias, { kind: "timezone", zoneId: row.id });
  }
  return root;
}

const tries = new Map<string, TrieNode>();

/** Tries are immutable once built; keyed by volume locale. */
export function trieFor(locale: string): TrieNode {
  const volume = volumeLocale(locale);
  let trie = tries.get(volume);
  if (trie === undefined) {
    trie = build(volume);
    tries.set(volume, trie);
  }
  return trie;
}

/** An all-letter alias may not end in the middle of a word: `minimum` is not `min`. */
function needsBoundary(node: TrieNode, text: string, end: number): boolean {
  return node.allLetters && isLetter(charAt(text, end));
}

/** Longest alias starting at `start`, or `undefined` when none matches. */
export function matchTrie(root: TrieNode, text: string, start: number): TrieMatch | undefined {
  let node = root;
  let i = start;
  let consumed = 0;
  let best: TrieMatch | undefined;

  while (i < text.length && consumed < MAX_ALIAS_LENGTH) {
    const ch = charAt(text, i);
    if (isWhitespace(ch)) {
      const child = node.children.get(" ");
      if (child === undefined) {
        break;
      }
      node = child;
      i = skipWhitespace(text, i);
      consumed += 1;
    } else {
      const child = node.children.get(foldChar(ch));
      if (child === undefined) {
        break;
      }
      node = child;
      i += ch.length;
      consumed += ch.length;
    }
    if (node.value !== undefined && !needsBoundary(node, text, i)) {
      best = { value: node.value, length: i - start };
    }
  }

  return best;
}

export type { TrieNode };
