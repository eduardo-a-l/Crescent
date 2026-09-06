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
Just completed: in-editor diagnostics for the VS Code extension (`editors/vscode/`) — `crescent
check`'s underlying `checkProject()` is now called in-process on save/open and published as real
`vscode.Diagnostic`s, plus a small compiler-side improvement (fatal parse/lex errors now carry the
file that failed). See "Last Completed Work" below. Choose the next item from `TODO.md` before
beginning new work — the maintainer's stated plan is a playground next, then real project
testing, then broader language features (enum, match, etc). Continuous/on-change diagnostics,
`Crescent: Preview`, and the LSP replacement (`TODO.md` §10) are also still open if the maintainer
wants more VS Code work first.

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

In-editor diagnostics for the VS Code extension (`TODO.md` §10 "Near-Term VS Code Enablement",
the "Publish parser, module, and semantic-checker diagnostics ... on save" bullet — the
maintainer's stated next step after last session's minimal extension). Two parts:

**1. A small, targeted compiler-side fix, done first because the diagnostics feature needed it:**
`FatalDiagnostic` (`project.ts`) previously had no way to say *which file* a parse/lex error came
from — `loadAllPrograms()` (`modules.ts`) threw `LexError`/`ParseError` straight out of its
directory-walk loop with no chance to attach the file first, so `checkProject()`'s `fatal` result
carried only a message string. Fixed by:
- Adding an optional `file?: string` field to both `LexError` (`lexer.ts`) and `ParseError`
  (`parser.ts`) — set by the *caller*, not the lexer/parser themselves, since neither has any
  notion of which file on disk it's scanning.
- `loadAllPrograms()` now wraps its `parseCrescent(source)` call in a `try`/`catch` per file,
  attaching `relPath` to a caught `LexError`/`ParseError` before rethrowing it.
- `FatalDiagnostic` gained a `file: string | null` field; `checkProject()` populates it from the
  caught error's `.file` for the `'parse'` stage. Left `null` for the `'module'` stage
  (`ModuleError`) deliberately — an import cycle or a missing `use`-d export inherently involves
  *at least two* files, and the thrown message already names both (e.g. "... in 'lib.crs'
  (imported from 'main.crs')"), so picking one to call "the" file would be a guess, not a fact.
  This follows `AGENTS.md`'s "identify the disagreement, don't silently choose" principle — it was
  flagged as an open question in this file's own "Recommended Next Step" last session rather than
  silently resolved either way.
- `cli.ts`'s `reportCheck()`/`reportBuild()` and `index.ts`'s fatal-error branch both now print
  `<file>: <message>` instead of a bare `error: <message>` when a file is known.
- This is not a language-semantics change — it only affects which file a syntax error is
  *attributed to* for tooling purposes, exactly the kind of deviation from strict fail-fast
  behavior last session's `checkProject()` already established a precedent for.

**2. The actual diagnostics feature, in `editors/vscode/src/extension.js`:**
- Refactored the existing `findCliPath()` to share a new `findDistDir()` helper (walks up from the
  project root looking for `compiler/dist/cli.js`, same logic as before, now reusable) and added
  `findProjectModulePath()`, which resolves to `compiler/dist/project.js` — either next to a
  configured `crescent.cliPath` that ends in `.js`, or via the auto-detected `findDistDir()`. A
  bare-command `crescent.cliPath` (e.g. `crescent` after `npm link`) gives diagnostics no
  directory to find `project.js` next to, so that case falls back to a clear "couldn't load the
  compiler" message in the output channel rather than guessing a location — **Check**/**Build**
  still work fine with a bare command, since those only need to spawn it, not `require()` it.
- Added `loadProjectModule()` — `require()`s the compiled `project.js` **in-process** (not
  spawning the CLI and parsing its text output — keeps the mapping to `vscode.Diagnostic` exact).
  Node's module cache means a mid-session compiler rebuild needs an Extension Development Host
  reload to pick up — documented as an acceptable, narrow dev-loop wrinkle, not something to
  engineer around (e.g. with cache-busting) for how rarely it'd matter.
- Added a `vscode.DiagnosticCollection` (`'crescent'`), created and disposed alongside the existing
  output channel. `refreshDiagnostics(root)` calls `checkProject(root)` and republishes the
  **entire** collection from its result every time — correct, since a diagnostic like a duplicate
  declaration or an undefined name can depend on another file via `use` imports, so re-checking
  only the saved file wouldn't be enough. Documented trade-off: in a multi-root workspace, saving
  in one project's folder clears diagnostics for a *different* open project until that one is
  itself saved/opened again — there's no per-root partitioning yet.
- `wholeLineRange()` maps `checker.ts`'s 1-based `Diagnostic.line` (no column — nothing more
  precise to underline) to a 0-based `vscode.Range` spanning the whole line.
