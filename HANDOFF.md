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
Just completed: a real `crescent` CLI (`crescent check [path]`, `crescent build [path] --out-dir
<dir>`) backed by new reusable `checkProject()`/`buildProject()` APIs extracted from
`src/index.ts` — see "Last Completed Work" below. This was the maintainer's explicit next step
(CLI first, then VS Code support, then playground, then broader language features like enum/
match). Choose the next item from `TODO.md` before beginning new work — the maintainer's stated
plan is VS Code support next.

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

CLI (`TODO.md` §8 "End-to-End Compiler" CLI items, §10 CLI, and the "Near-Term VS Code
Enablement" plan's first two bullets). Per the maintainer's stated order (CLI now, VS Code
support / playground / project-testing later, language features like enum/match after that),
this session built a real `crescent check` / `crescent build` command that works on **any**
directory of `.crs` files, not just the hard-coded `examples/` directory `src/index.ts` used to
run against.

1. **Extracted reusable project APIs** — new `compiler/src/project.ts`:
   - `checkProject(root)`: loads every `.crs` file under `root`, resolves `use` imports, detects
     import cycles, then runs `checkFile()` on every file. Returns `{ ok, fatal, files,
     importsByFile, diagnosticsByFile }`. Unlike the old `index.ts`, a `LexError`/`ParseError`
     thrown by `loadAllPrograms()` (previously an uncaught crash) is now caught and reported as
     `fatal: { stage: 'parse', message }`, matching how `ModuleError` (import cycle / missing
     module) was already turned into `fatal: { stage: 'module', message }`. This does not change
     any language semantics — it only means a syntax error in an arbitrary user project produces
     a clean CLI error instead of a raw stack trace, which matters once the CLI runs on projects
     the AI/compiler didn't author.
   - `buildProject(root, outDir)`: runs `checkProject()`, then for every file with zero semantic
     errors, generates JS into `<outDir>/gen/<relPath>.js` (mirroring the source tree, same as
     before) and copies the compiler's own compiled `runtime.js` to `<outDir>/runtime.js` (skipped
     if source and destination are already the same file — this matters for `src/index.ts`'s own
     use, see below). This makes a build's `<outDir>` fully self-contained: previously the
     generated `require('../runtime')` path only resolved correctly because `examples/` builds
     always happened to land in `dist/gen` next to a `dist/runtime.js` that `tsc` produced as a
     side effect of compiling the compiler itself; an arbitrary external `--out-dir` has no such
     side effect, so the runtime now travels with the build output.
   - Per-file build results (`FileBuildResult`) distinguish `outFile` (success), `skippedReason`
     (semantic errors, or an expected `CodegenError` — unsupported feature), and
     `unexpectedError` (anything else, e.g. a compiler bug) — preserving the existing three-way
     distinction between semantic errors / unsupported codegen / a genuine crash that `AGENTS.md`
     §10 requires, now expressed as data instead of only as console output.

2. **`src/index.ts` rewritten on top of `project.ts`** — same console output format and same
   `dist/gen` output location as before (verified byte-for-byte via `npm test`'s generated-output
   assertions), just calling `buildProject(examplesDir, distDir)` instead of duplicating the
   load/resolve/cycle-detect/codegen loop inline. `distDir` here is `dist` itself (not `dist/gen`)
   since `buildProject` now owns the `gen/` subfolder naming; `runtime.js` copy is skipped in this
   path because `dist/runtime.js` is already produced directly by `tsc` compiling
   `src/runtime.ts`, so source and destination resolve to the same file.

3. **New `src/cli.ts`** — the actual `crescent` command:
   - `crescent check [path]` — prints one line per diagnostic as
     `relPath:line [severity] where: message` (line omitted if `<= 0`), then a summary line, exit
     code 1 if any error (including a fatal parse/module error).
   - `crescent build [path] --out-dir <dir>` — same check output, then one line per file:
     `Codegen OK — wrote <path>`, `<relPath>: codegen skipped: <reason>`, or
     `FAILED: <relPath>: <message>` for an unexpected error. `--out-dir` is required; missing it
     is a usage error (exit 1) rather than silently defaulting somewhere.
   - No args / unknown command prints usage (exit 0 for no args, 1 for an unrecognized command).
   - `path` defaults to `.` (current directory) when omitted.
   - Has a `#!/usr/bin/env node` shebang; verified `tsc` preserves shebang lines in its output
     (compiled `dist/cli.js` starts with the shebang, confirmed by hand).

4. **`package.json`**: added `"bin": { "crescent": "dist/cli.js" }` (so `npm link` exposes a real
   `crescent` command once built) and a `"cli": "ts-node src/cli.ts"` script for running the CLI
   directly against source during development, without a prior `tsc` build.

