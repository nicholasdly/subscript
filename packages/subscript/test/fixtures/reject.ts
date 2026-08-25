import type { Fixture } from "./types.ts";

export const reject: Fixture[] = [
  {
    name: "empty",
    input: "",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "whitespace",
    input: "   ",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "hello-world",
    input: "hello world",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "send-to-john",
    input: "send this to john in accounting",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "whats-the-weather",
    input: "what's the weather",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "url",
    input: "https://example.com",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "bare-for",
    input: "for lunch",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "eval-call",
    input: 'eval("pwn")',
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "js-expr",
    input: 'constructor.constructor("alert(1)")()',
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "question",
    input: "how many ounces in a cup of coffee near me",
    expect: { ok: false, reason: "not-an-expression" },
  },
];
