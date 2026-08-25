# M0 — Foundations

Implementation plan for the first milestone in [`docs/plan.md`](../plan.md). That document is
_why_. This one is _what_, _where_, and _in what order_.

M0 is cheap and everything after it depends on it: a test runner, table-driven fixtures, a
reviewable public API that does not yet compute anything, a package that actually resolves, and a
provenance log for work that will span many implementation plans. No units, no lexer, no parser.

**Exit:** `npm test` is green, the fixtures run, and `evaluate("20 c to f")` returns
`{ ok: false, reason: { kind: "not-an-expression" } }` through a committed, typed API.

---

## 0. Current state

| Item              | Today                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Library source    | `packages/subscript/src/parse.ts` — `export function parse() {}`   |
| Tests             | none, no runner, no `test` task in `turbo.json`                    |
| Package name      | `@repo/subscript` (keep it; publishing is later)                   |
| `exports.default` | `./dist/parse.ts` — a `.ts` path under `dist/`, will not resolve   |
| `exports.types`   | `./src/parse.ts`                                                   |
| Consumers         | `apps/web` depends on `@repo/subscript` and does not import it yet |
| Provenance doc    | missing                                                            |
| Runtime deps      | zero (keep it that way)                                            |
| Node              | `>=24` (native type stripping, `node:test`)                        |

---

## 1. Decisions

### 1.1 Package name stays `@repo/subscript`

Do not rename. The public npm name is a publish-time decision. Fix `exports` so the package
resolves; leave `name` alone.

### 1.2 Test runner: `node:test` + `node:assert`

No Vitest, no Jest, no extra dependency.

- Package script: `"test": "node --test test/"`
- Tests import `../src/index.ts` directly (Node 24 strips types). `typecheck` and `build` stay
  separate.
- Root script: `"test": "turbo run test"`
- `turbo.json` gets a `test` task. Packages without a `test` script are skipped.

### 1.3 Fixtures, not a “corpus”

`plan.md` and `research.md` say “corpus” because that is the NLP word Duckling uses for a pile of
`input → expected` examples. In ordinary software this is **table-driven tests** (or **fixtures**):
an array of cases a test file loops over. Same idea, usual name.

Use TypeScript modules, not JSONL. The cases are then typed against `Result`, comments work, and
there is no custom file parser.

```
test/
  api.test.ts              # never throws; Result shape
  fixtures.test.ts         # loops the tables
  fixtures/
    accept.ts              # inputs that should eventually succeed
    reject.ts              # inputs that must never parse
```

Reject cases are asserted now. Accept cases that the stub cannot satisfy yet are registered with
`test.todo` (or a `todo: true` flag the loop honors). When a milestone makes a case pass, drop
the todo — do not invent a `CURRENT_MILESTONE` gate.

### 1.4 `spans` is typed, returns `[]`

`plan.md` §2.3: design the highlighting surface so hosts do not reach into internals. A stub
method is cheaper than discovering it is missing at M2.

Do not export pipeline stages. There is no pipeline yet.

### 1.5 `Quantity` is a typed hole

`Result` mentions it, so the type has to exist. It does not convert. M1 fills it in; keep field
names (`value`, `unit`) so that is additive.

### 1.6 Default `now` may read the clock; tests never do

The default instance behind free `evaluate()` uses `Date.now`. Tests always go through
`createSubscript({ now: () => REFERENCE_INSTANT })`. `now` returns `{ epochMilliseconds: number }`.
No `Temporal` in M0.

---

## 2. Target layout

```
docs/provenance.md

packages/subscript/
  package.json
  tsconfig.json
  tsconfig.test.json          # editor typecheck for tests; noEmit
  src/
    index.ts
    types.ts
    create.ts
    evaluate.ts
  test/
    api.test.ts
    fixtures.test.ts
    fixtures/
      accept.ts
      reject.ts
```

Delete `src/parse.ts`. The public verb is `evaluate`. `parse` comes back in M2 as an internal
stage, not a published function.

