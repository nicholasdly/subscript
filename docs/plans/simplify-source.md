# Simplify source

Follow-up to dropping the float64 backend-swap seam (`quantity/numeric.ts` primitive wrappers). Executed 2026-09-03. Optional shrinks in §3 were left for later; most of them landed in a second pass the same day.

Settled behavior stays in [`packages/subscript/README.md`](../../packages/subscript/README.md). Design history for numerics is in [`docs/plan.md`](../plan.md) §3.2.

---

## Already done (before this pass)

Primitive `add` / `sub` / `mul` / `div` / `sqrt` / `pow` wrappers are gone. Operand `+`/`−` still goes through `addChecked` / `subChecked`. Scale math and the rest use operators. A later numeric backend is not planned.

---

## 1. Dead work ✓

### 1.1 `runPipeline` no longer builds spans

`runPipeline` returns a `Result`. `spansForInput` is the only coloring path.

### 1.2 Quantity ops format once

Internal eval uses `compute.*` with empty `text`. Public `quantity` / `add` / `convert` / … call `withText`. The pipeline formats eval results with the instance formatter.

---

## 2. One-trick stages ✓

### 2.1 Adjacent quantities add in Pratt

`rewrite.ts` is gone. There is no foot-inch helper. A unit-bearing expression
beside `number`+`unit` is `+`, so `5 ft 11 in` and `5 m 11 cm` share one rule.
Explicit `6ft + 2in` is ordinary addition.

### 2.2 `in` vs inch is frozen, not generic

Trie `merge` only marks `in` + inch as ambiguous. Rank still expands the cross-product: two `in` tokens need mixed readings (`1 in in cm`). Do not add a second ambiguous alias without collapsing this first.

### 2.3 Winner picking is colocated

`evalWinner` and `spansWinner` sit next to each other in `pipeline/index.ts`. Eval prefers a converter reading that evaluated; spans prefers a converter reading that parsed and is not unitless-`in`.

---

## 3. Optional shrinks ✓

| Item                                    | What happened                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Drop `@nicholasdly/subscript/internals` | Removed the export, `internals.ts`, and the tsdown entry. Hosts use `spans()`.                                                          |
| Drop SI bases I, N, J                   | Dimension is T L M Θ plus information. Ampere, mole, and candela come back with those units. Newton and joule stay as force and energy. |
| `SCALE_EPS` vs `RELATIVE_EPS`           | One `RELATIVE_EPS` in `numeric.ts`.                                                                                                     |
| Duplicate `pad2`                        | Shared from `time/index.ts`.                                                                                                            |
| Fold `evaluate.ts` into `create.ts`     | Default instance lives next to the factory.                                                                                             |

Left on purpose:

| Item                       | Why it stayed                              |
| -------------------------- | ------------------------------------------ |
| Un-export quantity helpers | Breaking; they are the public quantity API |

---

## 4. Leave alone

These look heavy and are doing real work:

- Affine temperature (`absolute` vs `difference`)
- Rational exponents (`√m²` → m)
- Pratt parser plus a handful of exact time shapes
- `createTzEngine` DST inverse (the cost of Intl instead of Temporal)
- Alias tables and the unit catalog
- Checked `+`/`−` in `numeric.ts`
- `ambiguousClock`, locale volume, compact output
