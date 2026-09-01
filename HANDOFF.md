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
Just completed: extend declared-type existence checking to function return types and `for` loop
item types (see "Last Completed Work" below). Choose the next item from `TODO.md` before beginning
new work.

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

Semantic checker: validate declared type names in non-`void` function return types and in both
statement and template `for` loop item types.

### What changed

`checker.ts` now applies the existing `typeIsResolvable()` rule to every non-`void`
`FunctionDecl.returnType`, regular-statement `For.itemType`, and view `TemplateFor.itemType`.
This includes generic base-name resolution. It reports context-specific diagnostics while continuing
to collect other errors in the file.

Added `unknown-return-and-for-types.crs`, a negative fixture that contains one unresolved generic
function return type plus unresolved statement and template loop item types. The checker regression
test asserts all three diagnostics.

Updated `docs/Crescent_Grammar.md` §10 to reflect the newly checked positions and record the
remaining function-parameter gap.

### Files changed

- `compiler/src/checker.ts`
- `compiler/scripts/test-checker.js`
- `compiler/scripts/fixtures/checker/unknown-return-and-for-types.crs` (new)
- `docs/Crescent_Grammar.md`
- `HANDOFF.md`

---

## Tests

### Last type-check and focused regression test

```text
npm run build && node scripts/test-checker.js
-> no errors; all checker regressions pass, including the three new cases
```

### Last test suite

```text
npm test
-> compiler, checker, runtime, DOM, module, and keyed-list tests passed through the final
   bundle step, but esbuild failed because the sandbox denied a resolved directory read.
   This is an environment restriction, not a test assertion failure.
```

### Last web test

```text
node scripts/build-web.js && node scripts/test-web.js (with required elevated sandbox access)
-> bundle written successfully; all browser smoke tests PASS
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

- Function (not component) parameter types are still not validated for existence (e.g. a
  handler declared as `void handle_key(KeyboardEvent e)` never confirms `KeyboardEvent` resolves
  to anything). This is the smallest remaining type-name-resolution gap.

---

## Unfinished Work

_No active unfinished implementation. The return/loop type-resolution task above is complete and
tested. See "Known Problems > Other" for the closely related function-parameter gap._

---

## Recommended Next Step

1. Read `TODO.md`.
2. Consider extending type-existence checking (`typeIsResolvable`) to function parameter types,
   following the existing component-parameter pattern — likely the smallest next coherent unit in
   the same area.
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

**AI:** Codex

**Task:** Extend declared type-name resolution to non-`void` function return types and statement/
template `for` loop item types.

**Result:** Done. The checker now reports unresolved return and loop item types in all relevant AST
positions. Added one fixture and three regression assertions. Grammar documentation updated.

**Commit:** Not committed — working tree contains the focused diff described above.

**Tests:** `npm run build && node scripts/test-checker.js` (clean/all PASS); `npm test` passed all
steps before the sandbox blocked its final esbuild directory read; `node scripts/build-web.js &&
node scripts/test-web.js` rerun with elevated sandbox access (all PASS).

**Next:** Extend the same `typeIsResolvable()` check to function parameter types, or choose another
small TODO item.

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
