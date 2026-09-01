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
Just completed: close a semantic-checker gap in generic-type-name resolution (see "Last Completed
Work" below). Choose the next item from `TODO.md` before beginning new work.

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

Semantic checker: validate the base name of a `GenericType` (e.g. `Response<User>`), and validate
a local `VarDecl`'s declared type for existence at all (it previously wasn't checked at all).

### What changed

`checker.ts`'s `typeIsResolvable()` previously only recursed into a `GenericType`'s type argument
and never checked whether the generic's own name (e.g. `Response` in `Response<User>`) resolved to
anything declared. Separately, `checkStmts()`'s `VarDecl` case never ran the declared type through
`typeIsResolvable()` at all, unlike component params, struct fields, and `inject<T>`, which already
did. Both gaps meant a local variable declared with a completely undefined type name (generic or
not) passed the checker silently.

`examples/structs_and_generics.crs` had been relying on exactly this hole: it declared
`Response<User> pending_response = fetch_pending();` even though no `Response` type is declared
anywhere in the project (Crescent also has no syntax for declaring a generic `struct`, i.e. no type
parameters on `StructDecl`, so `Response<User>` could never have resolved to anything real). Fixed
by changing the declaration to `User pending_response = ...`, matching `fetch_pending()`'s actual
return type.

Added a negative fixture (`unknown-generic-type.crs`) and a corresponding case in
`test-checker.js` to regression-test the new diagnostic.

Updated `docs/Crescent_Grammar.md` §9/§10: previously claimed generics were "resolved" partly on
the strength of "validated ... in the reference parser's test fixtures," which conflated
parsing with existence-checking. Now states plainly that the checker validates the generic name's
existence too (with the caveat that it can't check type-argument arity/validity, since generic
struct/component declarations don't exist in the language yet), and documents the new VarDecl gap
that's still open (function `ReturnType`s and `for`-loop `itemType`s are still unchecked).

### Files changed

- `compiler/src/checker.ts`
- `compiler/examples/structs_and_generics.crs`
- `compiler/scripts/test-checker.js`
- `compiler/scripts/fixtures/checker/unknown-generic-type.crs` (new)
- `docs/Crescent_Grammar.md`

---

## Tests

### Last type-check

```text
npx tsc --noEmit
-> no errors
```

### Last test suite

```text
npm test
-> 130 PASS, 0 FAIL, exit code 0
(includes: build, npm start over examples/, test-checker.js with the new
unknown-generic-type.crs case, all other script tests, build-web, and test-web.js)
```

### Last web test

```text
Included in the npm test run above (test-web.js) — all PASS.
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

- Function `ReturnType`s and `for`-loop `itemType`s are still never run through
  `typeIsResolvable()` — only component params, struct fields, `inject<T>`, and (as of this
  session) local `VarDecl`s are checked for type-name existence. A function declared with a
  bogus return type, or a `for` loop over a bogus item type, currently passes the checker
  silently. Reasonable next small unit of work.
- Function (not component) parameter types are also never validated for existence (e.g. a
  handler declared as `void handle_key(KeyboardEvent e)` never confirms `KeyboardEvent` resolves
  to anything). Not yet reflected in `docs/Crescent_Grammar.md`.

---

## Unfinished Work

_No active unfinished implementation. The generic-type-resolution task above is complete and
tested. See "Known Problems > Other" for closely related follow-up gaps (function return types,
for-loop item types, function param types) that were deliberately left out of this unit._

---

## Recommended Next Step

1. Read `TODO.md`.
2. Consider extending type-existence checking (`typeIsResolvable`) to function `ReturnType`s and
   `for`-loop `itemType`s, following the same pattern used for `VarDecl` in this session — likely
   the smallest next coherent unit in the same area.
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

**Task:** Strengthen the semantic checker's generic-type resolution (`Response<User>`-style types)
and close the related gap where local `VarDecl` types were never checked for existence at all.

**Result:** Done. `typeIsResolvable()` now checks a `GenericType`'s own name, not just its type
argument. `VarDecl` statements now run their declared type through the same check as component
params/struct fields/`inject<T>`. Fixed `structs_and_generics.crs`, which had been relying on the
old hole (`Response<User>` was never a declared type). Added a negative fixture + test case.
Updated `docs/Crescent_Grammar.md` §9/§10 accordingly.

**Commit:** Not committed — working tree left with the uncommitted diff described above; no patch
file was requested.

**Tests:** `npx tsc --noEmit` (clean); `npm test` (130 PASS, 0 FAIL, exit 0), including the new
`unknown-generic-type.crs` case and the full jsdom + real-browser (`test-web.js`) suites.

**Next:** Extend the same `typeIsResolvable()` check to function `ReturnType`s and `for`-loop
`itemType`s (see "Recommended Next Step").

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
