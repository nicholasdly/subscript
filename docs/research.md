# Natural Language Parsing and Evaluation of Quantities

An educational research report on the problem domain of `packages/subscript`: parsing and
evaluating natural-language expressions for unit conversion, currency conversion, time zone
conversion, and arithmetic.

This document is written to be read before design discussions, not as a specification. It
describes what the problem actually is, what has already been built, where the difficulty
genuinely lies, and which questions remain open.

---

## 0. How to read this document

Claims are marked for confidence, because a research report that launders guesses as facts is
worse than no report:

- **[verified]** — read directly from primary source (official docs, source code, spec text)
  during this research, with a URL.
- **[secondary]** — from a credible secondary source, or from a primary source that was
  paraphrased rather than read in full.
- **[unverified]** — plausible, widely repeated, or carried over from an earlier draft, but not
  confirmed. Treat as a research task, not a fact.
- **[design]** — an argument or engineering judgment, not a factual claim.

Section 16 collects everything still marked unverified into a single checklist.

---

## 1. What the problem actually is

The user types one line of text. The system returns one value, or nothing.

```
20 c to f
100 usd in eur
3pm PST in Tokyo
(2 + 3) * 4 km in miles
5 ft 11 in cm
$50 lunch + 15% tip
```

Three observations shape everything downstream.

**This is not a natural language understanding problem in the linguistic sense.** There is no
syntax to speak of, no anaphora, no discourse. The input is a short arithmetic expression whose
leaves happen to be spelled in English, plus an optional conversion target. The hard parts are
elsewhere: knowing that `lb`, `lbs`, `pound`, and `pounds` are the same thing, that `oz` is two
different things, and that `IST` is three different things.

**The failure mode is not crashing, it is confident wrongness.** A converter that returns
nothing is mildly annoying. A converter that returns a number that is quietly off by 4% because
it picked the imperial fluid ounce is actively harmful, and the user has no way to detect it.
This asymmetry justifies a great deal of defensive engineering that would be excessive in most
libraries.

**Latency budget is a keystroke.** If the intended integration is a launcher, a notepad
calculator, or a search field, evaluation runs on every character typed. That rules out network
calls in the hot path and rules out anything with a multi-hundred-millisecond warmup. It does
not rule out much else; the computation itself is trivial.

---

## 2. The central architectural finding

Every mature system in this space converges on the same shape:

1. **Normalize** the input string.
2. **Lex** it against a very large dictionary of aliases into typed tokens.
3. **Rewrite** the token stream to fuse multi-word phrases and make implicit operators explicit.
4. **Parse** with a small grammar.
5. **Evaluate** over a single unified quantity type.
6. **Format** for the user's locale.

The distribution of effort across those stages is deeply counterintuitive when you start. Stages
4 and 5 — the parser and the evaluator, the parts that feel like the real computer science — are
a few days of work each and then essentially finished. Stages 1, 2, and 6 are where the
perceived quality of the product lives, and they never finish, because they are data and
locale problems rather than algorithm problems. **[design]**

`solve-engine`, an MIT-licensed TypeScript engine in exactly this niche, documents the pipeline
explicitly as five stages: lexer, normaliser, parser, compiler, virtual machine, where "the
unusual stage is normalisation. It sits between lexing and parsing and rewrites the token
stream, fusing multi-word phrases into single tokens and making implicit operators explicit. It
is what allows natural phrasing without turning ordinary words into reserved words."
**[verified]** — <https://liamriddell.github.io/solve-engine/architecture/overview/>

SoulverCore, the closed-source Swift engine behind Soulver and the Raycast calculator, exposes
the same structure through its public API: a `TokenList` whose "tree-like structure is optimized
for evaluation," and a separate `TokenListSemantics` layer that "tags the parts of a math
expression with a semantic type (number, unit, timezone, etc)." **[verified]** —
<https://github.com/soulverteam/SoulverCore/releases>

### 2.1 The important counterexample: machine learning does appear here

An earlier draft of this research asserted that no good system in this space uses machine
learning. That is false, and the exception is the most widely deployed system of all.

Meta's **Duckling** — the entity extraction engine behind Wit.ai — uses hand-written rules to
_generate_ candidate parses and a trained classifier to _rank_ them. Specifically:

- Rules have a name, a pattern, and a production. Patterns do both "character-level matching
  (regexes on input) and concept-level matching (predicates on tokens)." **[verified]** —
  <https://github.com/facebook/duckling/>
- Parsing is bottom-up to a fixed point: a matched rule produces a token added to a collection
  called the "stash," then "other rules can try to match this token and produce other tokens
  that are added to the stash, and so on. All rules are tried again and again until no more
  token is produced." **[verified]** —
  <https://dpom.github.io/clj-duckling/DeveloperGuide.html>
- Ranking is a naive Bayes classifier, one per rule, trained with Laplace smoothing on a labeled
  corpus. Features are the concatenation of the rule names of all direct children and the
  concatenation of the grains of all direct children. Notably the top-level rule name is _not_ a
  feature, because what is being scored is the mapping from children to parent. **[verified]** —
  <https://gist.github.com/stroxler/1187695c98e94b0f3ea7dbc1efadf0a8> and the Rust port at
  <https://docs.rs/crate/duckling/latest/source/src/ranking/train.rs>
- Each rule is framed as "a boolean classifier who has to decide, given a 'route' of tokens
  filling its slots, the probability that it's a good idea for the rule to fire." **[verified]** —
  <https://dpom.github.io/clj-duckling/DeveloperGuide.html>
- The training corpus is paired with a **negative corpus** of examples that should _not_ parse.
  The reference time for the corpus is fixed at Tuesday Feb 12, 2013 at 4:30am so that relative
  dates are reproducible. **[verified]** — <https://github.com/facebook/duckling/>

Why this matters for `subscript`: Duckling's architecture is the right answer to a _different
problem_. Duckling extracts entities from arbitrary prose, where a single sentence yields dozens
of overlapping candidate parses and something has to choose. A launcher-style calculator gets a
short string that is either an expression or isn't, and it can demand that the grammar consume
the whole input. The full-consumption constraint eliminates most ambiguity for free, which is
what makes a deterministic parser viable here. **[design]**

But two things are worth stealing regardless: the ambiguity-tolerant middle (produce all
candidates, then rank) as a fallback for genuinely ambiguous inputs, and the negative corpus as
a first-class test artifact. **[design]**

---

## 3. Prior art

### 3.1 SoulverCore — the reference implementation

Soulver is the most mature product in this category, and SoulverCore is its engine, licensed
separately. It powers Raycast's calculator. Reading its documentation and release notes is the
single highest-value research activity for this project, because it is a decade-long record of
which edge cases actually come up. **[design]**

Facts:

