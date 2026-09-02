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
Just completed: semantic checker now validates function-call arguments (arity and, for
literal-shaped arguments, type) against the callee's declared parameters, for calls to functions
declared as members of the same component (see "Last Completed Work" below). Choose the next item
from `TODO.md` before beginning new work.

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

Semantic checker: "Function argument checking" (`TODO.md`, Semantic Checker → Types). Calls to a
function declared as a member of the *same* component now have their argument list checked against
the function's declared parameters:

1. **Arity** — the number of call arguments must match the number of declared parameters. A
   mismatch (too few or too many) is always reported, regardless of argument shape.
2. **Type (literal-shaped arguments only)** — for each argument that is a literal (or a `null`),
   its type is compared against the corresponding parameter's declared type, using the same
   `inferLiteralType`/`literalTypeMatches` machinery already used for `VarDecl`/`state`/`struct`-
   field initializers. A non-literal argument (a variable, a call, an arithmetic expression) is not
   type-checked, matching the checker's existing "literal-shaped only" limitation everywhere else
   type compatibility is checked (there is no general type inference yet).

### What changed

`checker.ts`:

- Added `checkCallArgs(fnDecl, args, where, line, diagnostics)`: reports an arity mismatch
  (`Function 'name' expects N argument(s) but received M`) or, per-argument, a `null`-into-non-
  nullable mismatch or a literal type mismatch (`Type mismatch: argument 'param' of function
  'name' expects 'T' but received a 'U' value`).
- `checkComponentDecl()` now builds a `functions: Map<string, AST.FunctionDecl>` from the
  component's own `FunctionDecl` members and threads it down through `checkExpr`, `checkStmts`,
  and `checkTemplateNode` (mirroring how `narrow`/`derivedNames` are already threaded) so that a
  `Call` anywhere — a statement, a nested expression, a template interpolation, an event-handler
  attribute, a style-block expression — can resolve the callee against the component's own
  functions.
- The `Call` case in `checkExpr` now looks up `functions.get(callee.name)` (only when the callee is
  a bare `Identifier`) and, if found, calls `checkCallArgs`.

This is intentionally scoped to same-component function calls: Crescent currently has no top-level
(non-member) function declarations (confirmed against `docs/Crescent_Grammar.md` §`FunctionDecl`),
and there is no method-call syntax (`obj.method(...)`) to resolve against another component's
members, so `Call.callee` being a bare local `Identifier` covers every case this check can
currently apply to.

Added three new fixtures under `compiler/scripts/fixtures/checker/`:

- `wrong-arg-count.crs` — negative, arity mismatch (`add(1)` where `add` takes 2 params).
- `wrong-arg-type.crs` — negative, literal type mismatch (`add(1, "two")`).
- `correct-call-ok.crs` — positive, a correctly-typed/arity call produces zero diagnostics.

Added matching cases/assertions to `compiler/scripts/test-checker.js`.

Did not touch `docs/Crescent_Design.md` or `docs/Crescent_Grammar.md`: this closes a semantic-
checker TODO item using syntax and semantics that are already fully documented (function
declarations, parameter types, call expressions) — no syntax or design changed, only what the
checker now verifies about already-legal programs.

### Files changed

- `compiler/src/checker.ts`
- `compiler/scripts/test-checker.js`
- `compiler/scripts/fixtures/checker/wrong-arg-count.crs` (new)
- `compiler/scripts/fixtures/checker/wrong-arg-type.crs` (new)
- `compiler/scripts/fixtures/checker/correct-call-ok.crs` (new)
- `TODO.md` (checked off "Function argument checking")
- `HANDOFF.md`

---

## Tests

### Last type-check and full suite

```text
npx tsc --noEmit
-> no errors

npm test
-> 137 PASS, 0 FAIL, exit code 0
(build, npm start over examples/, test-checker.js with the three new fixtures above plus all
prior checker cases, all other script tests, build-web, and test-web.js)
```

Note: `compiler/node_modules` was not present at the start of this session (fresh clone); ran
`npm install` in `compiler/` before `npx tsc --noEmit`/`npm test` would work. No `package.json`/
`package-lock.json` changes were made or are expected from this.

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
- No known type-name-existence gaps remain in the positions the checker currently visits
  (component params, struct fields, `inject<T>`, `VarDecl`, function return types, function param
  types, and statement/template `for`-loop item types are all now checked).
- Function-argument checking (this session) is intentionally scoped: only same-component calls to
  a bare-identifier callee are resolved against a known `FunctionDecl`; calls where the checker
  cannot otherwise resolve the callee (e.g. an expression callee) are silently skipped rather than
  flagged, since Crescent has no other call form yet. If component-to-component method-style calls
  or top-level functions are ever added, `checkCallArgs`'s call site in the `Call` case of
  `checkExpr` is where resolution would need to be extended.
- Argument type checking, like every other type-compatibility check in this file, only covers
  literal-shaped arguments (`inferLiteralType` returns `null`, and is silently skipped, for a
  variable, a call, or an arithmetic expression passed as an argument). This is a pre-existing
  limitation of the whole checker, not something new introduced this session — "Complete assignment
  compatibility" and general type inference remain open `TODO.md` items.

---

## Unfinished Work

_No active unfinished implementation. The function-argument-checking task above is complete and
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
   Order" (§16) — reasonable next candidates in the Types section are "Function return-type
   checking" (verify a `return <expr>`'s literal-shaped type against the function's declared,
   non-`void` return type — note this is distinct from the already-completed return-type
   *existence* check) or "Component prop type checking" (the existing `<Tag prop={...}>` check
   in `checkTemplateNode` only verifies prop *names*, via `Missing prop`/`Unknown prop`
   diagnostics; it does not yet compare a literal-shaped prop value against the component's
   declared param type, the same gap this session closed for function calls).
5. Keep diagnostics honest and source-backed: parser/module/codegen failures must remain distinct
   from semantic diagnostics, and incomplete checking must not be presented as full type safety.
6. Read the relevant design/grammar sections.
7. Inspect the existing implementation.
8. Implement the task.
9. Run tests.
10. Update this file.
11. Commit the completed unit if appropriate.

---

## Session Log

### Latest session

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
