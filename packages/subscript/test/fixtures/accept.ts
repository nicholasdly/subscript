import type { Fixture } from "./types.ts";

export const accept: Fixture[] = [
  {
    name: "temp-c-to-f",
    input: "20 c to f",
    expect: { ok: true, text: "68 °F" },
    todo: true,
  },
  {
    name: "arith-km-to-miles",
    input: "(2 + 3) * 4 km in miles",
    expect: { ok: true, text: "12.427 mi" },
    todo: true,
    notes: "M3 may tighten significant figures.",
  },
  {
    name: "mixed-ft-in-cm",
    input: "5 ft 11 in cm",
    expect: { ok: true, text: "180.34 cm" },
    todo: true,
  },
  {
    name: "lex-min-not-m",
    input: "1 min",
    expect: { ok: true, text: "1 min" },
    todo: true,
    notes: "min is minute, not metre. Display text is a placeholder until M3.",
  },
  {
    name: "lex-m-in-ft",
    input: "1 m in ft",
    expect: { ok: true, text: "3.2808 ft" },
    todo: true,
    notes: "m is metre, in is converter, ft is foot. Figures may change in M3.",
  },
  {
    name: "usd-in-eur",
    input: "100 usd in eur",
    expect: { ok: false, reason: "rate-unavailable" },
    todo: true,
    notes: "Correct with no rate provider. Assert from M4.",
  },
  {
    name: "pst-in-tokyo",
    input: "3pm PST in Tokyo",
    expect: { ok: true, text: "8:00 JST" },
    todo: true,
    notes: "text is a placeholder until M5.",
  },
];