- Closed-source `.xcframework`. Free for personal and non-commercial use; commercial use
  requires a license, with "various options available depending on your user base size, including
  a free license (with attribution)." Builds exist for macOS, iOS, Mac Catalyst, and separately
  for Windows, Linux, and Android. **[verified]** —
  <https://github.com/soulverteam/SoulverCore>
- Design goals stated as: sensible defaults, high customizability, "excellent performance (7k+
  calculations/second on Apple silicon devices)," and **no third-party dependencies**.
  **[verified]** — same source. The dependency stance is deliberate enough that they removed a
  helper class from the framework rather than take a dependency on their own text package.
  **[verified]** — <https://github.com/soulverteam/SoulverCore/releases>
- Scope: "more than 200 common units of measurement" and "more than 190 real-world currencies,
  crypto-currencies & commodities." **[verified]** —
  <https://documentation.soulver.app/llms.txt>
- Localized into German, Russian, French, Spanish, Italian, Japanese, Korean, and simplified
  Chinese, with locale-specific number and date formats. Non-English languages are **additive**:
  a German user can use both German and English syntaxes. **[verified]** —
  <https://github.com/soulverteam/SoulverCore>

The companion `StringParsing` package documents the token type inventory, which is the clearest
public statement of what "20+ data types" means in practice: numbers, dates, times, timespans,
places, timezones, currency codes, currencies, distances, temperatures, weights, areas, speeds,
volumes, laptimes, timecodes, musical pitches, URLs, email addresses, hashtags, and whitespace.
**[verified]** — <https://github.com/soulverteam/SoulverStringParsing>

### 3.2 Raycast — the deployment case study

Raycast's calculator is SoulverCore plus a rate provider. Its behavior tells you what shipping
this at scale requires.

- Official position: "The core functionalities of the Calculator Extension, such as basic math
  calculations and unit conversions, work offline. However, currency conversions require an
  internet connection to update exchange rates." Rates are "updated in the background at regular
  intervals." **[verified]** — <https://www.raycast.com/core-features/calculator>
- Raycast proxies rates through its own backend rather than hitting a vendor directly. An
  open-source reimplementation (Vicinae) targets `backend.raycast.com/api/v1/currencies`, whose
  response shape is CurrencyLayer's and whose `source` is `USD`, with a separate
  `/currencies/crypto?symbols=…` endpoint for BTC, ETH, SOL, DOGE, LTC, XRP. Rates are stored as
  `Decimal`. **[secondary]** — inferred from a third-party reimplementation, not official docs:
  <https://github.com/vicinaehq/vicinae/blob/cc878c44/src/lib/soulver/src/currency-provider.swift>

The architectural lesson is threefold and worth stating plainly: everything is normalized against
a single base currency, crypto is a separate data source with its own cadence, and the vendor is
hidden behind a first-party proxy. That last point is not incidental — it is how you avoid
shipping an API key in a client and how you retain the ability to change vendors. **[design]**

Soulver's own CLI takes the simpler path: rates "are fetched on first use and cached locally
(`~/.config/soulver/currency-rates.json`), so conversions work offline after the first run and
refresh automatically." **[verified]** — <https://github.com/soulverteam/soulver-cli>

### 3.3 The TypeScript incumbents

This niche is not empty. Three MIT-licensed TypeScript projects already occupy it, and any
positioning discussion for `subscript` should start from them. **[verified]**