---

## 3. Public API

Types and a stub. Nothing parses.

### 3.1 Barrel (`src/index.ts`)

Export `evaluate`, `createSubscript`, and the types below. No default export.

### 3.2 Types (`src/types.ts`)

```ts
export type Instant = { readonly epochMilliseconds: number };
export type NowFn = () => Instant;

export type LimitName = "input-length" | "parse-depth" | "node-count";

export interface Unit {
  readonly id: string;
  readonly symbol: string;
}

export interface Quantity {
  readonly value: number;
  readonly unit: Unit;
}

export type Candidate = {
  readonly token: string;
  readonly unit: Unit;
};

export type Alternate = {
  readonly value: Quantity;
  readonly text: string;
  readonly reason: string;
};

export type SpanKind =
  | "number"
  | "unit"
  | "currency"
  | "timezone"
  | "operator"
  | "converter"
  | "punctuation"
  | "unknown";

export type Span = {
  readonly start: number;
  readonly end: number;
  readonly kind: SpanKind;
};

export type Failure =
  | { kind: "not-an-expression" }
  | { kind: "dimension-mismatch"; from: Unit; to: Unit }
  | { kind: "unknown-unit"; token: string }
  | { kind: "ambiguous"; token: string; candidates: readonly Candidate[] }
  | { kind: "rate-unavailable"; currency: string }
  | { kind: "rate-pending"; currency: string }
  | { kind: "precision-loss" }
  | { kind: "limit-exceeded"; limit: LimitName };

export type Result =
  | { ok: true; value: Quantity; text: string; alternates?: readonly Alternate[] }
  | { ok: false; reason: Failure };

export type RateProvider = {
  quote(from: string, to: string): unknown; // shaped in M4
};
```

`RateProvider` exists so `SubscriptConfig` can mention it. M0 never calls it.

`limit-exceeded` is in the union so the security boundary is visible. Do not enforce caps in M0.

### 3.3 Instance (`src/create.ts`)

```ts
export type SubscriptConfig = {
  locale?: string; // default "en-US"
  now?: NowFn; // default () => ({ epochMilliseconds: Date.now() })
  rates?: RateProvider; // absent ⇒ currency later returns rate-unavailable
};

export type Subscript = {
  evaluate(input: string): Result;
  spans(input: string): readonly Span[];
};

export function createSubscript(config?: SubscriptConfig): Subscript;
```

Every `evaluate` call returns `{ ok: false, reason: { kind: "not-an-expression" } }`.
Every `spans` call returns `[]`. Nothing throws.

Capture config in a closure. Do not mutate it afterward.

### 3.4 Free function (`src/evaluate.ts`)

```ts
export function evaluate(input: string): Result;
```

Wrapper over a lazy `createSubscript()` with no args. No options parameter in M0. Configure via
`createSubscript`.

### 3.5 Consumer view

```ts
import { evaluate, createSubscript } from "@repo/subscript";

evaluate("20 c to f");
// { ok: false, reason: { kind: "not-an-expression" } }

const subscript = createSubscript({ locale: "en-US" });
subscript.evaluate("20 c to f"); // same
subscript.spans("20 c to f"); // []
```

Do not write a library README in M0.

---

## 4. Fixtures

### 4.1 Shared bits

```ts
export const REFERENCE_INSTANT = {
  epochMilliseconds: Date.UTC(2013, 1, 12, 4, 30, 0),
} as const;
// 2013-02-12T04:30:00.000Z — same instant Duckling uses, so relative dates in M5
// do not need a time-base migration.
```

`fixtures.test.ts` always calls:

```ts
createSubscript({
  locale: c.locale ?? "en-US",
  now: () => c.now ?? REFERENCE_INSTANT,
});
```

```ts
export type Fixture = {
  name: string;
  input: string;
  locale?: string;
  now?: Instant;
  expect: { ok: true; text: string } | { ok: false; reason: Failure["kind"] };
  todo?: boolean; // not asserted yet; still fails the run if evaluate throws
  notes?: string;
};
```

