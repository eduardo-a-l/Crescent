# Crescent Compiler — Lexer, Parser, Semantic Checker and Codegen (v0.1)

A hand-written recursive-descent lexer and parser for Crescent, implementing the grammar in
`../docs/Crescent_Grammar.md`, a semantic checker, and a codegen pass that emits plain, runnable
JavaScript for a supported subset of the language.

## Pipeline and errors

A project is a directory of `.crs` files (`docs/Crescent_Grammar.md` §11.2). `checkProject()` and
`buildProject()` in `src/project.ts` run these stages, and each kind of error belongs to exactly one
of them:

| Stage | What it does | What goes wrong, and what happens |
|---|---|---|
| Lex and parse, every file | `parseCrescent()` turns source into an AST | `LexError` or `ParseError`: `parseCrescent()` throws on the first problem in a file, while `parseCrescentRecovering()` (what the project loader uses) skips the damaged statement, member or declaration and goes on, returning up to 20 errors. **Per file**: `checkProject()` turns it into an error on that file (with its line), leaves the file out of the project, and carries on with the others. A `use` of it is an error on the `use` line |
| Resolve imports | `resolveFileImportsLenient()` binds each `use`; `findCycles()` finds import cycles | A diagnostic on the `use` line (missing module or item, `super` above the root, a cycle). **Per file**: collected, never fatal |
| Check, every file | `checkFile()` | Diagnostics (error or warning) collected per file. A file with an error is not emitted |
| Codegen, every file without errors | `generateProgram()` | `CodegenError` for something not yet supported. That file is skipped, with the reason and the line it was found on |
| Write output | `buildProject()` | A file is written only if no file it imports a component from was skipped, so every `require()` in the output resolves |

`LexError`/`ParseError`/`CodegenError` are thrown, the others are returned as `Diagnostic`s
(`{ severity, message, where, line }`). `LexError` and `ParseError` carry the `line` they were found
on (`null` only when there is no single line to name, such as a syntax tree that is too deep) and,
once `loadAllProgramsLenient()` has caught them, the `file`; the message does not repeat the line, so
the error diagnostic `checkProject()` makes from one has that line and `crescent check` prints it as
`file:line [error] file 'file': message`. A line inside a string or style interpolation is the line in the file, not in
the snippet, and an unterminated string is reported where it began. `CodegenError` carries the line of the component, member,
statement or template node being generated (not of the exact expression inside it), which
`buildProject()` keeps as `FileBuildResult.line` and `crescent build` prints as
`file:line: codegen skipped: reason`; a file skipped only because something it imports was not built
has no line; the checker, `resolveFileImportsLenient()` and `findCycles()`
never throw on a problem in the source (`resolveFileImports()` and `detectCycles()` do, for callers
that want the first problem as an exception). On any input, however malformed, the compiler is expected to raise
nothing but those three (see "Robustness" below).

## Structure

- `src/tokens.ts` — token types and keyword table
- `src/lexer.ts` — character-level lexer, plus raw-scan helpers used only by style-block parsing,
  and the position and line-counter reset that parser backtracking relies on
