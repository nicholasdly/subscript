# History

Settled package decisions and open deferrals.

When significant work lands, prepend a short note: date, what changed, new givens, anything deferred or reversed.

## 2026-08-25

Removed currency conversion. `evaluate` is synchronous again. No Frankfurter, no `fetch`
config, no dimension `C`, no ISO catalog. `$` and ISO codes are not expressions. Reverses
the M4 default-network decision: a built-in quote is a third-party dependency, and an
injected provider is configuration the default path was never supposed to need.

## Settled

- Free `evaluate(input)`; configure via `createSubscript`. Zero runtime deps; `@repo/subscript`; Node ≥ 24. `evaluate` is synchronous. No network.
- `Result.value` is `Quantity | ZonedTime`. Public `Quantity` is `{ value, unit }` (affine offsets are internal). `Result`/`Failure` are readonly.
- Strict full-input parse. Caps: 256 chars / depth 32 / 64 AST nodes. Pipeline stages are `@repo/subscript/internals`, not semver.
- Canonical unit ids are SI spellings (`metre`, `litre`, `celsius`). `oz` = mass; fluid ounce is a phrase. `en-GB` → imperial gallon/fl oz; else US. Year = 365.2425 days; month = year/12. US gallon = 231 in³; imperial = 4.54609 L. Sources: SI Brochure 9, NIST SP 811, NIST HB 44, 1959 Yard and Pound.
- Mixed-unit mul only names units in the table (else `unknown-unit`). Larger unit wins on add; dimensionless assimilates. Unary minus negates temperature literals. `^` is dimensionless-only (`10 ft^2` fails; `10 m^2` works via alias).
- `in` ranks as converter when that reading evaluates; inch is the fallback. Invented rewrite tokens span nothing. Ambiguous `in` is a `LexToken`, not a `Token` field. `numeric.ts` is the float seam.
- Format: six sig figs via `Intl`; unit is `Unit.symbol`. Compact `k/M/G/T/P` is dimensionless-only output (not input); `k` = kelvin. Cancellation snaps to `0`. Latin `.`, no grouping. No `Intl` `style: "unit"`.
- Currency is out of scope. ISO codes, `$`, and money arithmetic are `not-an-expression`. No `RateProvider`, no rate failure kinds, no `currency` span kind. Tests inject `now`.
- Time is not a Quantity. PST/PDT are fixed offsets; `pacific time` is IANA. Intl/`formatToParts`, no Temporal/tzdata. DST uses Temporal `compatible`. Clock times need a source zone. `IST` = India; bare `CST` = US Central. Closed alias list.

## Deferred

Comment-word tolerance, inverted conversion, grouping/comma decimals, compact input (`2.5k` as 2500), Temporal backend, airports, date literals, clock arithmetic, bare `now` / `time in Paris`, default `timeZone` config, `apps/web` product work, LICENSE.