`name` is the test title and must be unique across both files (check at load). Keep names
kebab-case.

M0 asserts `ok` / `reason`. Put `text` on accept cases now so M3 does not revisit every row
(`plan.md` M3: assert the formatted string). Do not put a numeric `value` on these rows; M1’s
programmatic conversions are ordinary unit tests next to `Quantity`, not NL fixtures.

### 4.2 Loop (`test/fixtures.test.ts`)

For each fixture: call `evaluate`, assert the return is a well-formed `Result` (object, `ok` is
boolean; on failure, `reason.kind` is a known string). A throw always fails.

Then, if `todo` is set, `t.todo(name)` for the equality assert. Otherwise assert `expect`.

Use `node:assert/strict`. No snapshots.

### 4.3 Accept (`test/fixtures/accept.ts`)

Seed the examples already in `research.md` §1 / `plan.md` M2–M5. All `todo: true` in M0. Cap at
about 15 rows — the loop is the artifact, not a fake encyclopedia.

| `name`              | `input`                   | Eventual `expect`                                             |
| ------------------- | ------------------------- | ------------------------------------------------------------- |
| `temp-c-to-f`       | `20 c to f`               | `{ ok: true, text: "68 °F" }`                                 |
| `arith-km-to-miles` | `(2 + 3) * 4 km in miles` | `{ ok: true, text: "12.427 mi" }` (M3 may tighten)            |
| `mixed-ft-in-cm`    | `5 ft 11 in cm`           | `{ ok: true, text: "180.34 cm" }`                             |
| `lex-min-not-m`     | `1 min`                   | minute, not metre                                             |
| `lex-m-in-ft`       | `1 m in ft`               | `m` = metre, `in` = converter                                 |
| `usd-in-eur`        | `100 usd in eur`          | with no provider: `{ ok: false, reason: "rate-unavailable" }` |
| `pst-in-tokyo`      | `3pm PST in Tokyo`        | placeholder `text` + `notes` until M5                         |

Placeholder `text` is fine when the real string is not knowable yet. Omit the row rather than
guess silently.

`1 min` is an accept case, not a reject case.

### 4.4 Reject (`test/fixtures/reject.ts`)

No `todo`. All `{ ok: false, reason: "not-an-expression" }`. They must still fail after M2.

| `name`              | `input`                                      | Why                             |
| ------------------- | -------------------------------------------- | ------------------------------- |
| `empty`             | `""`                                         |                                 |
| `whitespace`        | `"   "`                                      |                                 |
| `hello-world`       | `hello world`                                | prose                           |
| `send-to-john`      | `send this to john in accounting`            | contains `to` and `in`          |
| `whats-the-weather` | `what's the weather`                         | launcher noise                  |
| `url`               | `https://example.com`                        |                                 |
| `bare-for`          | `for lunch`                                  | comment words are not v1        |
| `eval-call`         | `eval("pwn")`                                | we never eval                   |
| `js-expr`           | `constructor.constructor("alert(1)")()`      | must not execute                |
| `question`          | `how many ounces in a cup of coffee near me` | extra prose; strict consumption |

That last row is the trigger test. A tolerant parser might still return 8 fl oz. We must not.

---

## 5. Package wiring

### 5.1 `packages/subscript/package.json`

Keep `"name": "@repo/subscript"`. Change:

- `"exports"."."."default"` → `./dist/index.js` (the actual bug)
- `"exports"."."."types"` → `./src/index.ts` (source, for monorepo go-to-definition)
- `"test": "node --test test/"`
- `"files": ["dist"]` so the publish shape is visible; `"private": true` stays

Do not bump a real semver. Leave version as it is, or `0.0.0` if none exists.

### 5.2 `apps/web`

Do not change the dependency. Do not wire the demo. That is M2.

### 5.3 `turbo.json`