5. **`compiler/README.md`**: added a "CLI" section under "Running" documenting both commands, the
   `<out-dir>/gen/` + `<out-dir>/runtime.js` output layout, and the `bin`/`npm run cli` entries.
   Also fixed two pre-existing doc/implementation mismatches while in the file (per the maintainer's
   follow-up request to clean up docs alongside this patch — verified against actual behavior, not
   guessed):
   - "Running" said `npm start` "prints their ASTs as JSON" — it does not and never has in this
     session's testing; it prints `Parsed OK — N top-level declaration(s)` plus semantic-check
     results. Corrected to describe what actually happens.
   - The "Semantic Checker" section's "What it checks" bullet list predated two later sessions'
     work and didn't mention **duplicate-declaration diagnostics** (`checkDuplicateNames()`) or
     **function-call-argument checking** (`checkCallArgs()`), even though both exist in
     `checker.ts` and are checked off `[x]` in `TODO.md`. Added bullets for both. This is exactly
     the "Documentation consistency" issue flagged under "Known Problems" below, scoped to what I
     could verify by reading `checker.ts` directly rather than guessing.
   Did not touch the compiler README's title ("Lexer/Parser/Codegen Scaffold (v0.1)") — terse but
   not factually wrong — nor `docs/Crescent_Design.md`/`docs/Crescent_Grammar.md`: checked their
   section numbering against every `§N.N` cross-reference in `compiler/README.md` (all resolve
   correctly) and scanned both for duplicated-word typos/placeholder markers (`TODO`, `TBD`,
   `XXX`, `not implemented`) — found none. No changes needed there.

6. **`TODO.md`**: checked off the CLI-related boxes this closes (§8 "Improve CLI" through "Add
   clear exit codes"; §10 "Friendly `crescent` command", "`crescent check`", "`crescent build`";
   the VS Code-enablement plan's "Extract reusable project APIs" and "Make `crescent check
   <path>`/`crescent build ...` work on arbitrary projects" bullets — marked the "machine-readable
   diagnostics" bullet `[~]` since file+line+severity+message exist but column and stable error
   codes do not yet).

### Manual verification (beyond the automated suite)

Built a throwaway project under `/tmp` (not committed, already deleted) and ran the compiled
`dist/cli.js` by hand to confirm real-world behavior beyond what `npm test` exercises (which only
runs the `examples/`-driven `index.ts`, not `cli.ts`, directly):

- `crescent check <dir>` on a single valid file → `OK — 1 file(s) checked, no problems found.`,
  exit 0.
- `crescent build <dir> --out-dir <outdir>` on the same → same OK line, then
  `Codegen OK — wrote <outdir>/gen/main.js`, and `<outdir>/runtime.js` + `<outdir>/gen/main.js`
  both present on disk, exit 0.
- `crescent check <dir>` on a file with a real semantic error (`state<int> count = "not a
  number";`) → `main.crs:2 [error] component 'Broken', 'count': Type mismatch: ...`, exit 1.
- `crescent check <dir>` on a file with a genuine parse error (unterminated `view {` block) →
  `error: Expected token SEMI but got VIEW ('view') at line 3`, exit 1 (previously this would have
  been an uncaught `ParseError` crashing the process with a raw stack trace).
- `crescent build <dir>` with no `--out-dir` → `error: crescent build requires --out-dir <dir>`,
  exit 1.
- `crescent` with no arguments → usage text, exit 0.

No automated test currently exercises `cli.ts` itself (it's a thin argv-parsing/printing wrapper
around `project.ts`, which the existing test suite exercises indirectly through
`src/index.ts`/`npm test`). Adding a small script-based smoke test for `cli.ts` directly (e.g.
under `compiler/scripts/`, following the existing `test-*.js` convention) would be a reasonable
follow-up — see "Recommended Next Step".

### Files changed

- `compiler/src/project.ts` (new) — `checkProject()`, `buildProject()`.
- `compiler/src/cli.ts` (new) — the `crescent` command.
- `compiler/src/index.ts` (rewritten to use `project.ts`; same observable behavior/output).
- `compiler/package.json` (`bin` field, `cli` script).
- `compiler/package-lock.json` (regenerated by `npm install` after the `bin` field was added; the
  only diff is that field being mirrored into the lockfile's root-package entry).
- `compiler/README.md` (new "CLI" section).
- `TODO.md` (checked off the CLI items listed above).
- `HANDOFF.md`.

---

## Tests

### Last type-check and full suite

```text
npx tsc --noEmit
-> no errors

npm test
-> 145 PASS, 0 FAIL, exit code 0
(build, npm start over examples/ via the rewritten index.ts/project.ts, test-checker.js and all
prior fixtures, all other script tests, build-web, and test-web.js — identical pass count and
generated-output locations to before this session, confirming index.ts's behavior is unchanged)
```

Additionally, `dist/cli.js` was exercised by hand against throwaway `/tmp` projects — see "Manual
verification" above. This is not part of `npm test`.

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

Resolved this session: `compiler/README.md`'s "Running" section and "Semantic Checker" → "What it
checks" list were out of sync with the implementation (see "Last Completed Work" above for the
specific fixes). Re-check this periodically as the checker grows — it's easy for a new check to
land in `checker.ts` without a matching README bullet.

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

_No active unfinished implementation. The CLI task above (`checkProject`/`buildProject` +
`crescent check`/`crescent build`) is complete and tested. `crescent run`/development mode and a
config file (`TODO.md` §10 CLI) remain unstarted — deliberately out of scope for this session per
the maintainer's stated plan (CLI → VS Code support → playground → project testing → language
features), which was scoped as "the CLI" rather than every CLI subcommand ever planned._

