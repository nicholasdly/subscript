/**
 * Caps so untrusted keystroke input cannot hang or blow the stack.
 *
 * `INPUT_LENGTH_LIMIT` is characters of source text.
 * `PARSE_DEPTH_LIMIT` is Pratt recursion depth (groups and unary minus).
 * `NODE_COUNT_LIMIT` is AST nodes in one parse.
 * `MAX_ALIAS_LENGTH` is a single trie key.
 * `MAX_READINGS` is the cross-product of ambiguous tokens (`in`).
 */
export const INPUT_LENGTH_LIMIT = 256;
export const PARSE_DEPTH_LIMIT = 32;
export const NODE_COUNT_LIMIT = 64;
export const MAX_ALIAS_LENGTH = 32;
export const MAX_READINGS = 4;