```json
"test": {
  "dependsOn": ["^build"],
  "inputs": ["$TURBO_DEFAULT$"],
  "outputs": []
}
```

### 5.4 Root `package.json`

`"test": "turbo run test"`

### 5.5 Typecheck for tests

`packages/subscript/tsconfig.json` `include` stays `["src"]` so `tsc` does not emit tests.

Add `tsconfig.test.json` that extends it with `"noEmit": true`, `"rootDir": "."`,
`"include": ["src", "test"]`.

---

## 6. Provenance

`docs/plan.md` is the destination. `docs/plans/` are the steps. `docs/provenance.md` is the trail:
what we actually did, in order, so later plans can see which decisions already landed and which
were reversed.

It is not a license file, not a changelog of every commit, and not a dump of unit conversion
factors. Append after a plan is implemented, not while drafting it.

### Shape

Newest entry at the top. Each entry names the plan, says what shipped, and records decisions a
later plan should not silently undo. Unit-data citations (NIST, CODATA, and so on) belong here
too when M1 adds tables — as part of that plan’s entry, not as a separate mini-database.

M0 creates the file with a short how-to and an empty log. The M0 entry itself is written when
implementation finishes, not in this planning doc.

```markdown
# Provenance

Running history of implementation plans. Destination: `docs/plan.md`. Steps: `docs/plans/`.

## How to update

When a plan in `docs/plans/` is done, add an entry at the top of the log:

- Date
- Link to the plan
- What landed (files, API, tests)
- Decisions that later work should treat as given
- Anything deferred or reversed

## Log

_Nothing implemented yet._
```

---

## 7. Implementation order

Each step leaves `npm test` (once it exists) and `npm run typecheck` green.

1. Add `docs/provenance.md` (stub + empty log).
2. Fix `package.json` exports, delete `parse.ts`, add empty `src/index.ts`.
3. Types and stub: `types.ts`, `create.ts`, `evaluate.ts`, barrel. Typecheck passes.
4. Wire the test runner (root script, package script, `turbo.json`). `api.test.ts`: never throws;
   always `not-an-expression`; `createSubscript().evaluate` matches `evaluate`.
5. `fixtures.test.ts` + `accept.ts` / `reject.ts` with the seed rows. Rejects assert; accepts are
   todos; nothing throws.
6. `tsconfig.test.json`.
7. Append the M0 entry to `docs/provenance.md`.

No UI work, no README rewrite, no CI, no publish prep.

---

## 8. Done when

- `npm test` from the repo root is green.
- `api.test.ts` passes.
- Every reject fixture asserts.
- Every accept fixture is a todo; a throw would still fail.
- Duplicate fixture `name`s fail at load.
- `npm run typecheck` passes.
- `npm run build --filter @repo/subscript` emits `dist/index.js` (and `.d.ts`), not tests.
  Importing it and calling `evaluate("1+1")` returns `not-an-expression`.
- `exports.default` is not a `.ts` path.
- `docs/provenance.md` exists and has an M0 log entry.

---

## 9. Out of scope

- Dimension vectors, affine temperatures, any unit table (M1)
- Lexer, rewrite, Pratt parser, input-length caps (M2)
- `Intl` formatting (M3)
- `RateProvider` behavior, network (M4)
- Time zones, `Temporal` (M5)
- Wiring `apps/web` (M2)
- Fuzzing, differential testing, executable README (from M2)
- Comment-word tolerance, historical rates, non-English input (not v1)
- Library README, CI, publishing, renaming the package, adding a LICENSE

If it is not in §7, it is not M0.

---

## 10. What M1 needs

- Import `Quantity` / `Unit` / `Result` / `Failure` from `@repo/subscript` and fill in the hole.
- Leave the NL fixtures alone. M1 is programmatic construction only: accept cases stay todos,
  reject cases stay red-if-parsed.
- After M1 ships, append a provenance entry (including sources for any unit data).

That last point is why M0 exists: M1 can build an evaluator and the NL surface still refuses
everything until M2.