---

## Recommended Next Step

1. Read `TODO.md`.
2. **The maintainer's explicit stated order is: CLI (done this session) → VS Code support →
   playground → then real project testing → then broader language features (enum, match, etc).**
   The natural next unit is VS Code support, per `TODO.md`'s "Near-Term VS Code Enablement (v0.x)":
   - The reusable `checkProject()`/`buildProject()` APIs and the `crescent check`/`crescent build`
     commands this session added are the foundation that section's remaining bullets build on.
   - Next bullets there: a minimal VS Code extension (`.crs` file association, TextMate syntax
     highlighting, comment/bracket/indent configuration, `Crescent: Check` / `Crescent: Build`
     commands), publishing parser/module/semantic/codegen diagnostics on save (and later on
     document changes), and a `Crescent: Preview` command that builds and opens/reloads the
     browser output (likely reusing `build:web`-style bundling, but pointed at a real project's
     build output rather than `examples/`).
   - `crescent check`/`crescent build` are currently process-based (spawn `dist/cli.js`, parse its
     stdout/exit code); the plan explicitly defers replacing that with a real LSP server until the
     extension and diagnostic model have stabilized — don't jump straight to an LSP.
3. A worthwhile small addition first: a script-based smoke test for `cli.ts` itself (see "Manual
   verification" above — currently only verified by hand). Following the existing
   `compiler/scripts/test-*.js` convention, spawn `node dist/cli.js check/build <fixture-dir>
   --out-dir <tmp>` via `child_process` and assert on stdout/exit code for a valid project, a
   semantic-error project, and a parse-error project. This would need to be wired into the `test`
   script in `package.json` and should probably use a temp directory (e.g. under `os.tmpdir()`)
   rather than adding new fixtures under version control, since it's exercising the CLI's
   filesystem I/O, not checker behavior.
4. If VS Code work is deferred, the semantic checker (`TODO.md` §16 "Current Priority Order") is
   the other standing priority:
   - **"Undefined-name diagnostics"** (Scope/Names) is worth checking against the current
     implementation before assuming it's unstarted — `checkExpr`'s `Identifier` case already
     reports `Undefined identifier 'name'` for unresolved identifiers in expressions, and
     `OnChangeDecl` separately checks its watched names. It's plausible this TODO item is already
     substantially done and mostly needs verification/regression tests rather than new code.
   - Extending duplicate-declaration checking to local `VarDecl`s within a single block (see "Known
     Problems" below) would be a small, coherent follow-on.
   - The remaining Types-section items (assignment compatibility, array elements, function-type
     compatibility) all fundamentally need a real expression type-inference helper — consider
     scoping that inference helper as its own small unit before building more callers on top of it.
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

**Task:** Build the `crescent` CLI (`TODO.md` §8/§10, "Near-Term VS Code Enablement" plan's first
two bullets) — the maintainer's explicit next step before VS Code support, a playground, and
broader language features (enum, match, etc).

**Result:** Done. Extracted `checkProject(root)` / `buildProject(root, outDir)` into new
`src/project.ts` from the logic previously inlined in `src/index.ts`. Added `src/cli.ts`
implementing `crescent check [path]` and `crescent build [path] --out-dir <dir>`, with per-file
`file:line [severity] where: message` diagnostics, clear exit codes (0 clean, 1 on any error or
usage mistake), and a self-contained build output (`<out-dir>/gen/*.js` + `<out-dir>/runtime.js`).
Rewrote `src/index.ts` to call `buildProject()` instead of duplicating the load/check/codegen
loop; verified identical console output and `dist/gen` file locations via `npm test`. Added a
`bin` entry and `cli` npm script to `package.json`, and a "CLI" section to `compiler/README.md`.
Manually exercised the compiled `dist/cli.js` against throwaway `/tmp` projects covering the
clean/semantic-error/parse-error/missing-flag/no-args cases (see "Manual verification" above) —
no automated test yet exercises `cli.ts` directly, only `index.ts`/`project.ts` via `npm test`.

**Commit:** Not committed — working tree contains the diff described above (new
`compiler/src/project.ts`, `compiler/src/cli.ts`; modified `compiler/src/index.ts`,
`compiler/package.json`, `compiler/package-lock.json` (bin field sync only), `compiler/README.md`,
`TODO.md`, `HANDOFF.md`).

**Tests:** `npx tsc --noEmit` (clean); `npm test` (145 PASS, 0 FAIL, exit 0 — same count as
before this session). `dist/cli.js` manually exercised against `/tmp` fixtures (not part of
`npm test`; see "Manual verification" and "Recommended Next Step" #3 for adding this as a real
script-based test).

**Next:** VS Code support is the maintainer's explicitly stated next phase — see "Recommended
Next Step" above for the specific `TODO.md` bullets that build on this session's APIs/commands. A
`cli.ts` smoke test (script-based, following the `compiler/scripts/test-*.js` convention) would
also be a good small unit if VS Code work isn't picked up immediately.

---

### Previous session

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

### Older session

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
