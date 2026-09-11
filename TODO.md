# Crescent — Development Roadmap

> This is the working roadmap for Crescent.
>
> It is intentionally organized by dependency and maturity rather than by
> "cool features first".
>
> `[ ]` planned
> `[~]` partially implemented / needs work
> `[x]` sufficiently implemented for the current milestone
>
> This is a roadmap, not a promise that every item will be implemented exactly
> as written. Language-design decisions may change during v0.x.

---

# 0. Project Foundation

## Repository / Development

- [x] Repository structure established
- [x] Language design document
- [x] Formal grammar document
- [x] Compiler project
- [x] Example programs
- [x] Automated tests
- [ ] Establish consistent compiler error output
- [ ] Establish a clear distinction between parser, semantic, and codegen errors
- [ ] Improve compiler README so its description matches the current implementation
- [ ] Establish a documented release/versioning strategy

---

# 1. Lexer

## Core

- [x] Basic tokenization
- [x] Keywords
- [x] Identifiers
- [x] Literals
- [x] Operators
- [x] Delimiters
- [x] Comments
- [x] Lexer modes

## View / Style

- [x] `view` mode
- [x] `style` mode
- [x] Code interpolation from view/style
- [ ] Expand lexer edge-case coverage
- [ ] Improve lexer diagnostics
- [ ] Test malformed interpolation/mode transitions

---

# 2. Parser

## Core Language

- [x] Component declarations
- [x] Struct declarations
- [x] State declarations
- [x] Derived declarations
- [x] Provide/inject declarations
- [x] Constants
- [x] Functions
- [x] Expressions
- [x] Statements
- [x] Control flow

## Types

- [x] Basic types
- [x] Generic type syntax
- [x] Arrays
- [x] Nullable modifiers
- [x] Modifier chaining
- [x] Function types
- [ ] Broader generic-type coverage
- [ ] More type-syntax edge cases

## Templates

- [x] HTML/native elements
- [x] Component elements
- [x] Expressions/interpolation
- [x] `if` / `else`
- [x] `for`
- [x] Event handlers
- [x] Slots
- [ ] More complex template structures
- [ ] Stronger malformed-template diagnostics

---

# 3. AST

- [x] Core AST representation
- [x] Components
- [x] Structs
- [x] Expressions
- [x] Statements
- [x] Template nodes
- [x] Style nodes
- [ ] Review AST consistency as language grows
- [ ] Remove redundant representations
- [ ] Document invariants expected by later compiler stages

---

# 4. Module System

- [x] Multi-file discovery
- [x] `use` resolution
- [x] Relative module paths
- [x] Import-cycle detection
- [ ] More module error diagnostics
- [ ] Clearly define module semantics in the language specification
- [ ] Test larger module graphs
- [ ] Test duplicate/conflicting declarations across modules

---

# 5. Semantic Checker

> This is one of the most important areas of the project.
>
> v1.0 requires a semantic checker that is trustworthy enough to enforce
> Crescent's language rules.

## Architecture

- [ ] Evaluate introducing an explicit typed-AST/IR pass between semantic
  analysis and codegen: resolve names → resolve modules → infer/check types →
  validate reactivity → typed AST → codegen. Today codegen and diagnostics
  each re-derive type information from the plain AST; a typed AST would let
  codegen, a future LSP (hover/autocomplete), and future optimizations
  (constant folding, dead-code elimination) all consume the same
  already-resolved information instead of duplicating the work.
- [ ] If a typed-AST layer is introduced, document its invariants next to the
  AST invariants already tracked in §3, since the two are closely related.

## Scope / Names

