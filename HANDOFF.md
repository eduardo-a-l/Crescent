# Crescent — AI Handoff

> This file is the shared short-term memory between AI coding sessions.
>
> It describes the current state, not the entire history of Crescent.
> Replace/update it when the active task changes.

## Current State

**Branch:** `develop`

**Current phase:** v0.x compiler development

**Active area:** Compiler / language implementation

**Current task:**
Just completed: semantic checker now validates component prop *types* (not just prop names) for
literal-shaped values — both `attr="string"` attributes and `attr={literal}` expr attributes are
compared against the target component's declared param types (see "Last Completed Work" below).
Choose the next item from `TODO.md` before beginning new work.

---

## Repository Reality

Crescent currently contains:

- a handwritten lexer;
- a recursive-descent parser;
- an AST;
- multi-file module resolution;
- a semantic checker;
- JavaScript code generation;
- a reactive runtime;
- example `.crs` programs;
- compiler and browser/DOM smoke tests.

Important documentation:

- `docs/Crescent_Design.md`
- `docs/Crescent_Grammar.md`
- `compiler/README.md`

The design and grammar documents should be consulted before changing language behavior.

---

## Last Completed Work

### Feature

Semantic checker: "Component prop type checking" (`TODO.md`, Semantic Checker → Types). The
existing `<Tag prop={...}>`/`<Tag prop="...">` check in `checkTemplateNode`'s `Element` case
already validated prop *names* (`Missing prop '...'` / `Unknown prop '...'` diagnostics); it now
also validates prop *types* for literal-shaped values, the same class of check this and the prior
session added for struct-literal fields and function-call arguments.

Two attribute shapes are handled:

1. **Plain string attributes** (`name="World"`, parsed as `{ isExpr: false, stringValue }`) — these
   are always a `string` value; checked directly against the declared param type (e.g. `int value`
   receiving `value="5"` is now flagged).
2. **Expr attributes** (`name={expr}`, parsed as `{ isExpr: true, exprValue }`) — `null` is checked
   against nullability, and literal-shaped exprs (`IntLiteral`, `StringLiteral`, etc., via the
   existing `inferLiteralType`) are compared against the declared type. A non-literal expr (an
   identifier, a call, a member access — e.g. the very common `<UserCard user={user}/>` pattern) is
   not type-checked, matching the checker's pre-existing "literal-shaped only" limitation.

### What changed

`checker.ts`:

- Added `checkAttributeTypeMatch(declared, attr, where, line, diagnostics)`, mirroring
  `checkCallArgs`'s per-argument logic but adapted for `AST.Attribute`'s two shapes (plain-string
  vs expr).
- In `checkTemplateNode`'s `Element` case, `declaredParams` changed from a `Set<string>` (name
  existence only) to a `Map<string, AST.CrescentType>` (name → declared type), and the "Unknown
  prop" loop now calls `checkAttributeTypeMatch` for every attribute whose name *does* match a
  declared param (the `on*` event-handler skip for unknown-name attributes is unchanged).

Added three new fixtures under `compiler/scripts/fixtures/checker/`:

- `wrong-prop-type.crs` — negative, an expr-attribute literal mismatch (`name={42}` where
  `Greeting` declares `string name`).
- `wrong-prop-type-string-attr.crs` — negative, a plain string attribute against a non-string
  param (`value="5"` where `Age` declares `int value`).
- `correct-prop-type-ok.crs` — positive, both a non-literal expr prop (`name={username}`, a
  `state<string>`, skipped as non-literal) and a correctly-typed string-literal prop
  (`name="Bob"`) produce zero diagnostics — regression coverage for the very common "pass a
  variable as a prop" pattern already used throughout `examples/` (e.g.
  `structs_and_generics.crs`'s `<UserCard user={user}/>`), confirming it's still not (incorrectly)
  flagged.

Added matching cases/assertions to `compiler/scripts/test-checker.js`.

Did not touch `docs/Crescent_Design.md` or `docs/Crescent_Grammar.md`: same reasoning as the prior
session — this closes a semantic-checker TODO item using syntax/semantics that are already fully
documented (components, params, element attributes); no syntax or design changed, only what the
checker now verifies about already-legal programs.

### Files changed

- `compiler/src/checker.ts`
- `compiler/scripts/test-checker.js`
- `compiler/scripts/fixtures/checker/wrong-prop-type.crs` (new)
- `compiler/scripts/fixtures/checker/wrong-prop-type-string-attr.crs` (new)
- `compiler/scripts/fixtures/checker/correct-prop-type-ok.crs` (new)
- `TODO.md` (checked off "Component prop type checking")
- `HANDOFF.md`

---

## Tests