- `src/ast.ts` — AST node type definitions
- `src/parser.ts` — the recursive-descent parser: classifies identifier-led statements by
  lookahead, enforces the nesting limits of the spec's §12, and rejects syntax trees deeper than
  1000 levels. `parseCrescentRecovering()` reports several syntax errors per file (see "Syntax
  error recovery" below)
- `src/modules.ts` — project discovery (every `.crs` under the root except hidden entries and
  `node_modules`), `use` resolution that collects its problems (`resolveFileImportsLenient()`; the
  throwing `resolveFileImports()` and `detectCycles()` are thin wrappers), iterative cycle finding,
  and the relative `require()` paths codegen needs (see "Modules" below)
- `src/checker.ts` — the semantic checker: scope resolution, struct/prop/type checks, reactivity
  rules, loop-control placement, import conflicts and unused imports, and flow-sensitive null
  analysis (see "Semantic Checker" below)
- `src/narrowing.ts` — the pure AST analysis behind the null analysis: per-function effect
  summaries (the names a function may set to null, write, and read, closed over the call graph),
  what a statement or expression may null, the dependencies of `derived` values, and
  `blockDefinitelyExits()`
- `src/references.ts` — `collectReferencedNames()`, which finds the names a file refers to, for
  the unused-import warning
- `src/codegen.ts` — AST → JavaScript codegen (see "Codegen" below for what's supported)
- `src/runtime.ts` — the small reactive runtime (`state`, `derived`, `effect`, `watch`, `h`, `text`,
  `ifBlock`, `forEach`, `slot`, `injectStyle`) that generated components import at run time
- `src/project.ts` — reusable `checkProject()`/`buildProject()`, used by the CLI, the VS Code
  extension's diagnostics, `src/index.ts` and `src/webPreview.ts`, so all of them agree on exactly
  what counts as a per-file error; `buildProject()` also decides which files can be
  written (see "Pipeline and errors")
- `src/cli.ts` — the `crescent check` / `crescent build` command line (see "CLI" below)
- `src/index.ts` — the `npm start` demo: builds every `.crs` under `examples/` (including nested
  directories) into `dist/gen/` with `buildProject()` and prints each file's diagnostics and what
  happened to its codegen
- `src/webPreview.ts` — `buildPreviewHtml()`: runs `buildProject()`, bundles each compiled file with
  `esbuild`, and mounts every top-level zero-parameter component into a single preview HTML page —
  the engine behind the VS Code extension's `Crescent: Preview` command (see
  `editors/vscode/README.md`'s "Preview" section for exactly what gets mounted and why)
- `bench/` — the benchmark runner, its input generators and the committed baseline (see
  "Benchmarks")
- `scripts/` — the tests, run by `npm test`, and `fixtures/` for the ones driven by `.crs` files.
  By area: the language rules and checker (`test-checker.js`, `test-loops.js`,
  `test-struct-destructuring.js`, `test-string-interpolation.js`, `test-forbidden-property-write.js`,
  `test-forbidden-derived-assignment.js`, `test-array-mutators.js`,
  `test-array-mutators-native.js`); modules (`test-modules.js`, `test-missing-import.js`,
  `test-circular-import.js`, `test-import-conflicts.js`, `test-unused-imports.js`,
  `test-module-diagnostics.js`, `test-module-recovery.js`, `test-module-semantics.js`,
  `test-module-discovery.js`, `test-module-graphs.js`); error locations and recovery (`test-error-locations.js`, `test-codegen-error-lines.js`, `test-parser-recovery.js`); versions and the changelog (`test-versioning.js`, see `docs/Crescent_Versioning.md`); the runtime and generated code in `jsdom`
  (`test-counter.js`, `test-day-picker.js`, `test-theme-toggle.js`, `test-composition.js`,
  `test-reactive-list.js`, `test-keyed-list.js`, `test-effect-disposal.js`,
  `test-provide-inject.js`, `test-multi-root.js`, `test-derived-lifecycle.js`, `test-web.js`,
  `test-preview.js`); robustness and speed (`test-fuzz.js`, `test-parser-backtracking.js`,
  `test-bench.js`); and `test-readme.js`, which checks this README against the source tree. `fuzz.js` and `fuzz-harness.js` are the fuzzer, and `build-web.js` bundles
  generated components (via `esbuild`) into a single self-contained `web/index.html` you can open
  directly in a browser
- `examples/*.crs` — sample source files exercising the language's tricky corners, including a
  nested `examples/modules/` tree exercising cross-file `use` imports

## Running

```
npm install
npm start
```

This parses every file in `examples/`, runs the semantic checker on each one and prints its
diagnostics (if any), and writes generated JS to `dist/gen/` for any component whose members are
fully supported by codegen (see below). Files using unsupported features print a clear "Codegen
skipped: ..." message rather than emitting incorrect output.

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

## Benchmarks

```
npm run bench
npm run bench:compare
```

`bench/run.js` times the lexer, parser, checker and code generator on synthetic inputs of doubling
size (`bench/shapes.js`: a long function body, many members, many components, a wide view, many
null guards, a chain of functions that call each other), and `checkProject` and `buildProject` on
multi-file projects of 20, 100 and 500 files. Each figure is the best of several runs, in
milliseconds, and the last column of each table is the growth of the total for one doubling of the
input, so about 2 means linear. `--quick` runs two small sizes, `--shapes a,b` picks shapes,
`--json file` saves the results and `--help` lists the rest.

`bench/baseline.json` holds the figures from one machine. Times are also compared after dividing by
a fixed calibration workload that the run measures first, so `npm run bench:compare` is meaningful on
another machine: it exits with status 1 when a stage is more than `--threshold` (default 2) times
slower than the baseline in those units and takes more than 5 ms. Regenerate the baseline after a
deliberate change with `node bench/run.js --json bench/baseline.json`.

`npm test` does not run the benchmark, but `scripts/test-bench.js` checks that five of the shapes
scale linearly (a 4 times larger input must take under 8 times as long, which a quadratic stage would
not satisfy), unit-tests the comparison logic and smoke-tests a quick run. The `functions` shape is
left out on purpose: it is quadratic in the number of members times functions of one component,
because every function body starts from a copy of the component's whole scope. It is harmless at
realistic sizes (about 25 ms for 1000 functions) and shows up in the table above 2000.

## CLI

Once built (`npm run build`), a `crescent` CLI is available at `dist/cli.js` for checking and
building arbitrary Crescent projects (not just `examples/`):

```
node dist/cli.js check [path]
node dist/cli.js build [path] --out-dir <dir>
```

`[path]` defaults to the current directory. `crescent check` parses, resolves modules, and runs
the semantic checker over every `.crs` file under `path`, printing one line per diagnostic
(`file:line [severity] where: message`) and exiting non-zero if any error was found.
`crescent build` does the same and writes generated JavaScript to `<out-dir>/gen/` for every file
that can be written (no errors, and nothing it imports a component from was skipped), alongside a
copy of the runtime at `<out-dir>/runtime.js` so the output directory is self-contained. A file that
is skipped is reported with its reason.

`npm run cli -- check <path>` runs the same commands directly against `src/cli.ts` via `ts-node`,
without a prior build.

`crescent check`/`crescent build` are process-based today; a `package.json` `bin` entry
(`crescent`) points at `dist/cli.js` so `npm link` exposes a real `crescent` command once built.
This is the first step of the CLI/editor-tooling plan in `TODO.md` (§10) — see there for the VS
Code extension and LSP work this unlocks. The underlying `checkProject()`/`buildProject()` APIs
live in `compiler/src/project.ts` and are also used by the `examples/`-driven `npm start` runner.

## Codegen

Generated output is CommonJS (`require`/`module.exports`), matching the project's existing
`module: commonjs` TypeScript config, and imports its reactive primitives from `runtime.ts`.
Reactivity is signal-based: `state<T>` declarations become `state()` calls whose reads/writes are
tracked by `effect()`, so text interpolations and `if`/`else` template branches re-render
automatically when the state they read changes.

**Currently supported:** `state<T>`, `derived<T>` (lazy pull-based memoization, per §14.5), `const`,
plain functions (including `async`) with `if`/`else`, `while`, `do`-`while`, C-style `for`, `break` and
`continue` (compiled to the same native JavaScript loops), arithmetic/comparison/ternary
expressions, `view` blocks (one root element, or several wrapped in a `fragment`, see below), text
literals and `{expr}` interpolation, `if`/`else` template branches, template `for` loops over arrays
(one or more root nodes per iteration), static and expression-valued
attributes, event-handler attributes (`onclick={fn}`), `style` blocks (scoped CSS, see below),
component-as-element usage (`<UserCard user={user}/>`), `<slot/>` content passthrough,
`on_mount`, `on_change(...)`, and assignment to non-identifier targets (array-index and, where
legal, struct-field writes — see below). A loop whose header or body would need a statement-level
rewrite that cannot be expressed in place, such as an array mutator call in a C-style `for`
initializer, is a `CodegenError` and the file is skipped.

`for` loops with an explicit `key` (§14.4) get real keyed reconciliation: `forEach` in
`runtime.ts` keeps a persistent `key -> { item, node }` map across re-renders and, on each update,
reuses the existing DOM node for any key whose item reference is unchanged (`===`), only calling
`renderItem` again for genuinely new or replaced items, then reorders the surviving/created nodes
into place with `insertBefore` rather than tearing the list down. This means reordering,
growing, or shrinking a keyed list preserves the DOM node identity of every unaffected item — no
node is destroyed and recreated just because its position or a sibling changed. **The comparison
is by reference, not deep equality**: the idiom this is built around is replacing an array element
wholesale (`items[i] = Struct { ...updatedFields };`, as already used in `reactive_list.crs`) —
mutating a _field_ of an existing element in place (`items[i].done = true;`, which the assignment
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
and injected once per component _type_ into `<head>` via `injectStyle`. Declarations containing
`{expr}` — including values that mix raw CSS text and interpolation, e.g. `2px solid {accent}` —
compile to a CSS custom property (`--crs-N`) set on the component's root element inside a
per-instance `effect()`, so purely-static declarations stay in the static stylesheet and only the
reactive ones pay for a per-instance binding.

Component-as-element usage (`<UserCard user={user}/>`) compiles to a direct function call —
`UserCard({ user: user })`. Every generated component function always destructures a `children`
prop (defaulting to `[]`), so any nested markup passed between a component's tags —
`<Card><h1>...</h1></Card>` — is compiled in the _caller's_ scope (so it still sees the caller's
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

**Array mutator methods** on a `state<T[]>` — `items.push(x)`, `.pop()`, `.shift()`,
`.unshift(x)`, `.splice(...)`, `.sort()`, `.reverse()` (native JS Array methods), plus two
Crescent-specific ones, `.remove(x)` (removes the first element `===` to `x`, via `indexOf` +
`splice`) and `.clear()` (`.length = 0`) — follow the same `.get()`-mutate-then-`.set(.get())`
pattern as index writes, per §13.1 ("no spread operators required... method calls flag the
internal collection as dirty"). This is recognized **only** when the call is a bare statement —
`items.push(x);` on its own line — matching every one of the design doc's own examples; codegen
does not currently track a forced re-notify through other expression positions (a `VarDecl` whose
initializer is `items.pop()`, for instance, still mutates the array correctly since `.get()`
returns the live reference, but won't itself trigger a re-render — only the _value returned_ is
affected, not reactivity). It's also not checked that the receiver is actually an array-typed
`state` — calling `.push()` on a `state<int>` would silently generate `count.get().push(x)`,
which fails at runtime, not compile time; the semantic checker does not yet track full type
information for this to be a real diagnostic.

`derived<T>` follows §14.5's lazy pull-based memoization: the runtime `derived()` helper only
recomputes on the next read after a dependency changes (not eagerly on every change), and
assigning to a derived name directly (`total = 5;`) is a compile-time `CodegenError` — dependencies
must be reassigned instead. `on_mount` bodies run once, after the component's view (and any style
effects) have already been constructed, so state writes inside `on_mount` land on live, already-
wired subscribers rather than an empty subscriber set. `on_change(a, b)` compiles to a `watch()`
call that subscribes to the named dependencies but — unlike a plain `effect()` — deliberately skips
firing on its own first (construction-time) run, so it only fires on genuine subsequent changes.

`provide<T>`/`inject<T>` (§13's "Dependency Injection / Tree Context") thread a value down the
component tree keyed **by type name**, not by variable name — `provide<ThemeState> current_theme`
in an ancestor and `inject<ThemeState> theme` in any descendant match because both say
`ThemeState`, regardless of the different local variable names. This works via a hidden `__ctx`
parameter every generated component function accepts (`{ ..., __ctx = {} } = {}`, alongside the
already-existing hidden `children` parameter) and passes to every child component call it makes,
whether or not that component itself provides or injects anything — so an intermediate component
that does neither still transparently forwards context through to its own descendants. A
`provide<T>` member computes its value once, merges it into a **new** context object
(`{ ...__ctx, ThemeState: current_theme }`, using a fresh `__ctxN` variable each time since `const`
can't self-reference in the same scope), and that new object — not the one the component itself
received — is what gets passed to its own children from that point on. **Two things this version
does not do**, stated rather than silently missing: the threaded value is a **one-time snapshot**,
not reactive — if `current_theme` is later reassigned, already-rendered descendants that injected
it will not update, since it's a plain captured value, not a signal; and calling `inject<T>` with
no ancestor providing that type isn't caught at compile time — it fails at runtime with a
`TypeError` on first property access, not a compile error (though at least a clear one, not a
silent wrong value).

A `view` block, an `if`/`else` branch, or a `for`-loop body with **more than one** root
node compiles to a `fragment(...)` call — a `display: contents` wrapper `<span>`, the same
pattern `ifBlock`/`forEach`/`slot` already use internally — so multiple sibling elements can be
returned from any of those three positions without an extra, semantically-meaningless wrapper
`<div>` showing up in page layout. This only kicks in when there's genuinely more than one node in
a given position: a single-root case still compiles exactly as before (no `fragment()` call at
all), so nothing changes for the overwhelming majority of existing components. The three positions
nest independently — a 2-node `if`-branch inside an otherwise single-root `view` block gets its
own `fragment()` wrapper at exactly that level, while the enclosing `view`, if it also has just one
top-level root node, does not.

## Modules

Rust-style `use` declarations (see `docs/Crescent_Grammar.md` §11) let one `.crs` file reference
`component`/`struct` declarations from another. There's no `pub`/`export` keyword — every
top-level declaration is implicitly importable.

```
use card::UserCard;                                     // ./card.crs, item UserCard
use components::forms::{Button, Input as TextInput};    // ./components/forms.crs, two items, one aliased
use super::shapes::Point;                                // ../shapes.crs relative to *this file's own directory*
```

`checkProject()` discovers every `.crs` file under the project root (skipping hidden entries and
`node_modules`), resolves every `use` to a concrete file, and builds a file-level dependency graph.
Problems with imports are ordinary per-file diagnostics, located on the `use` line, so they do not
hide each other or the file's other diagnostics: a module or item that does not exist, a `super`
above the project root, a name that clashes with another import or a local declaration, and an import
cycle are errors, and an import that is never used is a warning. Every cycle is reported, not only
the first, on the `use` that closes it and naming the full chain (`Circular import: a.crs -> b.crs ->
a.crs`); a file in a cycle is still checked. A file that does not parse is an error on that file only. A
file with an error is not emitted, and neither is a file that imports a component from a file that
was not emitted. `docs/Crescent_Grammar.md` §11 has the complete rules.

Codegen impact differs by what's imported: importing a `struct` produces **no runtime code at
all**, since struct type names are already fully erased at codegen (a `User { ... }` struct
literal compiles to a plain JS object literal that never references `User`) — a struct import is
purely a compile-time name-resolution check. Importing a `component`, on the other hand, compiles
to a `require()` call — `const { UserCard } = require('./card');` — with a relative path computed
from the _generated_ file's location (mirroring the source tree under `dist/gen/`), so
`dist/gen/modules/components/card.js` correctly requires `../../../runtime` while a flat file at
`dist/gen/counter.js` requires `../runtime`, and both resolve to the same `dist/runtime.js`.

There's no re-export chaining in v0.1: an import must resolve to an actual declaration in the
target file, not to something that file only imported itself.

## Semantic Checker

`src/checker.ts` runs as its own pass between parsing and codegen (`checkFile()`, called for every
file by `checkProject()`) and collects **multiple** diagnostics per file — rather than throwing on the first
problem like `ParseError`/`CodegenError` — so a file can be checked once and report everything
wrong with it. A diagnostic is `{ severity: 'error' | 'warning', message, where, line }`; `where`
is a human-readable path like `component 'Cart', function 'add_one'`, and `line` is the line of
the enclosing statement or declaration (see the source-location note below). Errors block codegen
for that file, and for any file that imports a component from it; warnings are printed but don't
block.

What it checks:

- **Scope resolution** — every `Identifier` used anywhere (expressions, assignment targets,
  `on_change(...)` watch lists) must resolve to a param, `state`/`derived`/`const`/`provide`/
  `inject`, a local `for`-loop or `VarDecl` binding, a sibling function, a component/struct name
  (local or imported), or one of a small allowlist of browser/JS globals (`fetch`, `console`,
  `Math`, `Date`, `JSON`, `Promise`, timers, `window`, `document`, storage) — the design doc's own
  `async`/`await` example (§13.4) uses `fetch(...)`, so that had to be recognized rather than
  flagged.
- **Duplicate declarations** — two top-level `component`/`struct` decls sharing a name in one
  file, two fields sharing a name within one `struct`, two params sharing a name within one
  function's param list, and a component's params/`state`/`derived`/`provide`/`const`/`inject`/
  function names colliding with each other (they all share one component-level namespace, so a
  param shadowing a `state` of the same name is also a collision, not just same-kind repeats).
- **Function call arguments** — a call to a function declared in the same component is checked for
  argument count, plus (for literal-shaped arguments) type, against the callee's declared params.
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
- **Loop control** — `break` and `continue` outside a loop are errors (`'break' can only be used
  inside a loop`).
- **Imports** — a name bound by a `use` that clashes with another import or with a top-level
  declaration of the file is an error, and an imported name the file never refers to is a warning
  (`src/references.ts`); a `use` that failed to resolve binds nothing, and the follow-on "unknown
  component/type/identifier" errors for that name are suppressed so one mistake is reported once.
  The module-level errors themselves come from `src/project.ts` and `src/modules.ts` (see
  "Modules").
- **Null safety (`T?`), flow-sensitively** — a `Member`/`Index` access on an identifier whose
  declared type is `T?` is a **warning** unless the identifier is known to be non-null at that
  point. A bare `x` or `x != null` narrows the `then` branch of an `if`, a ternary, a `while` or
  C-style `for` body, and the right side of `&&`; `x == null` narrows the `else` branch, the right
  side of `||`, and, when the `then` branch always ends in `return`, `break` or `continue`, every
  statement after the `if` in the same block. The narrowing is dropped as soon as the value may
  have been set back to null: by an assignment of anything not known to be non-null, by a call to
  a component function that may assign it (per-function summaries, followed through calls and
  recursion), by an `await` (for `state`, `derived`, `provide` and `inject`, not `const`), at the
  start of a loop and after it when the loop body may null it, and, for a `derived` value, by any
  write to something it depends on. Inside one expression the same rules apply left to right. The
  analysis is `src/narrowing.ts` plus its use in `checkStmts()` and `checkExpr()`; the complete
  rules, and the cases not analysed, are in `docs/Crescent_Design.md` §11.

**Explicitly out of scope for this version** (so these are known gaps, not silent ones):

- General type inference. There's no unification engine — a `const` or `state` initialized from a
  function call, a variable reference, or an arithmetic expression isn't type-checked against its
  declared type, only literal-shaped initializers are.
- Null narrowing of anything but a plain identifier (`user.name` is never narrowed), calls made
  from separate nodes of a `view`, and event handlers (see `docs/Crescent_Design.md` §11).
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

## Effect Disposal

Before this, `effect()` had no way to stop reacting: `ifBlock`/`forEach` wiped or removed DOM
subtrees on every change, but any `effect()` created _inside_ that content (every `text()`
binding, every nested `derived()`, every nested `ifBlock`/`forEach`) kept running forever,
subscribed to signals nobody would ever read the result of again. This was a real memory leak and
wasted-work bug, not a missing feature — invisible in small examples because nothing was ever torn
down often enough to notice.

`effect()` now returns a `dispose()` handle. Internally, each effect tracks exactly which
signals' subscriber sets it's currently registered in (`ctx.deps`, a `Set` of `Set<EffectFn>`),
re-collected fresh on every run — so `dispose()` (or a natural re-run) can precisely remove it from
those sets. This also fixes a smaller pre-existing correctness issue for free: previously, once an
effect read a signal, it stayed subscribed forever even if a later run took a different branch
(e.g. a ternary) and stopped reading it.

Knowing _when_ to call `dispose()` is the harder half, and it's solved with an ambient
**disposal-scope stack**, not by threading dispose handles through every call site by hand. Any
`effect()` created while a scope is active auto-registers its own `dispose` into that scope's list
— so `ifBlock`/`forEach` wrap each render call in `withDisposalScope(() => renderFn())`, and every
effect created anywhere inside that call — directly, or transitively through `text()`, a nested
`derived()`, or a nested `ifBlock`/`forEach` calling `effect()` internally — gets captured
automatically, with no changes needed to `text()`, `derived()`, or codegen at all. `ifBlock`
disposes the previous render's scope before building the next one; `forEach` disposes a removed
keyed entry's scope when it drops out of the list (or the whole current entry set, if the
`forEach` itself is torn down by an ancestor).

One thing this _doesn't_ do automatically: a render function's own outer `effect()` call, when
disposed, only clears **that effect's own** reactive subscriptions — it has no idea the callback
also built nested content that needs tearing down. `ifBlock`/`forEach` account for this explicitly
(each `registerDisposal()`s a combined function that disposes both its own effect _and_ whatever
it last rendered) rather than relying on `effect()`'s auto-registration alone; a bug where the
composability claim above didn't actually hold for a component-as-element two levels deep inside a
list was caught by a dedicated test for exactly this (`scripts/test-effect-disposal.js`) before it
shipped.

## Key implementation decisions

**`<` disambiguation (generic vs. comparison vs. tag-open).** Not resolved at the lexer level —
the lexer always emits a plain `LT` token. Disambiguation happens in the parser based on which
production is currently being parsed: `parseType()` is only ever called from known type positions
(after `state`/`derived`/`provide`/`inject`, in param lists, return types, and via a speculative
parse — see below), so a `<` encountered there is always a generic. Inside `MODE_VIEW`'s
`parseTemplateNode()`, a leading `<` is always a tag. Everywhere else (`parseRelational()`), `<` is
the comparison operator.

**Statement-start ambiguity (`Type name = expr;` vs. `name = expr;` vs. `name();`).** A statement
that starts with an identifier is classified by looking at the one or two tokens after it
(`tokenAfterIdentifier()`, `identifierMayStartDeclaration()`), and only the form that can match is
attempted. A `{` next means a struct destructure; `IDENT`, `<`, `?`, or a `[` that is immediately
followed by `]` means a declaration (those are exactly the tokens that can follow the first word of
a type, or a type, in the grammar); anything else (`=`, `(`, `.`, `++`, `[` followed by an index
expression, and so on) is an assignment or expression statement and goes straight to
`parseAssignmentOrExprStatement()`. The classification is exact, not a heuristic: the form it skips
could not have matched. The attempt that remains is still speculative, with `snapshot()` and
`restore()` (`Token.start` plus `Lexer.setPos()`), and a failed attempt is counted in
`parseStats.backtracks`. Before the lookahead every assignment and expression statement threw and
caught two exceptions, and building those `Error` objects was 43 percent of parse time; now ordinary
statements cause no backtracks, which `scripts/test-parser-backtracking.js` checks, and statement-heavy
input parses between three and seven times faster. The same lookahead decides the `for` header
(`for (Type x in ...)` or C-style) and the C-style initializer. What still backtracks: a C-style `for`
with a typed initializer (once per loop), `Identifier '{'` in an expression that turns out not to be a
struct literal, and the other places that use `snapshot()` for lookahead. `restore()` also rewinds the
lexer's line counter (`Lexer.lineBefore()`), which it did not do originally, so line numbers after a
backtrack across a newline are no longer too high.

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

## Robustness

On any input, however malformed, the compiler is expected to raise nothing but `LexError`,
`ParseError` and `CodegenError`, and never to hang or run out of memory. `scripts/fuzz.js` checks
that:

```
node scripts/fuzz.js <seed> <iterations> [deep]
```

It mutates every program under `examples/` and `scripts/fixtures/` (truncation, deletion,
duplication, swapped lines, inserted keywords and punctuation, random characters), builds token
soup, and with `deep` also runs pathological inputs (nesting up to 100,000 levels, a
million-character identifier and string, 200,000 statements), pushing each through parse, check and
codegen. It prints every uncontrolled exception grouped by stage, type and throwing location with the
smallest input that caused it, writes each input to `/tmp/fuzz-last.txt` first so a hang or an
out-of-memory abort can be traced, and exits non-zero on a finding. `scripts/test-fuzz.js` runs it
in `npm test`, in child processes with a timeout and a heap cap so a regression fails the test and
doesn't take the suite down.

Two limits keep recursive passes from exhausting the call stack, and both give an ordinary
`ParseError` when exceeded (`docs/Crescent_Grammar.md` §12): 256 levels of nested expressions,
statements, types and template nodes, and a syntax tree 1000 levels deep, which bounds how long a
chain of operators, member accesses, calls or index operations can be. `parseCrescent()` also turns
any stack overflow it still meets into a `ParseError`.

## Syntax error recovery

`parseCrescent()` stops at the first problem and throws it. `parseCrescentRecovering()` returns
`{ program, errors }` instead: after an error it skips ahead to a point where parsing can safely go
on, and reports the next problem it finds. It recovers at four levels: a statement inside a block,
a member of a component, a top-level declaration, and a node of a `view` block (see below). Skipping to a safe point means going on to the
next `;` or the `}` that closes the damaged item, at the same brace depth and outside any
parentheses or brackets, so a `for (a; b; c)` header is skipped whole.

Rules that keep the list useful instead of long:

- The first error is always the one `parseCrescent()` throws; a file that parses gives the same
  tree and no errors from both.
- A second error on the line of the previous one is not reported (an inserted `;` that splits a
  statement in two gives one error, not two).
- At most 20 errors are reported, and recovery gives up when skipping makes no progress or reaches
  the end of the file.
- A lex error, or an error inside a `style` block (which is read as raw text, not as tokens), ends the
  list, keeping the errors found before it.
- Inside a `view` block a damaged node is skipped to the next node at the same brace depth (a string,
  `if`, `for` or opening tag), so every bad node is reported. Elements nest by tags, not braces, so a
  damaged element is skipped to its own closing tag, counting nested tags. A few repairs keep one
  mistake from becoming several errors: a closing tag whose name matches no enclosing element ends
  the current element (a typo in the name), while one that names an enclosing element is left for it
  (the current element was never closed); `/p>` with its `<` missing closes the current element; an
  open tag without its `>` is dropped when another tag follows; and a mismatch or stray closing tag
  after an earlier error in the same element or view is not reported again.
- With no syntax tree, `program` is `null` whenever there are errors; the file is not checked or built.

`test-parser-recovery.js` holds the exact expectations, a differential test against `parseCrescent()`
on mutated examples, and guards that a stray `;` or `)` gives exactly one error at least 90% of the
time (about 98% today), that the same holds inside views for a stray `;`, `)`, or a deleted `<` or
`>` (98 to 100%), and that two separate mistakes in one view are both reported at least 75% of the
time (91 to 97%). A deleted brace, or an unbalanced `{` in an attribute, changes the structure of the
file, and does produce follow-on errors.

## What's deliberately not here yet

- A semantic checker exists (`src/checker.ts`, see "Semantic Checker" above), but it does not do
  general type inference — see that section's "Explicitly out of scope" list for the precise
  boundary.
- No `Selector`/CSS-property validation — style selectors and raw property values are captured as
  opaque strings; only the `{expr}` interpolations are actually parsed.
- A deleted or unbalanced brace can still cause follow-on errors; `CodegenError` is
  fail-fast per file. Module errors and semantic diagnostics are collected per file.
- The checker is quadratic in the number of members times functions of a single component (see
  "Benchmarks"); nothing realistic reaches it.
