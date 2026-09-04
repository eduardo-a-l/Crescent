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
Just completed: semantic checker now flags duplicate declarations — two top-level components/
structs sharing a name in one file, duplicate struct fields, duplicate params in a single
param list, and duplicate component members (params and state/derived/provide/const/inject/
function names all share one component-level namespace) — see "Last Completed Work" below.
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

Semantic checker: "Duplicate declaration diagnostics" (`TODO.md`, Semantic Checker → Scope/Names).
Unlike the last two sessions (literal-shaped type matching), this is a pure name-collision check
with no type inference involved, and closes a real latent bug: several places in the checker built
a `Map`/`Set` from a list of declarations keyed by name (`globalScope`, a component's `scope`,
`declaredFields`), which silently let a later duplicate overwrite an earlier one with zero
diagnostic. Four collision sites are now checked:

1. **Top-level declarations** — two `component`/`struct` decls sharing a name in the *same file*
   (`checkFile`). Diagnostic: `Duplicate top-level declaration 'Name' in 'relPath'`.
2. **Struct fields** — two fields sharing a name within one `struct` (`checkStructDecl`).
   Diagnostic: `Duplicate field 'name' in struct 'StructName'`.
3. **Component params + members, combined** — a component's `params` and its
   `state`/`derived`/`provide`/`const`/`inject`/function members all end up bound in the same
   `scope: Set<string>`, so a param named `count` and a `state<int> count` (or two functions named
   the same, or a param shadowing a state, etc.) previously just silently collapsed to one binding.
   Checked as a single combined list in `checkComponentDecl` (so cross-kind collisions, e.g. param
   vs. state, are caught, not just same-kind ones). Diagnostic: `'name' is declared more than once
   in component 'CompName'`.
4. **Function params** — two params sharing a name within one function's own param list (a
   `FunctionDecl` member, checked separately from #3 since a function's params are scoped to that
   function only, not the component). Diagnostic: `Duplicate param 'name' in function 'fnName'`.

### What changed

`checker.ts`:

- Added a small generic helper, `checkDuplicateNames<T>(items, getName, getLine, message, where,
  diagnostics)`, used at all four call sites above rather than writing the same "seen-set" loop
  four times.
- `checkFile`: builds `topLevelDecls` from `file.program.declarations` and runs the duplicate check
  on it *before* populating `globalScope`, so a duplicate declaration is reported once and the
  (necessarily somewhat arbitrary) "last one wins" `globalScope.set()` behavior for subsequent
  checking of the rest of the file is unchanged.
- `checkStructDecl`: runs the duplicate check on `decl.fields` before the existing per-field
  existence check.
- `checkComponentDecl`: builds a combined `namedItems` list (`decl.params` + the filtered
  name-bearing `decl.members`) and runs the duplicate check on it, before the existing view-count
  checks and the `functions`/`derivedNames` map construction.
- The `FunctionDecl` case (inside `checkComponentDecl`'s member loop): runs the duplicate check on
  `m.params` before the existing per-param existence check.

Note: only the *first* occurrence of a repeated name is silently accepted as "seen"; every later
occurrence gets its own diagnostic (so three declarations sharing a name produce two diagnostics,
not one) — this matches the natural reading of "each additional occurrence is itself a duplicate."

Added five new fixtures under `compiler/scripts/fixtures/checker/`:

- `duplicate-top-level.crs` — negative, two `component Greeting { ... }` decls in one file.
- `duplicate-struct-field.crs` — negative, a struct with two fields both named `name`.
- `duplicate-component-member.crs` — negative, a `state<int> count` and a `void count()` in the
  same component (cross-kind collision, confirming the combined check).
- `duplicate-function-param.crs` — negative, `int add(int a, int a)`.
- `no-duplicates-ok.crs` — positive, a struct and a component with entirely distinct names
  everywhere (top-level, fields, params, members) — zero diagnostics.

Added matching cases/assertions to `compiler/scripts/test-checker.js`.

Did not touch `docs/Crescent_Design.md` or `docs/Crescent_Grammar.md`: no syntax or semantics
changed — Crescent's grammar already disallows nothing about repeating a name (the parser
correctly accepts all of the negative fixtures above as syntactically valid programs); this only
adds a diagnostic for something that was previously silently accepted and silently wrong.

### Files changed

- `compiler/src/checker.ts`
- `compiler/scripts/test-checker.js`
- `compiler/scripts/fixtures/checker/duplicate-top-level.crs` (new)
- `compiler/scripts/fixtures/checker/duplicate-struct-field.crs` (new)
- `compiler/scripts/fixtures/checker/duplicate-component-member.crs` (new)
- `compiler/scripts/fixtures/checker/duplicate-function-param.crs` (new)
- `compiler/scripts/fixtures/checker/no-duplicates-ok.crs` (new)
- `TODO.md` (checked off "Duplicate declaration diagnostics")
- `HANDOFF.md`

