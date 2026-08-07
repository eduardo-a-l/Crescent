# Crescent Compiler — Lexer/Parser Scaffold (v0.1)

A hand-written recursive-descent lexer and parser for Crescent, implementing the grammar in
`Crescent_Grammar_v0.1.md`. This produces an AST from `.crs` source; it does not yet emit
JavaScript (no codegen pass exists yet).

## Structure

- `src/tokens.ts` — token types and keyword table
- `src/lexer.ts` — character-level lexer, plus raw-scan helpers used only by style-block parsing
- `src/ast.ts` — AST node type definitions
- `src/parser.ts` — the recursive-descent parser
- `src/index.ts` — demo entry point: parses every `.crs` file in `examples/` and prints the AST
- `examples/*.crs` — sample source files exercising the language's tricky corners

## Running

```
npm install
npm start
```

This parses all files in `examples/` and prints their ASTs as JSON, or reports a parse error with
line number.

To type-check without running:

```
npx tsc --noEmit
```

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