- A `fatal` result with a `file` becomes a single-line diagnostic on that file; a `fatal` without
  one (a `ModuleError`) becomes a `showErrorMessage` popup instead of a guessed-file diagnostic —
  directly exercising the compiler-side fix above.
- Wired to `vscode.workspace.onDidSaveTextDocument` and `onDidOpenTextDocument` (both filtered to
  `document.languageId === 'crescent'`), plus a one-time pass over `vscode.workspace.textDocuments`
  during `activate()` so a `.crs` file that's already open when the extension starts doesn't sit
  there looking clean until the user happens to save it. Deliberately **not** wired to
  `onDidChangeTextDocument` (continuous checking) — that's its own separate, still-open `TODO.md`
  bullet, per `AGENTS.md` §15's "don't begin a second major feature" in one session.
- `getProjectRootForDocument()`: the saved/opened document's workspace folder, or (if there isn't
  one — e.g. a single file opened without a folder) the file's own directory, treated as the
  project root. A documented, reasonable fallback, not a silent gap.
- `editors/vscode/README.md`: added a "Diagnostics" section covering all of the above (in-process
  vs. process-based, whole-project re-check semantics and the multi-root trade-off, whole-line-only
  underlines, file-attributed vs. popup fatal errors, on-disk-not-buffer staleness, and the
  dev-loop module-cache note), updated the intro bullet list and version to `0.2.0`, and replaced
  the "press F5" instruction (which didn't actually work without a `launch.json`) with a reference
  to the root `.vscode/launch.json` the maintainer committed between sessions.
- `TODO.md`: checked off the diagnostics-on-save/open bullet under §10 with a pointer to what it
  covers; split out "on document changes too" as its own still-open bullet rather than leaving it
  bundled with (and looking like it blocks) the now-done save/open work; expanded the
  machine-readable-diagnostics note to mention `FatalDiagnostic.file`.

### Manual verification

Still no automated test suite covers a VS Code extension (see "Known Problems"/"Recommended Next
Step" — unchanged from last session). Verified by hand, extending last session's mock-`vscode`
approach with a `DiagnosticCollection`/`Diagnostic`/`Range`/`Uri` mock:

- **Compiler-side fix**: rebuilt (`npm run build`), then ran `node dist/cli.js check <dir>` against
  a throwaway project with an unterminated `view {` block — output changed from a bare
  `error: Expected a template node...` to `broken.crs: Expected a template node...`, confirming the
  file is now attached and printed.
- **Diagnostics, semantic error**: mocked `vscode`, pointed `crescent.cliPath` at the real built
  `compiler/dist/cli.js`, opened a throwaway file with a real type-mismatch error (`state<int>
  count = "not a number";`) via the activation-time `textDocuments` pass — the mock's
  `DiagnosticCollection.set()` was called with the correct file URI, `severity=0` (Error),
  `line=1` (0-based, i.e. source line 2 — correct), and the exact expected message.
- **Diagnostics, clean project**: same setup against the real `compiler/examples/` (auto-detected
  `compiler/dist`, no `crescent.cliPath` override) — zero diagnostic entries set, confirming a
  clean project doesn't spuriously flag anything and the auto-detect path works end-to-end, not
  just the explicit-path one.
- **Diagnostics, fatal parse error with file attribution**: same setup against a throwaway project
  with an unterminated `view {` block — a single diagnostic set on the correct file
  (`broken.crs`), `severity=0`, with the parser's exact message — confirming the new
  `FatalDiagnostic.file` threads all the way through to a real `vscode.Diagnostic`, not just the
  CLI's text output.
- `node --check editors/vscode/src/extension.js` — no syntax errors.
- Full compiler regression: `npx tsc --noEmit` and `npm test` (145 PASS) after the `lexer.ts`/
  `parser.ts`/`modules.ts`/`project.ts`/`cli.ts`/`index.ts` changes — unchanged pass count,
  confirming the fatal-error-attribution change didn't alter any other observable behavior.

### Files changed

- `compiler/src/lexer.ts` (`LexError.file?`)
- `compiler/src/parser.ts` (`ParseError.file?`)
- `compiler/src/modules.ts` (`loadAllPrograms()` attaches `file` before rethrowing)
- `compiler/src/project.ts` (`FatalDiagnostic.file`)
- `compiler/src/cli.ts` (prints `file:` prefix when known)
- `compiler/src/index.ts` (same, for the `examples/`-driven runner)
- `editors/vscode/src/extension.js` (diagnostics collection, in-process `checkProject()` calls,
  `findDistDir()`/`findProjectModulePath()`, save/open listeners)
- `editors/vscode/README.md` ("Diagnostics" section, updated intro/version/dev instructions)
- `editors/vscode/package.json` (version bump to `0.2.0`)
- `TODO.md` (checked off the diagnostics bullet; split out "on document changes" as its own item)
- `HANDOFF.md`

---

## Tests

### Last type-check and full suite

```text
cd compiler && npx tsc --noEmit
-> no errors

cd compiler && npm test
-> 145 PASS, 0 FAIL, exit code 0 (unchanged count — the lexer.ts/parser.ts/modules.ts/project.ts/
cli.ts/index.ts changes this session are additive (an optional field, a try/catch that only
changes what's attached to an already-thrown error) and don't alter any check's pass/fail outcome)
```

No automated suite exercises `editors/vscode/` — see "Manual verification" above for what was
checked by hand instead (now covering diagnostics too, not just Check/Build), and "Recommended
Next Step" for a real, committed test harness as a worthwhile follow-up.

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

_No active unfinished implementation. This session's diagnostics task (compiler-side fatal-file
attribution + the VS Code extension's on-save/on-open `DiagnosticCollection`) is complete and
manually verified — see "Last Completed Work" above. Continuous/on-change diagnostics,
`Crescent: Preview`, and the LSP replacement (`TODO.md` §10) remain unstarted — deliberately out
of scope this session per `AGENTS.md` §15 ("do not begin a second major feature")._

---

## Recommended Next Step

1. Read `TODO.md`.
2. **The maintainer's stated order was: CLI → VS Code support → playground → real project testing
   → broader language features (enum, match, etc).** CLI, a first VS Code extension, and
   in-editor diagnostics are all done now (see "Last Completed Work" above and the session log
   below). Remaining unstarted bullets in `TODO.md`'s "Near-Term VS Code Enablement (v0.x)":
   - **Diagnostics on document changes** (continuous/incremental checking), not just save/open.
     Would need debouncing (don't re-run `checkProject()` on every keystroke) and, since
     `checkProject()` currently only reads from disk, either writing changed buffers to a temp
     location before checking or teaching `loadAllPrograms()`/`checkProject()` to accept in-memory
     file contents for the currently-edited document(s) — the latter is more invasive and was
     explicitly *not* attempted this session (see "Last Completed Work"'s in-process `project.js`
     approach, which still shells out to disk).
   - **`Crescent: Preview`** — build + open/reload `build:web`-style bundled output, pointed at a
     real project rather than `compiler/examples/`.
   - **LSP replacement** — the plan's own note is to defer this until the diagnostic model has
     stabilized; two sessions of hand-verified diagnostics is a reasonable point to start
     considering it, but there's no urgency while the extension's current process/in-process-
     `require()` approach still works.
   - **Multi-root workspace diagnostic partitioning** (see `editors/vscode/README.md`'s
     "Diagnostics" section) — currently, saving in one project's folder clears diagnostics for a
     different open project until it's re-saved. Scope the `DiagnosticCollection` per project root
     (e.g. key entries by root, or run `checkProject()` for every currently-open root on each save)
     rather than doing one global clear-and-repopulate.
3. A worthwhile small addition, independent of the above: a real, committed test harness for
   `editors/vscode/` and/or `cli.ts` (both still only verified by hand across two sessions now —
   see "Manual verification" in "Last Completed Work" above). Options, roughly in order of effort:
   - A script-based smoke test for `cli.ts` itself, following the existing
     `compiler/scripts/test-*.js` convention: spawn `node dist/cli.js check/build <fixture-dir>
     --out-dir <tmp>` via `child_process` and assert on stdout/exit code for a valid project, a
     semantic-error project, and a parse-error project (use a temp dir under `os.tmpdir()`, not a
     committed fixture, since this is exercising filesystem I/O, not checker behavior). Now that
     fatal errors carry a file, also assert the `<file>: <message>` prefix appears.
   - A grammar-tokenization test for `editors/vscode/syntaxes/crescent.tmLanguage.json`, using
     `vscode-textmate`/`vscode-oniguruma` (not currently a dependency anywhere in this repo — would
     need adding, presumably as a devDependency of a new `editors/vscode/package.json` "test"
     script) to tokenize `compiler/examples/*.crs` and assert on a few key scopes. This is exactly
     the manual check the previous session did by hand in a scratch directory; committing it as a
     real test would catch a regression like the `state<int>`-mistaken-for-a-tag bug that session
     found and fixed, before it ships next time.
   - A script-based smoke test for `extension.js`'s diagnostics logic, reusing this session's
     mock-`vscode` approach (a small `DiagnosticCollection`/`Diagnostic`/`Range`/`Uri` mock plus the
     existing command-related mock from last session) as a committed fixture rather than a
     throwaway scratch directory.
   - A real VS Code extension test (`@vscode/test-electron`) is the most thorough option but the
     heaviest to set up; consider it once the extension's feature set has settled more (e.g. after
     `Crescent: Preview`), rather than now.
4. If VS Code/testing work is deferred, the semantic checker (`TODO.md` §16 "Current Priority
   Order") is the other standing priority:
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

**Task:** In-editor diagnostics for the VS Code extension (`TODO.md` §10, "Near-Term VS Code
Enablement" plan's diagnostics bullet) — the maintainer's explicit next step after last session's
minimal extension, requested via a plain "continue".

**Result:** Done. Small compiler-side fix first: `LexError`/`ParseError` gained an optional
`file?` field, set by `loadAllPrograms()` (`modules.ts`) when it catches one during its directory
walk (previously lost entirely); `FatalDiagnostic` (`project.ts`) gained a matching `file: string |
null`, left `null` for `ModuleError` (import cycles/missing exports involve ≥2 files — no single
file to guess); `cli.ts`/`index.ts` now print `<file>: <message>` when known. Then the actual
feature in `editors/vscode/src/extension.js`: a `vscode.DiagnosticCollection`, populated by
calling `checkProject()` **in-process** (`require()`ing the compiled `compiler/dist/project.js`,
not spawning the CLI and parsing text) on save and on open (continuous/on-change checking
explicitly deferred, its own still-open `TODO.md` bullet). Refactored `findCliPath()` to share a
`findDistDir()` helper with the new `findProjectModulePath()`. Diagnostics republish the whole
collection every `checkProject()` run (correct for cross-file issues via `use` imports, at the
documented cost of clearing a *different* open project's diagnostics in a multi-root workspace
until it's re-saved). Verified end-to-end (not just `node --check`) by extending last session's
mock-`vscode` approach with `DiagnosticCollection`/`Diagnostic`/`Range`/`Uri`: a real semantic
error showed up on the right file/line/severity/message, a clean project produced zero
diagnostics, and a real parse error was correctly attributed to its file — proving the new
`FatalDiagnostic.file` threads all the way through to a real `vscode.Diagnostic`, not just CLI
text output. Updated `editors/vscode/README.md` (new "Diagnostics" section, version bump to
`0.2.0`, corrected the "press F5" instruction to reference the `.vscode/launch.json` the
maintainer committed between sessions) and `TODO.md` (checked off the save/open bullet, split
"on document changes" into its own still-open item).

**Commit:** Not committed — working tree contains the diff described above (modified
`compiler/src/lexer.ts`, `compiler/src/parser.ts`, `compiler/src/modules.ts`,
`compiler/src/project.ts`, `compiler/src/cli.ts`, `compiler/src/index.ts`,
`editors/vscode/src/extension.js`, `editors/vscode/README.md`, `editors/vscode/package.json`,
`TODO.md`, `HANDOFF.md`), on top of the previous two sessions' already-committed CLI and minimal-
extension work (`4e6f485`, `4f51112`) plus the maintainer's own `b57be3f` (`.vscode/launch.json`).

**Tests:** `cd compiler && npx tsc --noEmit` (clean); `npm test` (145 PASS, 0 FAIL, exit 0 —
unchanged count; the compiler-side changes are additive: an optional field plus a try/catch that
only changes what's attached to an already-thrown error, not any check's pass/fail outcome).
Manually verified the compiler-side fix (`broken.crs: Expected a template node...` instead of a
bare `error: ...`) and the full diagnostics pipeline via the mock-`vscode` harness (see "Manual
verification" in "Last Completed Work" for the three specific scenarios). No automated suite
covers `editors/vscode/` — see "Recommended Next Step" #3 for making that a real, committed test.

**Next:** Continuous/on-change diagnostics, `Crescent: Preview`, multi-root diagnostic
partitioning, and the LSP replacement are all still open under `TODO.md` §10 — see "Recommended
Next Step" #2 for specifics on each. A committed test harness (`cli.ts`, the TextMate grammar, or
this session's diagnostics logic — see "Recommended Next Step" #3) would also be a good small unit
if VS Code work isn't picked up immediately.

---

### Previous session

**AI:** Claude

**Task:** Minimal VS Code extension (`TODO.md` §10, "Near-Term VS Code Enablement" plan's first
bullet) — the maintainer's explicit next step after last session's CLI.

**Result:** Done. New `editors/vscode/`: `package.json` (language `crescent`, `.crs` association,
`crescent.check`/`crescent.build` commands, `crescent.cliPath`/`crescent.outDir` settings),
`language-configuration.json` (comments, bracket matching — deliberately excluding `<`/`>`, see
"Last Completed Work" for why), `syntaxes/crescent.tmLanguage.json` (flat TextMate grammar,
verified by actually tokenizing `compiler/examples/*.crs` with `vscode-textmate` in a scratch
directory — caught and fixed a real bug where `state<int>` was misread as a tag), and
`src/extension.js` (plain CommonJS, no build step; auto-detects `compiler/dist/cli.js` in this
monorepo, spawns it, streams output to a "Crescent" output channel). No in-editor diagnostics yet
— that's the plan's next bullet, deliberately not started this session. Verified the extension
logic end-to-end (not just `node --check`) by mocking the slice of the `vscode` API it uses and
invoking the real command handlers against this actual repo — both **Check** and **Build**
correctly found the compiler, ran it, and produced correct output (see "Manual verification").

**Commit:** Committed by the maintainer as `4f51112` ("feat: Add vscode"), on top of `4e6f485`
("feat: Add CLI" — the previous session's work, also committed by the maintainer, byte-for-byte
identical to the patch handed over).

**Tests:** `cd compiler && npx tsc --noEmit` (clean, unchanged); `npm test` (145 PASS, 0 FAIL,
exit 0, unchanged — this session touched nothing under `compiler/`). No automated suite covers
`editors/vscode/`; see "Manual verification" in "Last Completed Work" for what was checked by hand,
and "Recommended Next Step" #3 for options to make that a real, committed test.

**Next:** Diagnostics-in-editor (done next session — see "Latest session" above).

---

### Older session

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
A follow-up request in the same conversation asked for docs to be cleaned up alongside the CLI
patch: fixed `compiler/README.md`'s stale "prints their ASTs as JSON" line and its "What it
checks" list missing two later-added checks (see the CLI patch's own follow-up note, folded into
this entry since it was the same session/task from the maintainer's perspective).

**Commit:** Committed by the maintainer as `4e6f485` ("feat: Add CLI").

**Tests:** `npx tsc --noEmit` (clean); `npm test` (145 PASS, 0 FAIL, exit 0 — same count as
before this session). `dist/cli.js` manually exercised against `/tmp` fixtures (not part of
`npm test`; see "Recommended Next Step" #3 for adding this as a real script-based test).

**Next:** VS Code support (done — see "Previous session" above).

---

### Older session

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