**`solve-engine`** (<https://github.com/LiamRiddell/solve-engine>) is the most architecturally
serious. Five-stage pipeline; 22 feature packages registering through one public interface with
"no privileged built-in tier, which means an extension can do anything the built-ins can";
exactly one runtime dependency (`@tanstack/query-core`, for async caching); three caching layers
(bytecode by expression text, results by line, and a dependency graph so an edit recomputes only
what it must). It compiles to bytecode for a register VM, explicitly justified by the
per-keystroke-on-a-document workload rather than by expression complexity. **[verified]**

**`@supercmd/calculator`** (<https://github.com/SuperCmdLabs/SuperCalculator>) is a much smaller
"Raycast-style" library, notable for documenting two things others leave implicit: a fixed
**intent resolution order** (time → date → currency/crypto → unit → math) and a fallback chain of
free rate providers (Frankfurter → ExchangeRate API → Fawaz Ahmed for fiat; CoinGecko → Binance →
CoinCap for crypto). It also documents its ambiguity calls, e.g. "**Ambiguous `m`** → resolved as
meter (length), not minute — use `min` for minutes." **[verified]**

**`pascalorg/lingo`** (<https://github.com/pascalorg/lingo>) solves an adjacent problem — parsing
natural-language quantities for form inputs and LLM tool boundaries — and is interesting for its
inverse operation: it humanizes canonical values back into natural language, and it treats
determinism as a contract by requiring an explicit `now` so that "a queued or retried tool call
never drifts across midnight." **[verified]**

### 3.4 Open-source engines outside JavaScript

Worth reading for their data and their semantics rather than as dependencies.

- **GNU Units** is the canonical dimensional-analysis implementation and the canonical unit
  database. Its `definitions.units` is extensively commented and cites its sources: NIST Special
  Publication 811, the CRC Handbook of Chemistry and Physics 70th edition, and CODATA for
  fundamental constants. The file is roughly 420 KB of plain text. Data version 3.26 is dated
  2026-02-25; the program was at 2.26/2.27 in early 2026. **[verified]** —
  <https://fossies.org/linux/units/definitions.units>. See §11 for the licensing problem, which
  is serious.
- **libqalculate** is the fastest path to a working product if you can shell out to a binary and
  accept GPL. It does fault-tolerant parsing, automatic and explicit conversion, and
  daily-updated currency rates. **[unverified]** — carried over from the earlier draft; not
  re-confirmed in this pass.
- **Frink**, **Rink**, **Numbat** (and its predecessor **Insect**) are unit-aware calculator
  languages with real dimensional type systems. Numbat in particular is statically typed over
  physical dimensions, which is the strongest form of the idea and worth studying for how it
  models affine units. **[unverified]** — identified as relevant but not researched in this pass.
- **mathjs** is the most-used JavaScript unit implementation and therefore the most likely thing
  a user of `subscript` will compare against. **[unverified]** in detail.

### 3.5 Natural-language date parsing: `chrono-node`

`chrono-node` is the incumbent for the date/time surface in JavaScript and its architecture is
directly relevant. **[verified]** — <https://github.com/wanasit/chrono/>

- The pipeline is `parsers: Parser[]` then `refiners: Refiner[]`. "First, each parser
  independently extracts patterns from input text and creates parsing results. Then, the parsing
  results are combined, sorted, and refined with the refiners. In the refining phase, the results
  can be filtered-out, merged, or attached with additional information."
- A `Parser` is a `pattern: (context) => RegExp` plus an `extract` function. A `Refiner` is
  `refine: (context, results) => results`. Both interfaces are tiny, which is why the library is
  extensible in practice.
- The reference model is the part to copy. "Today's 'Friday' is different from last month's
  'Friday'. The meaning of the referenced dates depends on when and where they are mentioned."
  So the reference is a `ParsingReference` carrying both `instant?: Date` and
  `timezone?: string | number` — an instant _and_ a place, never just a clock.
- Components track certainty: results distinguish known from implied components, which is how
  "3pm" and "3pm on the 14th" can be represented in one type.

The refiner pattern is worth noting as a design option distinct from a single grammar: it lets
disambiguation rules be added incrementally without touching the parser, at the cost of making
the overall behavior harder to reason about globally. **[design]**

---

## 4. The pipeline in detail

### 4.1 Normalization

Cheap, and it silently determines your recall ceiling. The input needs case folding, Unicode
normalization, whitespace collapsing, and a decision about each of these:

- Unicode superscripts as exponents. SoulverCore added exactly this: `100²` → `100^2`, `m⁻¹` →
  `m^-1`. **[verified]** — <https://github.com/soulverteam/SoulverCore/releases>
- Typographic variants: `−` (U+2212) vs `-`, `×` vs `*`, `÷` vs `/`, `→` vs `to`, curly quotes
  for feet and inches (`5′11″`).
- Unicode fraction characters (`½`, `¾`), non-ASCII digit sets (Arabic-Indic, Devanagari),
  degree signs and the several distinct Unicode characters that look like one.
- Locale-dependent number syntax. This one is genuinely hard because it is ambiguous, not merely
  varied: `1.234` is one number in the US and a different one in Germany. SoulverCore's answer is
  to respect the system locale's decimal and grouping separators, and to expose locale conversion
  as an explicit operation (`EngineCustomization.standard.convertTo(locale:)`). **[verified]** —
  <https://github.com/soulverteam/SoulverCore>. Soulver additionally ships a user-facing setting
  for this, which is an admission that no automatic answer is correct. **[verified]** —
  <https://documentation.soulver.app/documentation/formatting/region-settings.md>

### 4.2 Lexing against a large alias dictionary

The core operation is: given a position in the input, find the longest dictionary entry that
matches. The dictionary holds unit names and symbols with all their plurals and abbreviations,
currency codes and symbols and colloquial names, city names, timezone abbreviations, airport
codes, function names, and operator words. Realistically tens of thousands of entries.

A trie or an Aho-Corasick automaton is the standard structure. The subtlety is match semantics,
and the `aho-corasick` crate's design document is the clearest published treatment:

- **Standard** semantics report every match, including overlaps.
- **Leftmost-first** reports the leftmost match, breaking ties by which pattern was supplied
  first — "permits users to implement match priority by simply putting the higher priority
  patterns first."
- **Leftmost-longest** reports the leftmost match, breaking ties by length — "useful for
  dictionary searching such that only the longest matching words are reported."

**[verified]** — <https://github.com/BurntSushi/aho-corasick/blob/master/DESIGN.md> and
<https://docs.rs/aho-corasick/latest/aho_corasick/enum.MatchKind.html>

The trap the same docs name explicitly: under leftmost-first, "if a pattern `A` that appears
before a pattern `B` is a prefix of `B`, then it is impossible to ever observe a match of `B`."
Register `m` before `min` and `min` becomes unreachable. Leftmost-longest is the safer default
for a unit dictionary, with an explicit priority mechanism layered on top for genuine ties.
**[design]**

Note that longest-match is not always what a user means. `1 min` should lex as minute, but
`1 m in ft` needs `m` then `in`-as-preposition, and `in` is simultaneously a preposition and the
symbol for inch. Pure longest-match on a flat dictionary cannot resolve this; it needs either
positional context in the lexer or an ambiguity-tolerant parse. This is the single most common
concrete lexing conflict in the domain. **[design]**

### 4.3 The rewrite stage

The stage most implementations don't name, and the one that does the actual natural-language
work. Two jobs:

**Phrase fusion.** Multi-word sequences become single tokens: `light year`, `fluid ounce`,
`New York`, `to the power of`, `nautical mile`, `pacific time`. Done in the lexer this requires
unbounded lookahead; done as a token-stream rewrite it is a local pattern match.

**Implicit operator insertion.** `5 ft 11 in` is an addition. `$30 × 4 days` is, per Soulver,
`$30/day × 4 days` — an implicit rate. `2.5k` is a multiplication. Making these explicit before
parsing keeps the grammar small.

### 4.4 Parsing

The arithmetic sublanguage is a solved problem: Pratt parsing (equivalently, precedence
climbing) handles infix operators with precedence and associativity, prefix and postfix
operators, and function calls, in a page of code, and extends cleanly because each token type
owns its own parse behavior and binding power. `solve-engine` uses exactly this and calls the
extension points "parselets and binding powers." **[verified]** —
<https://liamriddell.github.io/solve-engine/architecture/overview/>

On top of that sits a conversion grammar that is genuinely small:

```
query      := expr (converter target)?
converter  := "to" | "in" | "as" | "→"
target     := unit | currency | timezone | base | format
```

Plus the inverted form Soulver supports — `meters in 10 km`, `days in 3 weeks`, `seconds in a
day` — and the bare two-unit shorthand where `km m` means one kilometre in metres.
**[verified]** — <https://documentation.soulver.app/syntax-reference/units-and-conversions/units.md>

The real question is not which parsing algorithm but **whether the parser must be
ambiguity-tolerant**. A deterministic parser returns one result or fails. An ambiguity-tolerant
parser (chart, Earley, or Duckling's stash-to-fixpoint approach) returns all valid parses and
requires a ranking function. The tradeoff:

- Deterministic is far easier to reason about, debug, and test. Every ambiguity must be resolved
  by a rule you wrote deliberately, which means every resolution is inspectable.
- Ambiguity-tolerant handles genuinely ambiguous input gracefully and lets you surface
  alternatives to the user, which is the right UX for `oz` and `$` and `IST`.

A workable middle ground: parse deterministically, but let the _lexer_ return alternative
interpretations for known-ambiguous tokens, and evaluate the small cross-product, ranking
results by a simple scoring function. The number of genuinely ambiguous tokens per query is
almost always zero or one, so the cross-product stays tiny. **[design]**

### 4.5 Evaluation

One type serves all four domains. Something like:

```ts
type Quantity = {
  value: Decimal | number;
  dimension: DimensionVector; // exponents over base dimensions
  scale: Decimal; // factor to base units
  offset: Decimal; // for affine units; see §7.2
};
```

Convert operands to base units, operate, convert to the target. Dimensional mismatch is the
error case and should be a _typed_ error, not a thrown exception — see §5.3.

Currency fits this shape with one modification: its scale factor is loaded at runtime and
changes daily. Time zones do not fit it at all and need their own machinery (§9).

### 4.6 Formatting

Underrated. The output string is the entire product from the user's point of view; the number is
just an input to it. `Intl.NumberFormat` and `Intl.DateTimeFormat` do most of the work, with
caveats in §7.4 and §10.

---

## 5. The trigger problem

This is the hardest _product_ problem in the domain, and the one where the two best
implementations openly disagree.

### 5.1 Two coherent philosophies

**Soulver: unrecognized words are comments.** Soulver lets you "annotate your calculations with
commenting words for context that have no effect on the result." So `$10 for lunch + 15% tip`
evaluates to `$11.50` and `$25/hour * 14 hours of work` evaluates to `$350.00`. **[verified]** —
<https://github.com/soulverteam/SoulverCore>. It goes further: `time` is a comment word in
`3pm Sydney time to London time`, and percentage phrases accept "arbitrary comment words" as in
`20% discount off $500` and `5% gratuity on $95`. **[verified]** —
<https://github.com/soulverteam/SoulverCore/releases>

This is a superb fit for a notepad calculator, where the user is deliberately writing a
calculation and wants to label it.

**`solve-engine`: ordinary words are never keywords.** The opposite position, argued directly:

> A calculator that understands sentences has an obvious failure mode: claim `in`, `to`, `at` and
> `for` as keywords and you break every line of prose that happens to contain one, and you make
> those words unusable as variable names. So bare common words are almost never keywords here.
> Multi-word phrases get fused by the normaliser only in positions where nothing else is
> plausible.

**[verified]** — <https://github.com/LiamRiddell/solve-engine>

The mechanism is that words are "recognised only as part of a longer phrase, and only where that
phrase forms a complete expression. `average of 1, 2, 3` is recognised. A bare `average` is a
name." Function-like names such as `map`, `sum`, `prod` are operations "only when immediately
followed by an opening parenthesis." And the fallback is total: "A line the engine cannot make
sense of is left alone. It does not guess and it does not partially evaluate." **[verified]** —
<https://liamriddell.github.io/solve-engine/syntax/trigger-words/>

This is the right fit for anything that runs over text the user did not write as a calculation —
a launcher operating on arbitrary queries, an editor plugin, a note-taking app.

**These are not degrees of the same setting; they are opposite defaults, and the choice
determines the architecture.** Comment-word tolerance requires the parser to skip unknown tokens,
which means it can never use "consumed the entire input" as a correctness signal, which means it
needs some other confidence mechanism. Keyword conservatism gets full-input consumption as a
free and very strong signal. Deciding this early is more important than deciding it correctly.
**[design]**

### 5.2 Rejection is the metric that matters

The relevant academic framing is out-of-scope detection, and the empirical result is sobering.
On a purpose-built benchmark for intent classification with out-of-scope prediction, BERT reached
96%+ in-scope accuracy while "all methods struggle with identifying out-of-scope queries. Even
when a large number of out-of-scope examples are provided for training, there is a major
performance gap, with the best system scoring 66% out-of-scope recall." **[verified]** —
_An Evaluation Dataset for Intent Classification and Out-of-Scope Prediction_, EMNLP-IJCNLP 2019,
<https://doi.org/10.18653/v1/d19-1131>

The authors' justification for measuring recall rather than precision transfers exactly to this
problem: they care about out-of-scope queries predicted as in-scope, "as this would mean a system
gives the user a response that is completely wrong. Precision errors are less problematic as the
fallback response will prompt the user to try again." **[verified]** — same source.

For `subscript` this means: **the corpus of things that must not parse is as important as the
corpus of things that must.** Duckling institutionalizes this with a negative corpus per
dimension (§2.1); it should be a first-class artifact here too. **[design]**

Separately, "calculation/conversion" is recognized in the information-retrieval literature as a
distinct and newly emergent search intent category, defined as questions "aiming to use the
search engine as a calculator for arithmetic operations or unit conversion." **[verified]** —
_An Intent Taxonomy for Questions Asked in Web Search_, CHIIR 2021,
<https://marksanderson.org/files/papers/CHIIR21b.pdf>. Useful mainly as evidence that the query
class is real and studied.

### 5.3 Errors and pending states should be values

`solve-engine` makes a point that is easy to skip and expensive to retrofit: "Errors and pending
states are values too, which means they propagate through arithmetic instead of being coerced
into numbers." **[verified]** —
<https://liamriddell.github.io/solve-engine/architecture/overview/>

Its stated principle is "An error, never a guess": when a resolver has not returned yet the
result is a pending value; when a data source is not configured the result says so; "The engine
does not invent a plausible number, because a wrong answer that looks right is worse than no
answer." **[verified]** — <https://github.com/LiamRiddell/solve-engine>

This matters concretely for currency, which is inherently async. A pending rate must be
distinguishable from a zero, and a stale rate must be distinguishable from a fresh one, all the
way through arithmetic to the formatter. **[design]**

### 5.4 Untrusted input

A calculator evaluates whatever the user typed, on every keystroke, possibly inside someone
else's editor. `solve-engine` treats this as a security boundary and the reasoning is worth
adopting wholesale:

- No `eval`, no `new Function`, no code generation anywhere.
- Caps on expression length, parse depth, instruction count, stack depth, collection size, total
  allocation, function-call breadth, and recursion depth. Exceeding any of them raises a named
  recoverable error rather than an unrecoverable one.
- The allocation budget exists specifically "because per-operation limits do not compose: two
  individually legal matrices can multiply into a fatal one." That generalizes — two legal
  numbers can exponentiate into a fatal one.

**[verified]** — <https://github.com/LiamRiddell/solve-engine>

---

## 6. The semantics of mixed-unit arithmetic

Almost undocumented anywhere, and the source of most "why did it do that" moments. Soulver
publishes its rules, which makes them the de facto reference. All **[verified]** from
<https://documentation.soulver.app/syntax-reference/units-and-conversions/units.md> and
<https://documentation.soulver.app/syntax-reference/units-and-conversions/rates.md>:

**Unit assimilation.** A bare number adopts the nearest unit. `300 + 20 km` → `320 km`.
`$20 + 30` → `$50.00`.

**Larger unit wins.** Within a dimension, the result takes the larger unit. `1km + 1,000m` →
`2 km`.

**Last unit wins across incompatible scales.** `$200 + €200` → `€308.84`.

**Multiplication is restricted to units that exist.** `10m × 10m` → `100 m²`, because area is a
defined type. `3 kg × 3 liters` produces nothing, because "9 kg liters" is not a unit Soulver
knows. This is a deliberate departure from full dimensional generality, and it is the
interesting choice: GNU Units would happily produce `kg·L`. Soulver optimizes for never showing
a user a unit they don't recognize; GNU Units optimizes for mathematical closure. **[design]**

**Implicit rate construction.** When multiplication cannot produce a valid unit, a rate is
inferred: `$30 × 4 days` is read as `$30/day × 4 days` → `$120.00`.

**Rate division cancels, unless you ask it not to.** `3 hours / 3 days` = `0.0416667`, because
the units genuinely cancel. But Soulver documents that "it can be more helpful to simplify the
rate without cancelling units," so `3 hours / 3 days as hour/day` = `1 hour/day`. Two
mathematically defensible answers, distinguished only by user intent.

**Calendar units have to pick a length.** `$24 a day for a year` → `$8,765.82`, which implies a
year of 365.2425 days — the mean Gregorian year. **[secondary]**, arithmetic inference from the
documented example. The same question arises for "month," and any answer is wrong in some
context. This must be an explicit, documented, configurable constant. **[design]**

---

## 7. Units

### 7.1 Dimensional analysis

Represent a quantity's dimension as a vector of integer (or rational) exponents over the seven
SI base dimensions: second, metre, kilogram, ampere, kelvin, mole, candela. Convert to base,
operate componentwise on exponents, convert out. Equality of dimension vectors is the
compatibility check; inequality is the error.

Rational rather than integer exponents are needed if you want roots of dimensions (`sqrt(m²)`).
Cheap to support up front, annoying to add later. **[design]**

### 7.2 Affine units are a type distinction, not a number

Temperature has an offset, not just a scale. `20°C × 2` is meaningless; `20 ΔC × 2` is fine.
`20°C + 5°C` is meaningless; `20°C + 5 ΔC` is 25°C. Libraries that handle this correctly model
absolute and difference temperatures as **distinct types**, not as one type with an offset field.

GNU Units' database is explicit that it defines both: "Two types of units are defined: units for
converting temperature differences" and units for absolute temperature. **[verified]** —
<https://fossies.org/linux/units/definitions.units> line 1117.

Retrofitting this distinction is painful because it changes the type of every temperature value
in the system. **[design]**

### 7.3 Ambiguity that cannot be resolved without context

- **`oz`** — mass or fluid volume.
- **US vs imperial volumes** — a US gallon is 3.785 L, an imperial gallon 4.546 L, a difference
  of roughly 20%. A US fluid ounce is exactly 29.5735295625 mL, about 4.08% larger than the
  imperial fluid ounce. **[unverified]** — carried over from the earlier draft; the exact US
  figure is a standard definition and almost certainly right, but the 4.08% and the gallon
  figures were not re-derived in this pass.
- **`ton`** — short, long, metric.
- **`lb`** — mass; force requires `lbf`.
- **`m`** — metre or minute. `@supercmd/calculator` resolves to metre and documents it.
  **[verified]**
- **`G`/`B`** — Soulver uses `G` for billion in general numeric contexts but `B`/`b`/`bn` for
  billion with currency symbols, while `G` is also the SI giga prefix and `B` is both byte and
  bel. **[verified]** —
  <https://documentation.soulver.app/syntax-reference/large-number-symbols.md>
- **`%`** — Soulver uses it as both modulo and percent depending on context. **[verified]** —
  <https://documentation.soulver.app/syntax-reference/general/operators.md>

The good pattern: resolve by user locale, then surface the alternative as a secondary result
rather than silently choosing. Silent choice is the confident-wrongness failure mode. **[design]**

### 7.4 Formatting units

`Intl.NumberFormat` with `style: "unit"` gives locale-correct rendering, including
`unit-per-unit` compounds and a `unitDisplay` option. Two constraints: the unit must come from a
sanctioned list or the constructor throws, and the sanctioned list is queryable via
`Intl.supportedValuesOf("unit")`. **[unverified]** in detail — the shape of this API is
well-established but the exact size and contents of the sanctioned list were not confirmed in
this pass. The practical consequence is that `Intl` will cover common units and you will need
your own display-name table for everything else.

CLDR reportedly carries `unitPreferenceData` for choosing output units by locale and usage
(e.g. rendering a person's height differently from a road distance). **[unverified]** — flagged
as a promising lead worth confirming, since it would be the principled answer to "what unit
should the answer be in."

Hoisting formatter instances matters; constructing `Intl` formatters per call is measurably
expensive. **[unverified]** but consistent with general `Intl` guidance.

---

## 8. Currency

### 8.1 A currency is a unit whose scale is loaded at runtime

That is the whole insight, and it means one evaluator serves both domains. The complications are
operational, not mathematical.

### 8.2 The refresh architecture

Never fetch on keystroke. Refresh a snapshot in the background, store all rates against one base
currency, and make conversion a two-lookup triangulation. Serve stale data with a visible
timestamp when refresh fails. Treat crypto as a separate source with its own cadence.

Every shipped system does a version of this. Soulver refreshes hourly with a manual override
**[verified]** —
<https://documentation.soulver.app/syntax-reference/units-and-conversions/currencies.md>;
SoulverCore ships hard-coded rates for 190 currencies as a floor so conversions never hard-fail,
plus an `ECBCurrencyRateProvider` fetching 33 currencies with no API key **[verified]** —
<https://github.com/soulverteam/SoulverCore>; Raycast proxies through its own backend with USD as
base **[secondary]**; Soulver CLI caches to disk after first use **[verified]**;
`@supercmd/calculator` chains three free providers with automatic fallback **[verified]**.

The hard-coded-rates-as-floor idea is quietly clever: it makes the offline behavior "slightly
wrong with a warning" rather than "broken," which for a launcher is the better failure. Note
SoulverCore also exposes `useDefaultRatesForUnhandledCurrencies` as an explicit opt-in flag,
which is the right way to make that tradeoff visible. **[verified]** —
<https://github.com/soulverteam/SoulverCore/releases>

Triangulation through a base currency introduces its own error, and reference rates are not
tradeable rates. A converter should not imply that the user can transact at the number shown.
**[design]**

### 8.3 Symbol ambiguity

`$` maps to USD, CAD, AUD, MXN, NZD, SGD, HKD, TWD, BRL and more. Soulver's answer: resolve `$`
from the OS region setting, and support disambiguating prefixes — `US$`, `NZ$`, `C$`/`CA$`,
`A$`/`AU$`, `S$`, `NT$`, `HK$`, `R$` — with every currency's symbol user-configurable.
**[verified]** —
<https://documentation.soulver.app/syntax-reference/units-and-conversions/currencies.md>

A related hazard worth designing for: three-letter ISO codes collide with English words and unit
names. `IN`, `AS`, `TO`, `AT`, `IS`, `ALL` (Albanian lek), `TRY` (Turkish lira), `NO`, `AM`,
`PM`. Treating currency codes as unconditionally matchable will produce false positives on
ordinary text. **[design]** — the specific severity of this was not researched; flagged.

Soulver's precedent for the analogous timezone problem is instructive: it added
`requireUppercaseForAmbiguousTimezones` so that ambiguous airport codes like `BUS` match only in
uppercase, because "lowercase forms like `bus` and `Bus` are ignored to avoid false matches in
prose-style expressions." **[verified]** —
<https://github.com/soulverteam/SoulverCore/releases>. Case sensitivity as a disambiguation
signal is a cheap, effective trick.

### 8.4 Features beyond spot conversion

Soulver supports historical rates ("10 USD in EUR on March 20", "1 BTC in USD one year ago"),
back to 1999 for fiat and 2013 for Bitcoin, and user-specified custom rates
("50 EUR in USD at 1.05 USD/EUR"). **[verified]** — same source. Historical rates change the data
architecture substantially (a time series, not a snapshot) and should be an explicit in-or-out
decision rather than a later surprise. **[design]**

### 8.5 Minor units

ISO 4217 assigns a minor-unit exponent per currency, and `Intl.NumberFormat` defaults its
fraction digits from it, which handles JPY having no minor unit and the three-decimal Gulf
currencies (BHD, IQD, JOD, KWD, LYD, OMR, TND) correctly for free. **[unverified]** in the
specifics — the mechanism is well-established, the exact currency list was not re-confirmed here.

Whether a _display-oriented_ converter needs decimal arithmetic at all is a genuine open
question, not a settled one. Float64 has 15–17 significant decimal digits; a displayed
conversion rounded to 2–6 significant figures is nowhere near that boundary. The argument for
decimals is not accuracy but _predictability_ — `0.1 + 0.2` visibly misbehaving in a calculator
erodes trust even when the displayed result is correct. Note that Soulver uses `Decimal` and
consequently has to work around Foundation overflow bugs on large divisions **[verified]** —
<https://github.com/soulverteam/SoulverCore/releases> — while `solve-engine` explicitly chose
doubles by default with a big-integer type available where exactness matters **[verified]** —
<https://github.com/LiamRiddell/solve-engine>. Two mature projects, opposite conclusions.

---

## 9. Time zones and dates

### 9.1 The arithmetic is now solved

Temporal reached **Stage 4** at TC39's March 2026 meeting, securing its place in the **ECMAScript
2026** specification. **[verified]** — <https://socket.dev/blog/tc39-advances-temporal-to-stage-4>

Runtime support as of August 2026:

| Runtime           | Status                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Firefox           | Shipped, 139 (May 2025) **[secondary]**                                                                                                       |
| Chrome            | Shipped, 144 (January 2026) **[secondary]**                                                                                                   |
| Edge              | Shipped / experimental in 144 **[secondary]**                                                                                                 |
| Safari            | **Technology Preview only.** STP 249, released 2026-07-29, "Added support for the `Temporal` object." Not in a stable release. **[verified]** |
| Node / Deno / Bun | **[unverified]** — Node support was "expected in a future release" as of March 2026                                                           |

Sources: <https://webkit.org/blog/18182/release-notes-for-safari-technology-preview-249/>,
<https://bryntum.com/blog/javascript-temporal-is-it-finally-here/>

The practical read: `Temporal` is safe on a controlled runtime and still needs a polyfill for
broad browser support because Safari stable has not shipped. Polyfill bundle cost is the deciding
factor and current sizes for `temporal-polyfill` versus `@js-temporal/polyfill` were **not**
measured in this pass — the "50KB polyfill tax" figure in the earlier draft is
**[unverified]** and should be re-measured rather than repeated.

The types that matter are `Instant`, `ZonedDateTime`, `PlainDateTime`, `PlainTime`, and
`Duration`. `ZonedDateTime` is the one that makes DST-correct arithmetic automatic, and its
`disambiguation` option is the designated mechanism for nonexistent and doubled wall-clock times.
**[unverified]** in exact option semantics.

Zero-dependency fallback worth knowing: `Intl.DateTimeFormat` with a `timeZone` option and
`formatToParts()` can perform time zone conversion using only built-ins, since the browser
already ships tzdata for `Intl`. Adequate for formatting, awkward for arithmetic. Related useful
built-ins: `Intl.supportedValuesOf("timeZone")` and
`Intl.DateTimeFormat().resolvedOptions().timeZone` for the user's own zone. **[unverified]** in
detail.

### 9.2 The lookup is the actual work

Resolving `sf` → `America/Los_Angeles` is not solved by any library, because it is a product
decision dressed as a data problem.

Soulver's documented policy is a good model. It accepts city names "with large populations,"
standard timezone abbreviations, GMT offsets, airport codes (`7:30am LAX to Japan`), and country
names — and for countries spanning multiple zones, **"the time zone of the country's capital city
is used."** **[verified]** —
<https://documentation.soulver.app/syntax-reference/time/time-zones-and-cities.md>

That capital-city rule is exactly the kind of arbitrary-but-documented decision this domain
demands. It is wrong for a user in Los Angeles typing `time in usa`, and it is still better than
failing or offering four options.

Candidate data sources, all **[unverified]** in this pass and requiring license review:
`vvo/tzdb` (simplified IANA zones with friendly alternative names and major cities per zone),
CLDR (localized zone display names, exemplar cities, `metaZones.xml`, `windowsZones.xml`),
GeoNames (the long tail of city names), and an IATA airport code source.

Whatever the datasets, the top few hundred hand-curated aliases — `nyc`, `ldn`, `blr`, `sf`,
`the office` — are the product, and no dataset ships them. **[design]**

### 9.3 Abbreviations are the worst part of this

`IST` is India, Ireland, and Israel. `CST` is US Central, China, and Cuba. `AST`, `BST`, `EST`
are all overloaded. Abbreviations are not a lookup table in tzdb precisely because they are not
unique.

Soulver's approach is to publish an explicit, closed list rather than pretend to general
coverage: EST, EDT, CST, CDT, MST, MDT, PST, PDT, AKST, AKDT, HST, plus named forms like
"eastern time" and "pacific time," all case-insensitive. **[verified]** —
<https://documentation.soulver.app/syntax-reference/time/time-zones-and-cities.md>

Note what that list quietly concedes: `CST` resolves to US Central, and Chinese and Cuban
Standard Time are simply not reachable by abbreviation. An explicit, documented, locale-biased
subset beats a complete but ambiguous mapping. **[design]**

The related colloquial problem: users type `PST` in July meaning "Pacific time," when PST is by
definition the winter offset. Honoring the literal offset is defensible and surprising; mapping
to the zone is helpful and technically wrong. Soulver's list distinguishes PST from PDT _and_
offers "pacific time" as a third, zone-valued option, which is the cleanest resolution — let the
user express which one they meant. **[design]**

### 9.4 Ambiguity in clock times

SoulverCore exposes `clockTimeInterpretationBehavior` with two modes: `.literal24Hour` (default),
where `3:00` means 03:00, and `.preferDaytimeForAmbiguous12HourTimes`, where `3:00` means 3pm but
`11:00` still means 11am. The knock-on effect is documented: `11:00 to 3:00` is either 16 hours
or 4 hours depending on the mode. **[verified]** —
<https://github.com/soulverteam/SoulverCore/releases>

This is a good example of an ambiguity with no correct answer, where the only defensible design
is to name it, pick a default, and expose the switch. **[design]**

### 9.5 DST and calendar edge cases

On spring-forward dates some wall-clock times do not exist; on fall-back dates some occur twice.
Both are user-visible and both must be handled explicitly rather than by whatever the underlying
library happens to do. **[verified]** as a general fact; the specific 2026 transition dates in
the earlier draft were **not** re-confirmed and should be treated as **[unverified]**.

Other cases to have a position on, all **[unverified]** in specifics:

- Non-hour offsets: India +5:30, Nepal +5:45, Chatham +12:45.
- Countries that recently changed or abolished DST (Mexico, Brazil, Iran, Chile), Morocco's
  Ramadan shifts, Lord Howe's 30-minute DST.
- Date-line changes (Samoa, Kiribati).
- "Add one month to January 31" — every library answers differently.
- ISO-8601 versus US week numbering.
- tzdata staleness. IANA publishes multiple releases a year and stale rules produce silently
  wrong answers, which is the worst failure class in this whole document. Whether `subscript`
  relies on the runtime's tzdata (via `Intl`/`Temporal`) or ships its own is a significant
  architectural decision with a maintenance tail.

---

## 10. Numerics

Two mature projects reached opposite conclusions (§8.5), which is a signal that this is a real
tradeoff rather than a solved question.

What is not ambiguous is that a calculator must be _legible_ about precision. Two documented
behaviors worth stealing, both **[verified]** from
<https://github.com/soulverteam/SoulverCore/releases>:

- `sqrt(2) - 2^0.5` returns exactly `0` rather than a small residue, because a visible
  floating-point artifact in a calculator reads as a bug regardless of whether it is one.
- `1e100 + 1 - 1e100` returns an **error** stating the calculation cannot be performed while
  retaining accuracy — rather than silently returning `0`. Refusing to answer is treated as more
  correct than answering wrongly, which is the same principle as §5.3 applied to arithmetic.

Formatting decisions that matter: significant figures versus fixed decimal places for converted
values; `maximumSignificantDigits` and `roundingMode` on `Intl.NumberFormat`; compact,
scientific, and engineering notation. Soulver defaults to SI-inspired compact display (`300k`,
`3.3M`) on the grounds that "you don't need to count zeros to immediately know the magnitude,"
and makes it disableable globally and per line. **[verified]** —
<https://documentation.soulver.app/syntax-reference/large-number-symbols.md>

---

## 11. Data sources and licensing

**This section contains the most consequential finding in the report.**

`definitions.units`, the GNU Units database, is **GPL-3.0-or-later, copyright Free Software
Foundation**. The license header is in the data file itself, not merely in the program.
**[verified]** — <https://fossies.org/linux/units/definitions.units> lines 13–29. GNU Units moved
to GPL-3.0-or-later in 2007 (from GPL-2.0-or-later in 1997). **[secondary]** —
<https://en.wikipedia.org/wiki/Units_(Unix)>

The earlier draft described this as "Best data, GPL," which understates the situation. If
`subscript` is to be permissively licensed, **the GNU Units data cannot be used at all** — not
vendored, not converted, not reformatted. Derived-work rules apply to data files bundled with a
program. The precedent runs the other way: `mcp-gnu-units` vendors the file verbatim and is
consequently itself GPL-3.0-or-later, and its author says so explicitly: "It is offered in the
same spirit and under the same license (GPL-3.0-or-later)… so the two are wholly compatible."
**[verified]** — <https://github.com/laszlopere/mcp-gnu-units>

Two leads worth pursuing:

- Units "was originally available under a permissive license… the FreeBSD project maintains a
  free fork of units from before the license change." **[secondary]** —
  <https://en.wikipedia.org/wiki/Units_(Unix)>. A 1997-era database is missing three decades of
  corrections, so this is a starting point rather than a solution.
- **UDUNITS** (UCAR) is a similar utility with a library interface, commonly used for netCDF.
  **[secondary]** — same source. Its license needs checking but UCAR software is typically
  permissive.

Either way, the underlying _facts_ — that a mile is 1609.344 metres — are not copyrightable. What
is protected is the particular compilation, its selection, and its arrangement. A
cleanly-sourced table built from NIST SP 811 and CODATA (the same primary sources GNU Units
cites) is a legitimate path; it is simply real work. **[design]** — and this is a question for a
lawyer, not for a research report.

Other datasets, all requiring license review that was **not** completed in this pass: CLDR
(unit display names, plural forms, currency symbols, timezone names — Unicode license, generally
permissive), UCUM and its `ucum-essence.xml`, QUDT, IANA tzdb (public domain), ISO 4217 code
lists, GeoNames (believed CC-BY), and IATA/airport datasets.

---

## 12. Testing

The consensus across every serious project in this space is that a golden corpus of
`input → expected output` pairs, run on every commit, is not optional. The reasoning is that a
small change has non-local effects, and the failure mode is a confidently wrong number that no
type system will catch.

Four practices worth adopting, each drawn from a project that actually does it:

**A negative corpus.** Duckling maintains, per dimension, both a corpus of examples that should
parse and a negative corpus of examples that should not, with a fixed reference time so relative
dates are reproducible. **[verified]** — <https://github.com/facebook/duckling/>. Per §5.2, the
negative corpus is the one that measures the metric that actually matters.

**Executable documentation.** `solve-engine`: "Every example in this file, and every example in
the documentation, is executed by the test suite. If one of them stops being true, the build goes
red." **[verified]** — <https://github.com/LiamRiddell/solve-engine>. Documentation for a system
this data-driven rots invisibly otherwise.

**Fuzzing with a committed corpus.** A seeded fuzzer with automatic shrinking, run against both
the grammar and the evaluator, asserting three invariants: the process never dies, nothing hangs,
and every failure is a well-formed error rather than a raw exception. Findings are shrunk to a
minimal reproducer and committed so "a fixed bug cannot come back quietly." **[verified]** — same
source.

**Differential testing against the previous release.** Compare every expression available against
the last published version and classify every difference, "so a behaviour change has to be
deliberate rather than discovered afterwards." **[verified]** — same source. For a library whose
entire output surface is numbers and strings, this is unusually high-value: it turns the whole
corpus into a change-detection mechanism without anyone having to predict which cases will break.

---

## 13. API and packaging considerations

Recurring themes from the projects surveyed, offered as questions rather than answers:

**One function or a pipeline?** `@supercmd/calculator` exposes a single `calculate(input, options)
=> Promise<Result>` with a discriminated union result. `solve-engine` exposes the engine and every
pipeline stage. The first is friendlier; the second is what a host needs for syntax highlighting
and incremental evaluation. SoulverCore ships both, and notably added `TokenListSemantics`
specifically because consumers were reaching for the evaluation-oriented `TokenList` to do syntax
coloring — an internal structure whose "concrete token types change between releases without
notice." **[verified]** — <https://github.com/soulverteam/SoulverCore/releases>. The lesson is to
design the highlighting surface deliberately and separately, because someone will need it.

**Sync or async?** Everything is synchronous except currency. `@supercmd/calculator` makes the
whole API async to accommodate it. `solve-engine` keeps it sync and makes pending a value type.
The latter composes better and keeps the common path fast. **[design]**

**How do large data tables ship?** Tens of thousands of aliases across units, currencies, cities,
and timezones is real bundle weight. `solve-engine`'s answer is that `createEngine()` is
batteries-included while the `ExpressionEngine` constructor "registers only the packages you pass
it, so your bundler can drop the built-ins you never use." **[verified]** —
<https://github.com/LiamRiddell/solve-engine>. Making the domain modules independently
importable, with locale data as separate entry points, is the tree-shakeable shape.

**Does the library make network requests by default?** `solve-engine` is candid that two of its
default packages do, unprompted: "`100 USD in GBP` fetches an exchange rate, and `weather in
london` calls a geocoder, with no host configuration at all," and documents how to build a
package list without them. **[verified]** — same source. For a library, defaulting to no network
and requiring an injected rate provider is the more defensible choice, and it makes the offline
story trivially true rather than carefully qualified. **[design]**

**Dependency budget.** SoulverCore states zero third-party dependencies as a design goal and has
removed functionality to preserve it; `solve-engine` has exactly one. Both are unusual and both
are deliberate. **[verified]**

---

## 14. Build versus buy

- **SoulverCore** is the best engine available and is free for personal and non-commercial use,
  with commercial licensing negotiable including a free attribution tier. It is Swift and closed
  source, which for a TypeScript library in a Turborepo means it is not a candidate.
- **libqalculate** gets you most of the way under GPL, if shelling out to a binary is acceptable
  and GPL is acceptable. Not viable for an npm library.
- **`solve-engine`** is MIT, TypeScript, architecturally sound, and already does most of this. It
  is the most serious "why not just use this" question facing the project and deserves an
  explicit answer.
- **Building from scratch** is very doable. The math is not hard. The reasons to do it are
  control over the alias table, control over trigger behavior, and control over the ambiguity
  policy — the three things that are the product. It should not be done because the parsing looks
  interesting, because the parser is the part that finishes. **[design]**

---

## 15. A plausible ordering

Presented as reasoning, not as a plan.

1. **`Quantity` and the dimension vector, units only.** No natural language yet. Get affine units
   right now (§7.2), because retrofitting the absolute/delta type distinction touches everything.
2. **The alias-matching lexer and the Pratt parser.** Leftmost-longest with explicit priority
   overrides. This is where the `m`/`min`/`in` conflicts surface and where the trigger philosophy
   from §5.1 has to be decided, because it changes whether full-input consumption is available as
   a signal.
3. **The golden corpus and the negative corpus, from the first commit.** Cheap now, and the only
   thing that makes steps 4–6 safe.
4. **Formatting.** Earlier than feels natural, because it is a large share of perceived quality
   and because it constrains the numeric representation.
5. **Currency**, as a unit type with a hot-swappable rate table and an injected provider. Pending
   and stale as first-class value states.
6. **Time zones last.** The most special-case machinery, the most data, the least reuse of the
   core, and the most maintenance tail (tzdata).

---

## 16. Open questions

Everything marked **[unverified]** above, collected. These are research tasks, not facts.

**Licensing — highest priority, blocks data decisions**

- [ ] Can a permissive library use _any_ GNU Units-derived data? Confirm with someone qualified.
- [ ] Does the pre-1997 FreeBSD `units` fork have a usable license and usable data?
- [ ] UDUNITS license and data quality.
- [ ] CLDR, UCUM, QUDT, GeoNames, ISO 4217, and IATA dataset licenses.
- [ ] Is there any permissively-licensed, actively-maintained unit database at all?

**Units**

- [ ] Exact contents and size of the `Intl.NumberFormat` sanctioned unit list; behavior of
      `Intl.supportedValuesOf("unit")`; compound `unit-per-unit` limits.
- [ ] Does CLDR `unitPreferenceData` exist and does it solve output-unit selection by
      locale/usage?
- [ ] Re-derive the US/imperial volume divergence figures rather than repeating them.
- [ ] How do Numbat, Pint, and Boost.Units model affine units? Numbat's static dimension typing
      is the most interesting unexamined lead in this report.
- [ ] Nonlinear/logarithmic units (dB, pH) — in scope or out?
- [ ] JS library landscape in detail: mathjs, unitmath, js-quantities, quantity-math-js, convert.
      Bundle sizes, TS quality, affine handling, maintenance. The `quantity-math-js` performance
      claims in the earlier draft were vendor self-reported and were not verified.

**Currency**

- [ ] Frankfurter's actual coverage, update time, and terms; whether caching is permitted.
- [ ] Terms of the free no-key providers `@supercmd/calculator` chains, especially whether
      redistribution or caching is allowed.
- [ ] Confirm the ISO 4217 minor-unit exponent list and where to get it authoritatively.
- [ ] TC39 Decimal proposal status as of 2026.
- [ ] Severity of ISO-code-versus-English-word collisions in practice.
- [ ] Historical rates: in scope? If so, the data architecture changes materially.
- [ ] The "0.05% deviation between APIs and ECB reference rates" figure in the earlier draft was
      vendor-published; either source it properly or drop it.

**Time**

- [ ] Node, Deno, and Bun `Temporal` support as of August 2026.
- [ ] Measure current `temporal-polyfill` and `@js-temporal/polyfill` bundle sizes. The "50KB
      polyfill tax" claim is stale and should not be repeated until re-measured.
- [ ] Exact semantics of `ZonedDateTime` `disambiguation` and `offset` options.
- [ ] `vvo/tzdb`: what it actually contains, how it is generated, size, license.
- [ ] IANA tzdb release cadence in 2024–2026, and whether to rely on runtime tzdata or ship our
      own.
- [ ] Confirm concrete 2026 DST transition dates before using any as test fixtures.
- [ ] Recent DST abolitions and the non-hour-offset zone list.

**Prior art not yet examined**

- [ ] Numbat / Insect, Frink, Rink, Kalker, cpc — architecture and unit data licensing.
- [ ] libqalculate's parsing modes and "fault-tolerant" input handling.
- [ ] Microsoft Recognizers-Text: architecture, maintenance status, license.
- [ ] mathjs's `Unit` class and parser in detail.
- [ ] Confirm Duckling's license (believed BSD-3-Clause).
- [ ] A close read of `solve-engine`'s source, since it is both the closest prior art and the
      strongest argument against building this at all.