### Last type-check and full suite

```text
npx tsc --noEmit
-> no errors

npm test
-> 140 PASS, 0 FAIL, exit code 0
(build, npm start over examples/, test-checker.js with the three new fixtures above plus all
prior checker cases, all other script tests, build-web, and test-web.js)
```

---

## Important Decisions

Record decisions here when they affect future implementation.

Current known design constraints:

- Crescent is explicitly typed.
- `state<T>` provides reactive state.
- Reactivity is intentionally shallow for objects.
- Reactive collections have special mutation behavior.
- `derived<T>` is lazy/pull-based.
- Components use `view {}` blocks.
- Styling uses component-scoped `style {}` blocks.
- JavaScript is the current v0.x compilation target.
- v1.0 requires a trustworthy semantic checker and a real editor/LSP experience.

For details, see `docs/Crescent_Design.md`.

---

## Known Problems

Keep only currently relevant problems here.

### Documentation consistency

The compiler README's introductory text may describe the project as having no semantic/type checker even though `compiler/src/checker.ts` exists and is documented later in the same README.

Do not blindly "fix" this without checking the current implementation and intended wording.

### Other

- `callback_param.crs` isn't wired into `build-web.js`/`test-web.js`, so `void()` callback params
  are checked and code-generated (verified by hand) but not yet exercised by a real-browser DOM
  click test. Would be a reasonable small follow-up if `void()` params become more widely used.
- The `void()` marker is still a narrow special case, not a real function-type feature — there is
  no grammar production for it, and no support for callback shapes with parameters or return
  values (e.g. `void(int)`). Formalizing function types as a real `CrescentType` variant (rather
  than a magic-string `NamedType`) is a larger, separate design task, not attempted here.
- Function-argument checking (prior session) is intentionally scoped: only same-component calls to
  a bare-identifier callee are resolved against a known `FunctionDecl`; calls where the checker
  cannot otherwise resolve the callee (e.g. an expression callee) are silently skipped rather than
  flagged, since Crescent has no other call form yet. If component-to-component method-style calls
  or top-level functions are ever added, `checkCallArgs`'s call site in the `Call` case of
  `checkExpr` is where resolution would need to be extended.
- Component prop type checking (this session) has the identical literal-shaped-only limitation:
  `checkAttributeTypeMatch` only flags a mismatch when the attribute is a plain string or an
  expr-attribute whose value is a literal; a variable, call, or arithmetic-expression prop value
  (by far the most common case — e.g. `<UserCard user={user}/>`) is not type-checked.
- Argument/prop type checking, like every other type-compatibility check in this file, only covers
  literal-shaped values (`inferLiteralType` returns `null`, and is silently skipped, for a
  variable, a call, or an arithmetic expression). This is a pre-existing limitation of the whole
  checker, not something new — "Complete assignment compatibility" and general type inference
  remain open `TODO.md` items. Closing this properly would need a real expression type-inference
  pass (tracking declared types for identifiers/derived/state through `scope`, not just literals),
  which is a materially bigger task than any single session so far and should be scoped
  deliberately rather than folded into the next narrow fixture-driven task.

---

## Unfinished Work

_No active unfinished implementation. The component-prop-type-checking task above is complete and
tested._

---

## Recommended Next Step

1. Read `TODO.md`.
2. The maintainer wants an early, usable VS Code feedback loop rather than waiting for a complete
   language implementation. A detailed staged plan is recorded in `TODO.md` under
   "Near-Term VS Code Enablement (v0.x)".
3. A reasonable first implementation unit there is to extract reusable `checkProject()` and
   `buildProject()` APIs from `compiler/src/index.ts`, then expose them through path-based
   `crescent check` / `crescent build` commands. This unlocks both editor diagnostics and preview
   without coupling the initial VS Code extension to the current `examples/` demo entry point.
4. Alternatively, continue strengthening the semantic checker per `TODO.md`'s "Current Priority
   Order" (§16). The narrow, literal-shaped-value checks in the Types section
   (arg/prop/struct-field/`VarDecl` type matching) are now largely done; remaining Types items —
   "Complete assignment compatibility", "Array element type checking", "Function-type
   compatibility" — all fundamentally need the same thing: a real expression type-inference helper
   that can determine the type of an arbitrary expression (an identifier's declared type from
   scope, a derived's type, a binary expression's result type), not just a literal's type. Consider
   scoping that inference helper as its own small unit before building more callers on top of it,
   rather than deepening literal-only special cases further.
5. Other reasonable next candidates: "Function return-type checking" (verify a `return <expr>`'s
   literal-shaped type against the function's declared, non-`void` return type — distinct from the
   already-completed return-type *existence* check), or moving into the Scope/Names or Reactivity
   subsections of `TODO.md`'s Semantic Checker section (e.g. "Duplicate declaration diagnostics").
