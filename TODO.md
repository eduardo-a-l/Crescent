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

## Scope / Names

- [x] Basic scope resolution
- [ ] Comprehensive symbol resolution
- [ ] Duplicate declaration diagnostics
- [ ] Undefined-name diagnostics
- [ ] Cross-module symbol resolution

## Types

- [x] Basic type checking
- [x] Struct/property checks
- [x] Generic-aware type positions
- [~] Nullable checking
- [ ] Complete assignment compatibility
- [ ] Function argument checking
- [ ] Function return-type checking
- [ ] Array element type checking
- [ ] Component prop type checking
- [ ] Function-type compatibility
- [ ] More precise diagnostic messages

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
- [x] Restrictions on reactive object property mutation
- [ ] Comprehensive state mutation analysis
- [ ] Reactive collection mutation validation
- [ ] Derived-state dependency validation
- [ ] Lifecycle/reactivity validation
- [ ] Reactive CSS expression validation
- [ ] Component context validation for `provide` / `inject`

## Components

- [ ] Component declaration checking
- [ ] Component argument checking
- [ ] Component prop checking
- [ ] Component existence checking
- [ ] Event handler signature checking
- [ ] Slot usage validation
- [ ] Lifecycle block validation

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
- [ ] Improve CLI
- [ ] Add compiler arguments
- [ ] Add explicit input/output paths
- [ ] Add build mode
- [ ] Add check-only mode
- [ ] Add clear exit codes
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

---

# 10. Developer Experience

## CLI

- [ ] Friendly `crescent` command
- [ ] `crescent check`
- [ ] `crescent build`
- [ ] `crescent run` / development mode
- [ ] Clear compiler diagnostics
- [ ] Config file

## Formatting

- [ ] Decide whether Crescent needs an official formatter
- [ ] Define formatting conventions
- [ ] Implement formatter

## Language Server

> Major v1.0 milestone.

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

---

# 12. Language Features to Evaluate

These are deliberately NOT commitments.

Each should be designed before implementation.

- [ ] More complete generics
- [ ] Better function types
- [ ] Pattern matching
- [ ] Better error/result conventions
- [ ] Async semantics refinement
- [ ] Module/package ecosystem
- [ ] Compile-time/meta-programming possibilities
- [ ] More expressive collection operations
- [ ] Destructuring
- [ ] Spread syntax
- [ ] Additional primitive types if justified

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
