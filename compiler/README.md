# Crescent Compiler — Lexer/Parser/Codegen Scaffold (v0.1)

A hand-written recursive-descent lexer and parser for Crescent, implementing the grammar in
`../docs/Crescent_Grammar.md`, plus a codegen pass that emits plain, runnable JavaScript for a
supported subset of the language. There is no semantic/type checker yet.

## Structure

- `src/tokens.ts` — token types and keyword table
- `src/lexer.ts` — character-level lexer, plus raw-scan helpers used only by style-block parsing
- `src/ast.ts` — AST node type definitions
- `src/parser.ts` — the recursive-descent parser
- `src/modules.ts` — multi-file module graph: discovers `.crs` files, resolves `use` paths, checks
  for import cycles, and computes the relative `require()` paths codegen needs (see "Modules"
  below)
- `src/checker.ts` — the semantic checker: scope resolution, struct/prop/type checks, reactivity
  rules, and non-flow-sensitive null-safety warnings (see "Semantic Checker" below)
- `src/codegen.ts` — AST → JavaScript codegen (see "Codegen" below for what's supported)
- `src/runtime.ts` — the small reactive runtime (`state`, `derived`, `effect`, `watch`, `h`, `text`,
  `ifBlock`, `forEach`, `slot`, `injectStyle`) that generated components import at run time
- `src/index.ts` — demo entry point: recursively discovers every `.crs` file under `examples/`
  (including nested directories), resolves imports and checks for cycles across the whole project,
  runs the semantic checker per file (skipping codegen for that file if it reports any errors),
  then attempts codegen, mirroring the source tree under `dist/gen/`
- `scripts/build-web.js` — bundles generated components (via `esbuild`) into a single
  self-contained `web/index.html` you can open directly in a browser
- `scripts/test-counter.js`, `scripts/test-day-picker.js` — headless-DOM smoke tests (via
  `jsdom`) that mount the generated components, simulate clicks, and assert the DOM updates
  correctly
- `scripts/test-web.js` — loads the real `web/index.html` into `jsdom` with script execution
  enabled and simulates clicks through actual DOM events, as a closer proxy for real-browser
  behavior than requiring the generated modules directly
- `examples/*.crs` — sample source files exercising the language's tricky corners, including a
  nested `examples/modules/` tree exercising cross-file `use` imports

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

To see it running in a real browser, bundle the generated components into a single HTML file and
open it:

```
npm run build:web
```

Then open `web/index.html` directly in a browser (no server required — the bundle is fully
self-contained). `npm test` also runs this bundling step and a `jsdom`-based check that it works.

## Codegen

Generated output is CommonJS (`require`/`module.exports`), matching the project's existing
`module: commonjs` TypeScript config, and imports its reactive primitives from `runtime.ts`.
Reactivity is signal-based: `state<T>` declarations become `state()` calls whose reads/writes are
tracked by `effect()`, so text interpolations and `if`/`else` template branches re-render
automatically when the state they read changes.

**Currently supported:** `state<T>`, `derived<T>` (lazy pull-based memoization, per §14.5), `const`,
plain functions (including `async`), arithmetic/comparison/ternary expressions, `view` blocks
containing a single root element, text literals and `{expr}` interpolation, `if`/`else` template
branches, `for` loops over arrays (one root node per iteration), static and expression-valued
attributes, event-handler attributes (`onclick={fn}`), `style` blocks (scoped CSS, see below),
component-as-element usage (`<UserCard user={user}/>`), `<slot/>` content passthrough,
`on_mount`, `on_change(...)`, and assignment to non-identifier targets (array-index and, where
legal, struct-field writes — see below).

`for` loops with an explicit `key` (§14.4) get real keyed reconciliation: `forEach` in
`runtime.ts` keeps a persistent `key -> { item, node }` map across re-renders and, on each update,
reuses the existing DOM node for any key whose item reference is unchanged (`===`), only calling
`renderItem` again for genuinely new or replaced items, then reorders the surviving/created nodes
into place with `insertBefore` rather than tearing the list down. This means reordering,
growing, or shrinking a keyed list preserves the DOM node identity of every unaffected item — no
node is destroyed and recreated just because its position or a sibling changed. **The comparison
is by reference, not deep equality**: the idiom this is built around is replacing an array element
wholesale (`items[i] = Struct { ...updatedFields };`, as already used in `reactive_list.crs`) —
mutating a *field* of an existing element in place (`items[i].done = true;`, which the assignment
rules in the previous section also permit) keeps the same reference, so reconciliation will treat
it as unchanged and reuse the old node's stale content. Prefer whole-element replacement over
in-place field mutation for items that need to visibly update.

A `for` loop **without** a `key` still gets the original, simpler behavior — the whole list is
wiped (`container.innerHTML = ''`) and rebuilt from scratch on every change — and the compiler now
also emits a build-time warning (to the compiler's own console, not the generated code) pointing
at design doc §14.4 and suggesting a key. `examples/day_picker.crs`'s unkeyed loop over a static
`days` array is deliberately left as-is to keep that warning path exercised in `npm test`.

`style` blocks compile to scoped CSS per §14.3 of the design doc: every native element rendered
by a component that has a `style` block gets a `data-crs-<component>` attribute, and the block's
rules are rewritten with that attribute appended to their selector (`.box` → `.box[data-crs-...]`)
and injected once per component *type* into `<head>` via `injectStyle`. Declarations containing
`{expr}` — including values that mix raw CSS text and interpolation, e.g. `2px solid {accent}` —
compile to a CSS custom property (`--crs-N`) set on the component's root element inside a
per-instance `effect()`, so purely-static declarations stay in the static stylesheet and only the
reactive ones pay for a per-instance binding.

Component-as-element usage (`<UserCard user={user}/>`) compiles to a direct function call —
`UserCard({ user: user })`. Every generated component function always destructures a `children`
prop (defaulting to `[]`), so any nested markup passed between a component's tags —
`<Card><h1>...</h1></Card>` — is compiled in the *caller's* scope (so it still sees the caller's
`state`/style scope) into an array of already-built nodes, and a `<slot/>` inside the callee's own
view compiles to `slot(children)`, a runtime helper that appends that array into a
`display: contents` wrapper.

Assignment to non-identifier targets follows §13.1/§13.2 of the design doc. An index write whose
root is a `state<T>` — `items[0] = ...`, including through further chained member/index access
like `items[0].done = true` — compiles to a direct in-place mutation via `.get()` followed by
`.set(.get())` to force a reactive notification, since `Signal.set` always notifies subscribers
regardless of reference equality. A **direct property write on the state itself**
(`user.name = "Sam"` where `user` is `state<User>`) is a compile-time `CodegenError`, per the
"forbidden nested object mutation" rule — the whole state must be reassigned instead.

`derived<T>` follows §14.5's lazy pull-based memoization: the runtime `derived()` helper only
recomputes on the next read after a dependency changes (not eagerly on every change), and
assigning to a derived name directly (`total = 5;`) is a compile-time `CodegenError` — dependencies
must be reassigned instead. `on_mount` bodies run once, after the component's view (and any style
effects) have already been constructed, so state writes inside `on_mount` land on live, already-
wired subscribers rather than an empty subscriber set. `on_change(a, b)` compiles to a `watch()`
call that subscribes to the named dependencies but — unlike a plain `effect()` — deliberately skips
firing on its own first (construction-time) run, so it only fires on genuine subsequent changes.