---

## Tests

### Last type-check and full suite

```text
npx tsc --noEmit
-> no errors

npm test
-> 145 PASS, 0 FAIL, exit code 0
(build, npm start over examples/, test-checker.js with the five new fixtures above plus all
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
- Component prop type checking (prior session) has the identical literal-shaped-only limitation:
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
- Duplicate declaration diagnostics (this session) checks name collisions in four specific
  positions (top-level decls within one file, struct fields, component params+members combined,
  and function params). It does *not* yet cover: duplicate names across module boundaries (e.g.
  two `use`-imported names colliding with each other or with a local declaration — "Cross-module
  symbol resolution" is a separate, still-open `TODO.md` item); duplicate `for`-loop item names
  shadowing an outer binding (shadowing is allowed by design in most languages and wasn't treated
  as an error here); or duplicate local `VarDecl` names within a function body (not attempted this
  session — would need `checkStmts` to track declared-so-far names per block, which the current
  `localScope: Set<string>` passed to `checkStmts` doesn't distinguish from "declared in an outer
  scope" vs. "declared earlier in this exact block").

---

## Unfinished Work

_No active unfinished implementation. The duplicate-declaration-diagnostics task above is complete
and tested._

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
   Order" (§16):
   - **"Undefined-name diagnostics"** (Scope/Names) is worth checking against the current
     implementation before assuming it's unstarted — `checkExpr`'s `Identifier` case already
     reports `Undefined identifier 'name'` for unresolved identifiers in expressions, and
     `OnChangeDecl` separately checks its watched names. It's plausible this TODO item is already
     substantially done and mostly needs verification/regression tests rather than new code; don't
     assume it's a blank slate.
   - Extending duplicate-declaration checking to local `VarDecl`s within a single block (see "Known
     Problems" above) would be a small, coherent follow-on to this session.
   - The remaining Types-section items (assignment compatibility, array elements, function-type
     compatibility) all fundamentally need a real expression type-inference helper, not just more
     literal-only special cases — consider scoping that inference helper as its own small unit
     before building more callers on top of it.
5. Other candidates: "Function return-type checking" (verify a `return <expr>`'s literal-shaped
   type against the function's declared, non-`void` return type), or the Reactivity subsection
   (e.g. "Reactive collection mutation validation").
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

**Task:** Duplicate declaration diagnostics (`TODO.md`, Semantic Checker → Scope/Names) — flag
name collisions in top-level declarations, struct fields, component params+members, and function
params, all of which previously silently overwrote in a `Map`/`Set` with no diagnostic.

**Result:** Done. Added a small generic `checkDuplicateNames()` helper used at all four call sites.
Component params and members are checked as one combined list so cross-kind collisions (a param
shadowing a state, etc.) are caught too, not just same-kind ones. Added four negative fixtures and
one positive regression fixture.

**Commit:** Not committed — working tree contains the focused diff described above.

**Tests:** `npx tsc --noEmit` (clean); `npm test` (145 PASS, 0 FAIL, exit 0).

**Next:** See "Recommended Next Step" above. Flagged that "Undefined-name diagnostics" may already
be substantially implemented (`checkExpr`'s `Identifier` case) and worth verifying before assuming
it's unstarted; also noted local-`VarDecl`-within-a-block duplicate checking as an unaddressed gap
in this session's own work.

---

### Previous session

**AI:** Claude

**Task:** Component prop type checking (`TODO.md`, Semantic Checker → Types) — compare
literal-shaped prop values passed to component elements against the target component's declared
param types, extending the existing prop *name* check (`Missing prop`/`Unknown prop`).

**Result:** Done. Added `checkAttributeTypeMatch()`, covering both plain string attributes
(`name="World"`) and expr attributes (`name={42}`); non-literal expr values (the common
`name={someVar}` case) are left unchecked, matching the checker's existing literal-shaped-only
limitation. Added two negative fixtures and one positive regression fixture, plus matching
`test-checker.js` cases.

**Commit:** Not committed at the time; pushed to `develop` by the maintainer as commit
`59ac055 feat: add component prop type checking`.

**Tests:** `npx tsc --noEmit` (clean); `npm test` (140 PASS, 0 FAIL, exit 0).

**Next:** See "Recommended Next Step" above — a real expression type-inference helper is needed
before the remaining Types-section TODO items (assignment compatibility, array elements,
function-type compatibility) can go beyond literal-only checking.

---

### Older session

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