- [x] Basic scope resolution
- [ ] Comprehensive symbol resolution
- [x] Duplicate declaration diagnostics
- [x] Undefined-name diagnostics — `checkExpr`'s `Identifier` case flags any read of a name not in
  scope, in global scope, or in `BUILTIN_GLOBALS`, so it fires uniformly across reads, assignment
  targets, and view interpolations (`undefined-identifier-read.crs`, `undefined-identifier.crs`);
  `on_change`'s watched names are checked separately for existence
  (`checker.ts`'s `OnChangeDecl` case). What's *not* covered here is cross-module resolution — see
  the next item — a name imported via `use` from another file that itself doesn't exist there is a
  module-resolution error, not something this checker function sees.
- [ ] Cross-module symbol resolution

## Types

- [x] Basic type checking
- [x] Struct/property checks
- [x] Generic-aware type positions
- [~] Nullable checking
- [ ] Complete assignment compatibility
- [x] Function argument checking
- [ ] Function return-type checking
- [ ] Array element type checking
- [x] Component prop type checking
- [ ] Function-type compatibility
- [ ] More precise diagnostic messages — e.g. `state<BogusType> x = "hello";` currently reports
  `Type mismatch: declared as 'BogusType' but initialized with a 'string' value` rather than
  `Unknown type 'BogusType'`, because `checkLiteralTypeMatch` (used for `state`/`derived`/
  `provide`/`const` initializers) compares the declared type against the initializer's inferred
  type without first checking `typeIsResolvable` on the declared type itself — unlike the
  `VarDecl`/function-param/function-return/struct-field/component-param/`inject` type checks (all
  now covered by fixtures — see "Undefined-name diagnostics" note above and the `Components`
  section below), which do call `typeIsResolvable` directly and report the clearer message. Found
  while sweeping `checker.ts` for `typeIsResolvable` call sites; not fixed here since it's small
  new behavior (calling `typeIsResolvable` in one more place, then deciding whether the existing
  `Type mismatch` message stays as a secondary diagnostic or is suppressed once `Unknown type` has
  already fired) rather than a test for something that already works as intended.

## Null Safety

- [~] Basic nullable checks
- [ ] Flow-sensitive null narrowing
- [ ] Correct narrowing through `if`
- [ ] Correct narrowing through logical conditions
- [ ] Prevent invalid nullable access
- [ ] Test nested/control-flow cases

## Structs

- [x] Struct declarations
- [x] Property lookup
- [x] Struct literals
- [ ] Complete field validation
- [ ] Missing-field diagnostics
- [ ] Extra-field diagnostics
- [ ] Assignment compatibility

## Reactivity

- [x] Basic state validation
- [x] Restrictions on reactive object property mutation — `checkAssignmentTarget` rejects a direct
  property write on a `state<T>` holding a struct (`direct-property-write-forbidden.crs`) and a
  direct reassignment of a `derived<T>` value (`derived-assignment-forbidden.crs`). Both were
  previously only exercised indirectly, through `codegen.ts`'s own separate `CodegenError` checks
  (`test-forbidden-derived-assignment.js`/`test-forbidden-property-write.js`) — the checker's own
  diagnostic path had no direct regression test until this session. Note codegen still duplicates
  both rules independently rather than relying on the checker to have already caught them; see
  "Comprehensive state mutation analysis" below and `AGENTS.md` §9/§10 on keeping semantic checks
  out of codegen where avoidable — collapsing the duplication is future cleanup, not done here.
- [ ] Comprehensive state mutation analysis
- [ ] Reactive collection mutation validation
- [ ] Derived-state dependency validation
- [ ] Lifecycle/reactivity validation
- [ ] Reactive CSS expression validation
- [ ] Component context validation for `provide` / `inject`

## Components

- [x] Component declaration checking — a component's params + `state`/`derived`/`provide`/
  `const`/`inject`/function members are checked for duplicate names as one combined set
  (`duplicate-component-member.crs`), and a component with zero or more than one `view` block is
  rejected (`missing-view-block.crs`, `duplicate-view-block.crs`)
- [x] Component prop checking — a required prop that isn't passed (`missing-prop.crs`), a prop
  passed that isn't declared as a param (`unknown-prop.crs`), and a prop passed with a
  type-mismatched value (`wrong-prop-type.crs`, `wrong-prop-type-string-attr.crs`) are all flagged;
  attributes starting with `on` are exempted from the unknown-prop check since they're event
  handlers, not props
- [x] Component existence checking — a template element referencing a component name that doesn't
  exist (`unknown-component.crs`), or that resolves to a struct instead of a component
  (`struct-as-component.crs`), is flagged
- [ ] Event handler signature checking — `on*` attributes are currently exempt from prop
  validation entirely (see "Component prop checking" above); nothing yet verifies the handler
  expression actually resolves to a function, or that its signature is call-compatible with how
  the runtime invokes it
- [ ] Slot usage validation
- [ ] Lifecycle block validation — `on_mount`/`on_change` bodies are type-checked like any other
  statement block, and `on_change`'s watched names are checked for existence
  (`checker.ts`'s `OnChangeDecl` case), but nothing yet validates lifecycle-specific rules (e.g.
  restrictions on what's valid inside `on_mount` vs. elsewhere, once such rules are decided)

## Diagnostics

- [ ] Consistent diagnostic structure
- [ ] Source locations
- [ ] Helpful expected/actual type messages
- [ ] Error codes
- [ ] Warnings vs errors
- [ ] Multiple diagnostics per compilation
- [ ] Avoid cascading nonsense errors

---

# 6. Code Generation

## JavaScript

- [x] Basic JavaScript generation
- [x] CommonJS output
- [x] State generation
- [x] Derived values
- [x] Expressions
- [x] Basic templates
- [x] Conditional rendering
- [x] Loops
- [x] Event handlers
- [x] Component composition
- [x] Slots
- [x] Lifecycle hooks

## Styling

- [x] Scoped CSS
- [x] Reactive CSS variables
- [ ] More CSS edge cases
- [ ] Better source mapping between Crescent and generated CSS

## Lists

- [x] Keyed list reconciliation
- [ ] More exhaustive keyed-reconciliation tests
- [ ] Verify behavior under insertion/removal/reordering
- [ ] Verify state preservation semantics

## Unsupported Features

- [x] Avoid generating incorrect output for unsupported features
- [ ] Improve unsupported-feature diagnostics
- [ ] Track codegen coverage explicitly
- [ ] Expand supported subset incrementally

---

# 7. Runtime

## Reactive Core

- [x] `state`
- [x] `derived`
- [x] `effect`
- [x] `watch`
- [ ] Thorough dependency-tracking tests
- [ ] Better cleanup/disposal semantics
- [ ] Verify nested effects
- [ ] Evaluate additional reactive primitives once async semantics (§12) are
  settled — e.g. a `resource`-style primitive for async reactive data with
  explicit loading/success/error states, comparable to:
  `state<User[]?> users = null;` + `on_mount { users = await loadUsers(); }`
  today, but as a first-class reactive shape instead of a plain nullable
  `state`. Any new primitive name/semantics need a design discussion first —
  do not add `computed`/`memo`/`resource` merely because other frameworks
  have them; justify each against what `state`/`derived`/`effect`/`watch`
  cannot already express.

## Lifecycle

- [x] `on_mount`
- [x] `on_change`
- [ ] Evaluate whether `on_destroy` is worth adding; keep the lifecycle hook
  set as small as the language can get away with — more hooks make a
  reactive system harder to reason about, not easier
- [ ] Only evaluate `before_update`/`after_update` if `on_mount`, `on_change`,
  and (if added) `on_destroy` prove insufficient for a real use case

## DOM

- [x] Element creation
- [x] Text nodes
- [x] Conditional blocks
- [x] List rendering
- [x] Slots
- [x] Event binding
- [ ] More DOM edge cases
- [ ] Cleanup when components/blocks are removed
- [ ] Verify memory/resource cleanup

## Reactive Collections

- [~] Reactive list behavior
- [ ] Complete mutation API
- [ ] `push`
- [ ] `remove`
- [ ] `pop`
- [ ] `clear`
- [ ] Index assignment
- [ ] Correct targeted updates
- [ ] Tests for every mutation operation

---

# 8. End-to-End Compiler

- [x] Discover `.crs` files
- [x] Parse files
- [x] Resolve modules
- [x] Semantic-check files
- [x] Skip codegen for files with semantic errors
- [x] Generate JavaScript
- [x] Mirror source tree in generated output
- [x] Improve CLI
- [x] Add compiler arguments
- [x] Add explicit input/output paths
- [x] Add build mode
- [x] Add check-only mode
- [x] Add clear exit codes
- [ ] Add production/development modes

---

# 9. Testing

## Parser

- [ ] Lexer unit-test suite
- [ ] Parser unit-test suite
- [ ] Grammar edge-case tests
- [ ] Invalid syntax tests

## Semantic Checker

- [ ] Valid-program tests
- [ ] Invalid-program tests
- [ ] Type mismatch tests
- [ ] Nullability tests
- [ ] Reactivity-rule tests
- [ ] Component tests
- [ ] Module tests

## Codegen

- [x] Existing DOM smoke tests
- [ ] Expand generated-output tests
- [ ] Snapshot/reference tests where useful
- [ ] Unsupported-feature tests

## Runtime

- [ ] State update tests
- [ ] Derived-state tests
- [ ] Conditional rendering tests
- [ ] List reconciliation tests
- [ ] Component lifecycle tests
- [ ] Event tests
- [ ] Style reactivity tests
- [ ] Slot tests

## Regression

Every important compiler bug should ideally become a regression test.

## Compiler Robustness

- [ ] Fuzz the lexer/parser with malformed/random input (e.g. `component {{`,
  `state<><><>`, unterminated `view {`). The requirement is that the
  compiler never crashes with an unhandled exception on malformed input —
  it should always produce a controlled diagnostic instead.
- [ ] A small compiler benchmark suite (lexer/parser/checker/codegen/full
  build, at a few representative project sizes), tracked over time. This
  becomes especially useful once incremental compilation (§10) exists, so
  regressions in build speed are caught the same way correctness
  regressions are.

## Conformance

- [ ] A structured `tests/valid/` / `tests/invalid/` fixture suite (with
  further grouping by area — types, nullability, reactivity, modules,
  components, codegen — mirroring the semantic-checker categories above),
  where each fixture declares its expected outcome (compiles cleanly /
  produces a specific error code once error codes exist, per §5's
  Diagnostics list). This moves the test suite closer to being an
  executable language specification rather than a fixed set of assertions.

---

# 10. Developer Experience

## CLI

- [x] Friendly `crescent` command
- [x] `crescent check`
- [x] `crescent build`
- [ ] `crescent run` / development mode
- [~] Clear compiler diagnostics
- [ ] Config file

## Project Scaffolding & Dev Server (Later)

> Do not start this before the compiler/CLI foundations above (and the
> semantic checker in §5) are solid. An ecosystem and dev-server workflow
> built on top of unstable language semantics has to be substantially redone
> once those semantics settle — sequencing matters here.

- [ ] `crescent new <name>` project scaffolding (a conventional
  `src/App.crs`, `src/components/`, `public/` layout)
- [ ] `crescent.toml` project configuration (package name/version, build
  entry point and output dir, dev server port), so the compiler and CLI stop
  needing everything inferred from command-line arguments or hard-coded
  paths. This is also the natural place for a future `[dependencies]` table
  if/when a package ecosystem (§12) is ever pursued.
- [ ] `crescent dev` — a development server that rebuilds automatically on
  save, as a natural extension of today's `Crescent: Preview` command
- [ ] Hot-module-reload for the dev server/preview that preserves component
  state across edits, instead of a full reload. Today's `Crescent: Preview`
  (see `editors/vscode/README.md`'s "Preview" section) reloads the whole
  webview and resets state on every save; a real HMR loop — recompile only
  the changed component, send it to the running page, patch the DOM, keep
  state — would make Crescent feel much closer to a modern frontend
  framework in day-to-day use.
- [ ] Incremental compilation (file → AST → symbols → dependency graph →
  invalidate/recompile only what changed) as the shared foundation both the
  dev server's rebuild step and a future LSP (below) need for reasonable
  performance on larger projects.

## Near-Term VS Code Enablement (v0.x)

> Goal: make Crescent pleasant enough to write, check, build, and preview in VS Code before the
> semantic checker and full LSP are complete. Early tooling must report the compiler's current
> behavior faithfully; it must not invent type-system guarantees that the compiler does not have.

- [x] Extract reusable project APIs from `src/index.ts`:
  `checkProject(root)` and `buildProject(root, outDir)` (see `src/project.ts`). `inMemoryFiles?`
  was not added — `loadAllPrograms()` is disk-based only; an in-memory-files variant is still
  open if a future LSP needs to check unsaved editor buffers.
- [x] Make `crescent check <path>` and `crescent build <path> --out-dir <path>` work on arbitrary
  projects rather than the hard-coded `examples/` directory.
- [~] Define machine-readable diagnostics with file, line, column (line-only temporarily if
  necessary), severity, message, and a stable error code when available. Diagnostics now carry
  file + line (no column yet) + severity + message; no stable error codes yet. Fatal parse/lex
  errors now also carry the offending file (`FatalDiagnostic.file`, via `modules.ts`'s
  `loadAllPrograms()` attaching it before rethrowing) — module errors (import cycles, missing
  exports) still don't, since they inherently involve more than one file and their message text
  already names them.
- [x] Create a minimal VS Code extension: `.crs` file association, TextMate syntax highlighting,
  comment/bracket/indent configuration, and `Crescent: Check` / `Crescent: Build` commands. See
  `editors/vscode/` (`editors/vscode/README.md` documents what the grammar does and does not
  attempt, and the remaining limitations below).
- [x] Publish parser, module, and semantic-checker diagnostics in VS Code on save and on open (via
  `checkProject()`, called in-process — see `editors/vscode/src/extension.js` and its README's
  "Diagnostics" section for exactly what is and isn't covered, including the multi-root-workspace
  limitation).
- [ ] Publish diagnostics on document changes too (continuous/incremental checking), not just on
  save/open.
- [x] Add a `Crescent: Preview` command that builds the project and opens/reloads the browser
  output. See `compiler/src/webPreview.ts` (`buildPreviewHtml()`) and `editors/vscode/src/
  extension.js`'s `crescent.preview` command — `editors/vscode/README.md`'s "Preview" section
  documents exactly what gets mounted (top-level, zero-parameter components only), how mount
  failures are isolated, and the known trade-off that a reload replaces the whole webview rather
  than doing a real hot-module-reload (so previewed component state resets on every save). A
  second command, `crescent.previewInBrowser` ("Crescent: Open Preview in Browser"), builds the
  identical HTML but writes it to disk and opens it in the system's real default browser via
  `vscode.env.openExternal` instead of a VS Code webview panel — see "Opening it in a real
  browser" in the same README section for its own trade-off (no save-triggered auto-reload, since
  there's no live connection to an already-open external tab).
- [ ] Replace process-based checking with a small LSP server once the shared project API and
  diagnostic model are stable.

## Formatting

- [ ] Decide whether Crescent needs an official formatter
- [ ] Define formatting conventions
- [ ] Implement formatter

## Language Server

> A complete, incremental LSP remains a major v1.0 milestone. The minimal VS Code diagnostics and
> preview loop above are intentionally an earlier v0.x deliverable. A trustworthy semantic checker
> (§5) — ideally producing a typed AST — and the incremental-compilation work under "Project
> Scaffolding & Dev Server" above are both prerequisites this depends on, not parallel work.

- [ ] LSP architecture
- [ ] Diagnostics
- [ ] Syntax awareness
- [ ] Autocomplete
- [ ] Go to definition
- [ ] Hover/type information
- [ ] Symbol search
- [ ] Document symbols
- [ ] VS Code integration
- [ ] Incremental checking

---

# 11. Frontend Output

## JavaScript / Browser

- [x] Runnable generated JavaScript
- [x] Self-contained web bundle
- [ ] Better browser integration
- [ ] Source maps
- [ ] Production optimization
- [ ] Tree shaking strategy
- [ ] Asset handling

## Future

- [ ] Evaluate WebAssembly/direct-DOM target
- [ ] Determine whether/when Wasm should become a supported target
- [ ] Do not implement a second backend until the language semantics are stable enough to justify it
- [ ] Server-side rendering (SSR), with a hydration step that attaches
  Crescent's reactive runtime on top of server-rendered HTML. Far future:
  this depends on codegen/runtime being stable enough to target a
  non-browser environment first, and on the same "don't add a second target
  before semantics stabilize" reasoning as Wasm above.

---

# 12. Language Features to Evaluate

These are deliberately NOT commitments. Each should be designed before implementation.

> **This section is important, not urgent — and that's a deliberate distinction, not a way of
> saying "someday, maybe never."** Recent sessions have mostly hardened what already exists
> (regression tests for already-implemented checker diagnostics, documentation accuracy). That
> work is valuable and should continue, but correctness/testing work is never *finished* — there
> is always one more untested diagnostic, one more edge case. Crescent should not treat that as a
> reason to indefinitely postpone language evolution. A healthy rhythm alternates between
> hardening what exists and deliberately spending a session on real design work from this section
> — sketching grammar, prototyping a small parser change, writing an example program in the
> proposed syntax — even while the checker is still imperfect. Neither activity should be starved
> by the other. See `TODO.md` §16's priority order for how this fits with day-to-day task
> selection; that order is about picking *today's* task, not a permanent verdict that language
> evolution always waits.

## Core Language Evolution

The following ten areas are grouped and roughly sequenced by dependency — later groups lean on
earlier ones (pattern matching needs something worth matching on; exhaustiveness checking needs
pattern matching to exist first; interfaces/traits interact with generics either way). This is a
design roadmap, not an implementation order forced on any single session — pick one coherent group,
design it against `docs/Crescent_Design.md`'s existing principles, and write it up there before
touching the parser.

- [x] **String interpolation** — implemented: a `string` literal can embed `{ Expression }`
  directly (`"Hello, {name}!"`), in any context a string literal appears (expressions, `view {}`
  text, attribute values); `\{`/`\}` escape a literal brace. See
  `docs/Crescent_Design.md`'s "String Interpolation" subsection (§2) for the language-level
  semantics and `docs/Crescent_Grammar.md` §2.4/§6/§10 for the grammar and implementation notes.
  Still open, deliberately deferred: formatting expressions (controlling *how* an embedded value
  renders — padding, decimal places, etc.) — there's no concrete need for it yet, and it's a
  materially different, larger feature (a mini format-spec mini-language) than "embed an
  expression," which is why it isn't bundled into this bullet's `[x]`.
- [ ] **Destructuring** — struct destructuring, array destructuring, in both variable declarations
  and function parameters. (Supersedes the old flat "Destructuring" bullet from earlier revisions
  of this roadmap — same idea, spelled out.) Worth designing before tuples/enums below, since both
  of those become much more useful once values can be destructured.
- [ ] **Tuples** — tuple types, tuple literals, tuple indexing, and tuple destructuring (building
  on the destructuring item above). Consider whether Crescent actually needs tuples as a distinct
  concept or whether structs already cover the same need less anonymously — decide deliberately,
  don't add both without a reason.
- [ ] **Enums / algebraic data types** — basic enums, variants that carry values, type checking for
  both, and how they interact with `match` below. This is also the natural home for a future
  `Result<T, E>` (see "Better error/result conventions" below) — a `Result` is just an enum with an
  `Ok`/`Err` shape, so enums should probably land before or alongside `Result` rather than after it.
- [ ] **Pattern matching** — `match` itself; literal patterns; wildcards; variable bindings; struct
  patterns; enum patterns; guards. (Supersedes the old flat "Pattern matching" bullet.) Most
  compelling once enums and destructuring exist, since matching on a bare primitive alone is a much
  smaller feature than matching on structured data. Justify this against Crescent specifically —
  e.g. it integrates naturally with reactive state that has an explicit
  loading/success/error shape — not merely "other typed languages have `match`."
- [ ] **Exhaustiveness & pattern diagnostics** — non-exhaustive `match` detection, unreachable-
  pattern detection, missing-case diagnostics, and generally better pattern-related error messages.
  Only meaningful once `match` and enums exist; this is the checker-side follow-up to the pattern
  matching item above, not a separate feature to design in isolation.
- [ ] **First-class function types** — function types such as `(int, int) -> int`; functions passed
  as parameters; functions returned as values; function-type compatibility/checking (this
  supersedes the old flat "Better function types" bullet, and overlaps with the existing "Function-
  type compatibility" item under §5's Types subsection — resolve that overlap when this is actually
  designed, don't track it in two places once it's real work); and closures, which is the part of
  this group most likely to need real design discussion given Crescent's current reactivity model
  (what does a closure capture from `state<T>`? a snapshot or a live reference?).
- [ ] **Generics** — generic structs, generic functions, generic components, generic collections,
  and — only if Crescent actually needs them in practice — type constraints. (Supersedes the old
  flat "More complete generics" bullet.) Crescent already has generic *type syntax* in the parser;
  this item is about generic *declarations* (writing a struct/function/component once and
  parameterizing it), a materially bigger step.
- [ ] **Interfaces / traits** — interface or trait declarations, implementations, type checking, and
  how they interact with generic constraints above. Explicitly undecided: whether this should be
  one concept or two (an "interface" a component/struct implements vs. a "trait" used purely for
  generic bounds) is itself part of the design work, not a foregone conclusion — don't build both
  without first deciding whether the distinction earns its complexity in Crescent specifically.
- [ ] **More powerful type-system features** — type aliases; better nullable/type narrowing (this
  overlaps with the existing, already-tracked "Flow-sensitive null narrowing" work under §5's Null
  Safety subsection — that's compiler-hardening work on the *current* nullable model and can
  proceed independently of anything else in this list); possibly union types; possibly type-
  inference improvements; and whatever else real Crescent usage surfaces once the above features
  exist and people are actually writing more Crescent code. This is deliberately the least defined
  item — treat it as "revisit once the rest of this list has taught us more about what Crescent
  actually needs," not a queue of specific sub-features to pick off.

## Ecosystem, Runtime & Peripheral Ideas

- [ ] Better error/result conventions, specifically a `Result<T, E>` type as an
  explicit alternative to exceptions (e.g. `Result<User, Error> getUser(int id)`
  paired with `match` above) — fits the "safe, explicitly typed" design
  goal in `docs/Crescent_Design.md` and could become a distinguishing feature
  rather than an incidental one. See "Enums / algebraic data types" above for why this
  probably wants to be built on top of enums rather than as its own special-cased type.
- [ ] Async semantics refinement, including how `await` composes with reactive
  state in lifecycle blocks (see the Runtime "Reactive Core" note above about a
  possible future `resource` primitive)
- [ ] Module/package ecosystem (a `crescent add <package>` style flow) — do not
  build this until module/language semantics are stable; an ecosystem built on
  a moving foundation has to be redone
- [ ] Compile-time/meta-programming possibilities (e.g. `derive(...)`-style
  annotations or decorator-like syntax the compiler understands) — explicitly
  post-v1.0; metaprogramming makes a young language significantly harder to
  learn and reason about, so it should not be attempted before the core
  semantics are settled
- [ ] More expressive collection operations
- [ ] Spread syntax
- [ ] Additional primitive types if justified
- [ ] A standard router (`route "/users/:id" { <User/> }`-style) once module
  semantics are stable — this is closer to "does Crescent feel like a complete
  frontend platform" than a core language feature, so treat it as ecosystem
  work, not compiler work
- [ ] A small official component library (button, modal, tabs, form, table,
  tooltip, ...) once the language is mature enough — valuable less as UI work
  and more as a real-world stress test: if common components are awkward to
  express in Crescent itself, that awkwardness is a signal about the language,
  not the components
- [ ] Compiler-assisted accessibility warnings (e.g. flagging an `<img>`
  without an accessible-name attribute) as part of the language/framework's
  philosophy — framed as "the compiler helps developers avoid common frontend
  accessibility mistakes," not "Crescent automatically solves accessibility"

Every proposal in this section should be able to answer "why is this
especially good *in Crescent*", not just "language X already has this." For
example, pattern matching is worth having because it integrates naturally
with reactive state that has an explicit loading/success/error shape — not
merely because other typed languages have `match`. This keeps Crescent's
feature set an intentional identity rather than an accumulation of other
languages'/frameworks' features.

---

# 13. Features NOT to Add Casually

Do not add these simply because another language has them.

- [ ] Classes
- [ ] Classical inheritance
- [ ] Arbitrary object-oriented encapsulation
- [ ] Operator overloading
- [ ] Complex punctuation-heavy syntax
- [ ] Features that undermine explicit typing
- [ ] Features that require a major runtime abstraction without a demonstrated benefit

Any proposal in this category requires an explicit language-design discussion first.

---

# 14. Milestones

## v0.x — Build the Foundation

Goal:

> A usable experimental language implementation whose core semantics are
> increasingly enforced by the compiler.

Priority:

1. semantic checker
2. parser/grammar correctness
3. compiler diagnostics
4. runtime correctness
5. codegen coverage
6. tests
7. CLI/tooling

---

## v0.x Compiler Maturity

Target:

- [ ] Parser handles the documented grammar reliably
- [ ] Semantic checker catches major invalid programs
- [ ] Null safety is reliable
- [ ] Component/type checking is reliable
- [ ] Reactivity rules are enforced
- [ ] Codegen handles the core language
- [ ] Runtime behavior is well-tested
- [ ] Compiler errors are understandable

---

## v1.0

The design document currently identifies two major requirements:

- [ ] Trustworthy semantic/type checker
- [ ] Real editor/LSP experience

Do not declare v1.0 complete merely because many syntax features exist.

The language foundation must be stable enough that users can reasonably build software against it.

---

## Post-v1.0

Prefer:

- bug fixes;
- additive features;
- performance improvements;
- quality-of-life improvements;
- tooling improvements.

Avoid fundamental redesigns of stabilized v1.0 semantics.

---

## Someday / Maybe

Not commitments, not scheduled on any current milestone — recorded here so
the idea isn't lost, and explicitly gated on the project reaching a much more
mature state first.

- [ ] Self-hosting: rewrite meaningful parts of the compiler (lexer, parser,
  checker) in Crescent itself, once the language is mature and expressive
  enough to comfortably write a compiler in. This would be a strong signal
  that the language is genuinely capable, not merely a frontend-templating
  DSL — but it is a large, multi-year-scale idea and should not influence
  near-term priorities.
- [ ] Revisit the WebAssembly/direct-DOM question (§11) once/if the above
  is ever seriously pursued, since a self-hosted compiler and an alternate
  backend are somewhat related long-term bets.

---

# 15. AI Task Selection Rules

When an AI starts a session:

1. Read `AGENTS.md`.
2. Read `HANDOFF.md`.
3. Look at `TODO.md`.
4. Pick ONE coherent task.
5. Check the design and grammar.
6. Implement it.
7. Test it.
8. Update `HANDOFF.md`.
9. Stop.

Do not automatically continue into the next unchecked checkbox.

A single checked item is better than five half-finished items.

---

# 16. Current Priority Order

When there is no explicit task from the maintainer, prefer work in approximately this order:

1. Fix contradictions between specification and implementation.
2. Strengthen the semantic checker.
3. Strengthen compiler diagnostics.
4. Add regression tests for existing behavior.
5. Complete core codegen/runtime behavior.
6. Improve module handling.
7. Improve CLI/developer experience.
8. Expand language features.
9. Explore additional compilation targets.

Do not prioritize new syntax over correctness of already-defined syntax unless there is a deliberate design reason.

This ordering is for picking *today's* task when nothing else is specified — it is not a claim
that item 8 (language features, see §12) is low-value or should wait indefinitely. Hardening work
(items 1-7) has no natural end point; there is always another edge case or another untested
diagnostic. If several sessions in a row have all been hardening work, that is itself a signal to
deliberately pick a §12 item next, not a reason to keep finding one more thing to harden. Both
kinds of work move the project forward; neither should permanently starve the other.