6. Keep diagnostics honest and source-backed: parser/module/codegen failures must remain distinct
   from semantic diagnostics, and incomplete checking must not be presented as full type safety.
7. Read the relevant design/grammar sections.
8. Inspect the existing implementation.
9. Implement the task.
10. Run tests.
11. Update this file.
12. Commit the completed unit if appropriate.

---

## Session Log

### Latest session

**AI:** Claude

**Task:** Component prop type checking (`TODO.md`, Semantic Checker → Types) — compare
literal-shaped prop values passed to component elements against the target component's declared
param types, extending the existing prop *name* check (`Missing prop`/`Unknown prop`).

**Result:** Done. Added `checkAttributeTypeMatch()`, covering both plain string attributes
(`name="World"`) and expr attributes (`name={42}`); non-literal expr values (the common
`name={someVar}` case) are left unchecked, matching the checker's existing literal-shaped-only
limitation. Added two negative fixtures and one positive regression fixture, plus matching
`test-checker.js` cases.

**Commit:** Not committed — working tree contains the focused diff described above.

**Tests:** `npx tsc --noEmit` (clean); `npm test` (140 PASS, 0 FAIL, exit 0).

**Next:** See "Recommended Next Step" above — a real expression type-inference helper is needed
before the remaining Types-section TODO items (assignment compatibility, array elements,
function-type compatibility) can go beyond literal-only checking.

---

### Previous session

**AI:** Claude

**Task:** Function argument checking (`TODO.md`, Semantic Checker → Types) — validate a function
call's argument count and (for literal-shaped arguments) types against the callee's declared
parameters, for same-component function calls.

**Result:** Done. Added `checkCallArgs()` and threaded a per-component `functions` map through
`checkExpr`/`checkStmts`/`checkTemplateNode` so calls anywhere in a component's body, view, or
style block can be resolved. Added two negative fixtures (`wrong-arg-count.crs`,
`wrong-arg-type.crs`) and one positive regression fixture (`correct-call-ok.crs`).

**Commit:** Not committed at the time; pushed to `develop` by the maintainer as commit
`541a24a feat: add function argument checking`.

**Tests:** `npx tsc --noEmit` (clean); `npm test` (137 PASS, 0 FAIL, exit 0). Note:
`compiler/node_modules` was not present at the start of that session (fresh clone); `npm install`
was run first.

---

### Older session

**AI:** Claude

**Task:** Extend declared type-name resolution to function parameter types (the last unchecked
declared-type position identified by the prior session).

**Result:** Done, plus two pre-existing bugs found and fixed along the way. Extending the check
surfaced that `typeIsResolvable()` already broke the design doc's own `void()` callback-param
example (§6) *before* this session touched it, and would have newly broken the `KeyboardEvent`/
`MouseEvent`/`FormEvent` typed-event-handler example (§13.3) once function params were checked.
Fixed both with narrow, documented special cases in `typeIsResolvable()`, and added working
examples (`callback_param.crs`, `typed_event_handler.crs`) plus a negative regression fixture for
the new function-param check itself.

**Commit:** Not committed — working tree contains the focused diff described above.

**Tests:** `npx tsc --noEmit` (clean); `npm test` (134 PASS, 0 FAIL, exit 0), including both new
examples compiling end-to-end and the new checker regression case.

**Next:** No known type-existence-checking gaps remain; move to a different `TODO.md` priority
(see "Recommended Next Step").

---

## Previous session

**AI:** Codex

**Task:** Extend declared type-name resolution to non-`void` function return types and statement/
template `for` loop item types.

**Result:** Done. The checker now reports unresolved return and loop item types in all relevant AST
positions. Added one fixture and three regression assertions. Grammar documentation updated.

**Commit:** Not committed at the time.

**Tests:** `npm run build && node scripts/test-checker.js` (clean/all PASS); `npm test` passed all
steps before the sandbox blocked its final esbuild directory read; `node scripts/build-web.js &&
node scripts/test-web.js` rerun with elevated sandbox access (all PASS).

---

## Handoff Checklist

Before ending a session:

- [ ] Current task is clearly stated.
- [ ] Completed work is listed.
- [ ] Every relevant changed file is listed.
- [ ] Tests actually run are listed.
- [ ] Failures are explicitly listed.
- [ ] Important design decisions are recorded.
- [ ] Unfinished work is recorded.
- [ ] Next step is explicit.
- [ ] `git diff` was inspected.
- [ ] No unrelated work was accidentally reverted.
- [ ] This file reflects the repository's actual state.
