# @nicholasdly/subscript

## 1.4.0

### Minor Changes

- Quantity helpers now return `QuantityResult` (always a quantity on success). Unitless conversions such as `20 to f` fail as `not-an-expression` instead of `dimension-mismatch`.

## 1.3.0

### Minor Changes

- 1990008: Dropped the unstable `@nicholasdly/subscript/internals` export. Use `evaluate`, `createSubscript`, and `spans`.

### Patch Changes

- bcd17de: Removed redundant mathematical operator functions

## 1.2.0

### Minor Changes

- 5f2149f: Added kitchen units, and an exponent cap to prevent overflows.
- ad4de01: Add astronomical and colloquial length, SI derived units, and information units (newton, watt, joule, pascal, byte).

## 1.1.0

### Minor Changes

- c3d60af: Reorganized and refactored project structure

### Patch Changes

- c3d60af: Fix published exports, types, and package metadata
- c3d60af: Updated documentation

## 1.0.0

### Major Changes

- 9f8acaa: Natural language query parsing and evaluation for unit conversion, time zone conversion, and basic math.
