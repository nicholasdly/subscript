import assert from "node:assert/strict";
import { test } from "node:test";

import { lex } from "../src/lex.ts";
import { normalize } from "../src/normalize.ts";
import { rewrite, withoutAlt } from "../src/rewrite.ts";
import { buildTrie } from "../src/units/trie.ts";

const trie = buildTrie("en-US");

test("inserts + between feet and inches", () => {
  const lexed = lex(normalize("5 ft 11 in"), trie);
  const inch = lexed.map((token) =>
    token.alt?.unitId === "inch" ? withoutAlt(token.alt) : token,
  );
  const rewritten = rewrite(inch);
  assert.equal(rewritten[0]?.kind, "number");
  assert.equal(rewritten[1]?.unitId, "foot");
  assert.equal(rewritten[2]?.op, "+");
  assert.equal(rewritten[3]?.kind, "number");
  assert.equal(rewritten[4]?.unitId, "inch");
});

test("does not insert + between metres and centimetres", () => {
  const rewritten = rewrite(lex(normalize("5 m 11 cm"), trie));
  assert.equal(
    rewritten.some((token) => token.op === "+"),
    false,
  );
});
