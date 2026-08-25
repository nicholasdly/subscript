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
  {
    name: "incomplete-to",
    input: "20 c to",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "inverted",
    input: "km in m",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "bare-two-units",
    input: "km m",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "comment-for",
    input: "10 m for scale",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "incomplete-exponent",
    input: "1e",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "spaced-exponent",
    input: "1 e3",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "lowercase-try",
    input: "100 try",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "lowercase-all",
    input: "100 all in usd",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "usd-100-words",
    input: "usd 100",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "dollar-for-lunch",
    input: "$10 for lunch",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "bare-3pm",
    input: "3pm",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "bare-now",
    input: "now",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "pm-without-hour",
    input: "pm PST",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "clock-in-tokyo",
    input: "3pm in Tokyo",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "invalid-hour",
    input: "25:00 PST in Tokyo",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "cst-means-china",
    input: "3pm China Standard",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "iana-path",
    input: "3pm America/Los_Angeles in Tokyo",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "time-in-paris",
    input: "time in Paris",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "clock-plus-hour",
    input: "3pm PST + 2 hours",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "celsius-in-tokyo",
    input: "20 c in Tokyo",
    expect: { ok: false, reason: "not-an-expression" },
  },
  {
    name: "pst-in-metres",
    input: "3pm PST in metres",
    expect: { ok: false, reason: "not-an-expression" },
  },
];
