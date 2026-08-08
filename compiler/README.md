# Crescent Compiler — Lexer/Parser/Codegen Scaffold (v0.1)

A hand-written recursive-descent lexer and parser for Crescent, implementing the grammar in
`Crescent_Grammar_v0.1.md`, plus a first codegen pass that emits plain, runnable JavaScript for a
supported subset of the language. There is no semantic/type checker yet.

## Structure

- `src/tokens.ts` — token types and keyword table
- `src/lexer.ts` — character-level lexer, plus raw-scan helpers used only by style-block parsing
- `src/ast.ts` — AST node type definitions
- `src/parser.ts` — the recursive-descent parser
- `src/codegen.ts` — AST → JavaScript codegen (see "Codegen" below for what's supported)
- `src/runtime.ts` — the small reactive runtime (`state`, `effect`, `h`, `text`, `ifBlock`) that
  generated components import at run time
- `src/index.ts` — demo entry point: parses every `.crs` file in `examples/`, prints the AST, and
  attempts codegen, writing output to `dist/gen/*.js`
- `scripts/test-counter.js`, `scripts/test-day-picker.js` — headless-DOM smoke tests (via
  `jsdom`) that mount the generated components, simulate clicks, and assert the DOM updates
  correctly
- `examples/*.crs` — sample source files exercising the language's tricky corners

## Running

```
npm install
npm start
```

This parses all files in `examples/`, prints their ASTs as JSON, and writes generated JS for any
component whose members are fully supported by codegen (see below). Files using unsupported
features print a clear "Codegen skipped: ..." message rather than emitting incorrect output.

To type-check without running:

```
npx tsc --noEmit
```

To build and run the end-to-end codegen smoke test:

```
npm test
```

## Codegen

Generated output is CommonJS (`require`/`module.exports`), matching the project's existing
`module: commonjs` TypeScript config, and imports its reactive primitives from `runtime.ts`.
Reactivity is signal-based: `state<T>` declarations become `state()` calls whose reads/writes are
tracked by `effect()`, so text interpolations and `if`/`else` template branches re-render
automatically when the state they read changes.

**Currently supported:** `state<T>`, `const`, plain functions (including `async`), arithmetic/
comparison/ternary expressions, `view` blocks containing a single root element, text literals and
`{expr}` interpolation, `if`/`else` template branches, `for` loops over arrays (one root node per
iteration), static and expression-valued attributes, and event-handler attributes
(`onclick={fn}`).

`for` loops re-render their entire list on every dependency change rather than doing fine-grained
reconciliation — correct, but not optimized for large or frequently-updated lists. The `key`
clause is parsed and passed through to the runtime but isn't yet used for reconciliation, since
there's no diffing to key against yet.

**Not yet supported by codegen** (the parser still accepts these; codegen throws a
`CodegenError` naming the feature): `derived<T>`, `provide<T>`/`inject<T>`, `on_mount`/`on_change`,
`style` blocks, component-as-element usage (`<UserCard .../>`), assignment to non-identifier
targets (e.g. struct field or array-index mutation), and view blocks with more than one root
node.

## Key implementation decisions

**`<` disambiguation (generic vs. comparison vs. tag-open).** Not resolved at the lexer level —
the lexer always emits a plain `LT` token. Disambiguation happens in the parser based on which
production is currently being parsed: `parseType()` is only ever called from known type positions
(after `state`/`derived`/`provide`/`inject`, in param lists, return types, and via a speculative
parse — see below), so a `<` encountered there is always a generic. Inside `MODE_VIEW`'s
`parseTemplateNode()`, a leading `<` is always a tag. Everywhere else (`parseRelational()`), `<` is
the comparison operator.

**Statement-start ambiguity (`Type name = expr;` vs. `name = expr;` vs. `name();`).** Resolved via
speculative parsing with backtracking: `parseStatement()` snapshots the parser position, attempts
`parseVarDeclStatement()`, and on failure restores the snapshot and falls through to
`parseAssignmentOrExprStatement()`. `Token.start` plus `Lexer.setPos()` make this a cheap,
correct rewind since the lexer is stateless beyond its cursor position.

**Style blocks.** `MODE_STYLE` is implemented by having the parser drop out of token-based parsing
entirely after consuming `style {`, and read raw characters directly via `Lexer.readRawSelector()` /
`readRawStyleValueUntilTerminator()`. When a `{` interpolation is encountered inside a style value,
the parser brace-matches the raw source to find the corresponding `}`, and parses the extracted
substring using a **fresh, independent `Parser` instance**. This sidesteps having to keep a raw
cursor and a token-lookahead cursor in sync across mode switches.

**Nullable/array modifier chaining.** `parseType()` parses a base type once, then applies `?` and
`[]` modifiers left-to-right in a loop, each wrapping the previous type. `string[]?` → nullable
array of string. `string?[]` → array of nullable string.

## What's deliberately not here yet

- No semantic/type checker (no scope resolution, no type inference/checking, no reactivity
  analysis).
- No codegen to JS.
- No `Selector`/CSS-property validation — style selectors and raw property values are captured as
  opaque strings; only the `{expr}` interpolations are actually parsed.
- Error recovery is fail-fast (throws `ParseError` with a line number) rather than collecting
  multiple diagnostics.