**Not yet supported by codegen** (the parser still accepts these; codegen throws a
`CodegenError` naming the feature): `provide<T>`/`inject<T>`, and view blocks with more than one
root node.

## Modules

Rust-style `use` declarations (see `docs/Crescent_Grammar.md` §11) let one `.crs` file reference
`component`/`struct` declarations from another. There's no `pub`/`export` keyword — every
top-level declaration is implicitly importable.

```
use card::UserCard;                                     // ./card.crs, item UserCard
use components::forms::{Button, Input as TextInput};    // ./components/forms.crs, two items, one aliased
use super::shapes::Point;                                // ../shapes.crs relative to *this file's own directory*
```

`src/index.ts` discovers every `.crs` file under `examples/` first (recursively), resolves every
`use` path to a concrete file, and builds a file-level dependency graph. Import cycles are rejected
before any codegen runs, with an error naming the full chain (`Circular import: a.crs -> b.crs ->
a.crs`) — one cycle anywhere aborts the whole build, not just the files involved. A `use` that
names a file or item that doesn't exist is also a compile error, reported per file.

Codegen impact differs by what's imported: importing a `struct` produces **no runtime code at
all**, since struct type names are already fully erased at codegen (a `User { ... }` struct
literal compiles to a plain JS object literal that never references `User`) — a struct import is
purely a compile-time name-resolution check. Importing a `component`, on the other hand, compiles
to a `require()` call — `const { UserCard } = require('./card');` — with a relative path computed
from the *generated* file's location (mirroring the source tree under `dist/gen/`), so
`dist/gen/modules/components/card.js` correctly requires `../../../runtime` while a flat file at
`dist/gen/counter.js` requires `../runtime`, and both resolve to the same `dist/runtime.js`.

There's no re-export chaining in v0.1: an import must resolve to an actual declaration in the
target file, not to something that file only imported itself.

## Semantic Checker

`src/checker.ts` runs as its own pass between parsing and codegen (`checkFile()`, wired into
`src/index.ts`) and collects **multiple** diagnostics per file — rather than throwing on the first
problem like `ParseError`/`CodegenError` — so a file can be checked once and report everything
wrong with it. A diagnostic is `{ severity: 'error' | 'warning', message, where, line }`; `where`
is a human-readable path like `component 'Cart', function 'add_one'`, and `line` is the line of
the enclosing statement or declaration (see the source-location note below). Errors block codegen
for that file (`index.ts` prints all diagnostics, then skips codegen if any are errors);
warnings are printed but don't block.

