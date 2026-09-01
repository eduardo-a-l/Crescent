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
Just completed: extend declared-type existence checking to function parameter types, and fix a
pre-existing bug where the design doc's `void()` callback-param syntax was already failing this
same class of check on component params (see "Last Completed Work" below). Choose the next item
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

Semantic checker: validate declared type names on function parameters — the last unchecked
declared-type position identified in the prior sessions. Also fixed a pre-existing bug this
surfaced: the design doc's `void()` callback-parameter syntax was already silently broken by the
same class of check on *component* params, before this session touched anything.

### What changed

`checker.ts`'s `FunctionDecl` case in `checkComponentDecl()` now loops over `m.params` and runs
each param's declared type through `typeIsResolvable()`, exactly like component params already do.

While verifying this against the design doc's own example (§6, `component CustomButton(string
label, void() action)`), confirmed against the actual build that `typeIsResolvable()` already threw
`Unknown type 'void()' referenced by param 'action'` for that component *before* this session's
change — a genuine pre-existing bug, not something introduced by extending the check to function
params. Root cause: `parser.ts`'s `parseParam()` represents a `void()` callback-typed parameter as
a special-cased `NamedType { name: 'void()' }` rather than a real function-type AST node, and
`typeIsResolvable()`'s `NamedType` case did a plain `scope.has(type.name)` lookup, which a marker
string like `'void()'` can never satisfy. Fixed by special-casing that exact marker in
`typeIsResolvable()` to always resolve, since it isn't a user type name to look up.

While adding a positive fixture to confirm the fix, also checked the design doc's other documented
parameter-typing example (§13.3, `void handle_key(KeyboardEvent e)`) against the same code path and
found the identical class of bug: `MouseEvent`/`KeyboardEvent`/`FormEvent` are documented as valid
param types but are never declared anywhere as a `struct`/`component`, so extending existence
checking to function params would have flagged them too. Fixed the same way component params
already handle plain identifier globals (`BUILTIN_GLOBALS`) by adding an analogous
`BUILTIN_EVENT_TYPES` set (`MouseEvent`, `KeyboardEvent`, `FormEvent`) to `typeIsResolvable()`.

Added `compiler/examples/callback_param.crs` (mirrors §6's `CustomButton`/click-handler snippet)
and `compiler/examples/typed_event_handler.crs` (mirrors §13.3's `handle_key(KeyboardEvent e)`
snippet) — both parse, semantic-check cleanly, and code-generate correctly (verified generated JS
and diagnostics by hand for both). These are the first real examples exercising either syntax.
Added `unknown-function-param-type.crs`, a negative fixture (using an actually-undeclared type
name, not one of the two builtin categories above) for the new function-param check, plus a
matching case in `test-checker.js`.

Updated `docs/Crescent_Grammar.md` §10: closed out the function-param-type item, and added two new
entries documenting the `void()` marker and the `BUILTIN_EVENT_TYPES` set as narrow, ungeneralized
special cases (no grammar production for function types or built-in event types exists yet).

### Files changed

- `compiler/src/checker.ts`
- `compiler/scripts/test-checker.js`
- `compiler/scripts/fixtures/checker/unknown-function-param-type.crs` (new)
- `compiler/examples/callback_param.crs` (new)
- `compiler/examples/typed_event_handler.crs` (new)
- `docs/Crescent_Grammar.md`
- `HANDOFF.md`

---

## Tests

### Last type-check and full suite

```text
npx tsc --noEmit
-> no errors

npm test
-> 134 PASS, 0 FAIL, exit code 0
(build, npm start over examples/ including the new callback_param.crs and
typed_event_handler.crs, test-checker.js with the new unknown-function-param-type.crs
case, all other script tests, build-web, and test-web.js)
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
- No other known type-name-existence gaps remain in the positions the checker currently visits
  (component params, struct fields, `inject<T>`, `VarDecl`, function return types, function param
  types, and statement/template `for`-loop item types are all now checked). The two builtin-type
  special cases added this session (`void()` callback params, `BUILTIN_EVENT_TYPES`) are the only
  named exceptions, and both are now backed by working examples.

---

## Unfinished Work

_No active unfinished implementation. The function-param-type task above, and the two pre-existing
bugs it surfaced (`void()` and DOM event types), are complete and tested._

---

## Recommended Next Step

1. Read `TODO.md`.
2. No further type-name-existence gaps are known in the checker at this point (see "Known
   Problems > Other"). Consider moving to the next `TODO.md` priority area instead — e.g.
   strengthening component-argument/return-type *compatibility* checking (not just existence),
   or the README self-contradiction fix that's been deferred across several sessions.
3. Otherwise, select a different small, coherent task from `TODO.md`.
4. Read the relevant design/grammar sections.
5. Inspect the existing implementation.
6. Implement the task.
7. Run tests.
8. Update this file.
9. Commit the completed unit if appropriate.

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