What it checks:
- **Scope resolution** — every `Identifier` used anywhere (expressions, assignment targets,
  `on_change(...)` watch lists) must resolve to a param, `state`/`derived`/`const`/`provide`/
  `inject`, a local `for`-loop or `VarDecl` binding, a sibling function, a component/struct name
  (local or imported), or one of a small allowlist of browser/JS globals (`fetch`, `console`,
  `Math`, `Date`, `JSON`, `Promise`, timers, `window`, `document`, storage) — the design doc's own
  `async`/`await` example (§13.4) uses `fetch(...)`, so that had to be recognized rather than
  flagged.
- **Struct literals** — every field the struct declares must be provided, and every field provided
  must be declared (missing/unknown field errors), plus a literal-shaped field value's type is
  checked against the field's declared type.
- **Component prop passing** — `<UserCard user={u}/>` checks the attribute names against
  `UserCard`'s declared params (missing required / unknown prop errors). Event-handler attributes
  (`onclick={...}`, anything starting with `on`) are exempted since they're not component props.
- **`state`/`derived`/`const`/`provide` initializers** — checked against the declared type, but
  **only when the initializer is a literal** (`IntLiteral`, `StringLiteral`, a struct literal, an
  array literal, etc.). An initializer that's a function call, a binary expression, or any other
  non-literal is left unchecked — see "Explicitly out of scope" below for why.
- **Reactivity rules** — the same two rules enforced in codegen (`user.name = ...` forbidden on a
  `state<T>` struct; assigning to a `derived<T>` name forbidden) are re-checked here too, so they
  surface as a `where`/`line`-tagged diagnostic instead of only a codegen exception. This is
  deliberate, harmless duplication — codegen keeps its own check so it's still correct if ever run
  without the checker in front of it.
- **Null safety (`T?`), non-flow-sensitively** — a `Member`/`Index` access on an identifier whose
  declared type is `T?` is flagged as a **warning** unless it's inside the `consequent` branch of
  an `if (x)` or `if (x != null)` check on that exact identifier, matching the design doc's own
  §11 example. This narrowing is deliberately simple: it only recognizes that one direct pattern,
  re-derived fresh at each `if`, with no tracking across early returns, loops, or compound boolean
  conditions.

**Explicitly out of scope for this version** (so these are known gaps, not silent ones):
- General type inference. There's no unification engine — a `const` or `state` initialized from a
  function call, a variable reference, or an arithmetic expression isn't type-checked against its
  declared type, only literal-shaped initializers are.
- Flow-sensitive null narrowing beyond the single direct-`if`-guard pattern above (no narrowing
  through `&&`, no narrowing that survives past an early `return`, no loop-carried narrowing).
- Per-expression source locations. Diagnostics point at the enclosing **statement** or
  **declaration** (see "Source locations" below), not the specific sub-expression — e.g. a type
  error deep inside a large ternary is reported at the statement's line, not the ternary's.

**Source locations.** The AST previously carried no position information at all — only tokens did.
This version adds a `line: number` field to `Stmt`, `ComponentMember`, `TopLevelDecl`, and
`TemplateNode`, populated via three/four choke-point wrapper functions in the parser
(`parseStatement`, `parseComponentMember`, `parseTopLevelDecl`, `parseTemplateNode`) that capture
`this.current.line` before dispatching to the real per-kind parse function, rather than threading a
`line` parameter through every individual `parse*()` function by hand. This gives statement/
declaration-level granularity cheaply; per-token spans (needed for real squiggly-line LSP
diagnostics) are a `docs/Crescent_Design.md` §14.7 v1.0-milestone concern, not something this pass
tries to solve.

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
entirely after consuming `style {`, and read raw characters directly via `Lexer.readRawSelector()`.
A style value is a sequence of raw-CSS and `{expr}` parts (`parseStyleDeclaration()` in
`parser.ts`), so a value can freely mix the two, e.g. `border: 2px solid {accent_color};`. When a
`{` interpolation is encountered, the parser brace-matches the raw source to find the corresponding
`}`, and parses the extracted substring using a **fresh, independent `Parser` instance**. This
sidesteps having to keep a raw cursor and a token-lookahead cursor in sync across mode switches.

**Nullable/array modifier chaining.** `parseType()` parses a base type once, then applies `?` and
`[]` modifiers left-to-right in a loop, each wrapping the previous type. `string[]?` → nullable
array of string. `string?[]` → array of nullable string.

## What's deliberately not here yet

- A first-version semantic checker exists (`src/checker.ts`, see "Semantic Checker" above), but it
  does not do general type inference or flow-sensitive null narrowing — see that section's
  "Explicitly out of scope" list for the precise boundary.
- No `Selector`/CSS-property validation — style selectors and raw property values are captured as
  opaque strings; only the `{expr}` interpolations are actually parsed.
- `ParseError`/`CodegenError`/`ModuleError` are still fail-fast (thrown on the first problem) —
  only the semantic checker collects multiple diagnostics per file.
