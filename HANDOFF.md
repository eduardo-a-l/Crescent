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
Just completed: a minimal VS Code extension (`editors/vscode/`) — `.crs` file association,
TextMate syntax highlighting, comment/bracket/indent configuration, and `Crescent: Check`/
`Crescent: Build` commands that shell out to the `crescent` CLI built last session. See "Last
Completed Work" below. Choose the next item from `TODO.md` before beginning new work — the
maintainer's stated plan is a playground next, then real project testing, then broader language
features (enum, match, etc). Diagnostics-in-editor and a `Crescent: Preview` command (`TODO.md`
§10) are also still open if the maintainer wants more VS Code work first.

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

Minimal VS Code extension (`TODO.md` §10 "Near-Term VS Code Enablement", first bullet only — the
maintainer's stated next step after last session's CLI). New `editors/vscode/` directory:

1. **`package.json`** — extension manifest. `.crs` → language id `crescent`. Two commands,
   `crescent.check` / `crescent.build` (titled "Crescent: Check" / "Crescent: Build"). Two
   settings: `crescent.cliPath` (explicit path to `compiler/dist/cli.js`, or a bare command such
   as `crescent` after `npm link`) and `crescent.outDir` (default `"dist"`, relative to the
   project root, used by **Build**). `engines.vscode": "^1.75.0"` — modern enough that VS Code
   auto-infers `onCommand:*` activation from the `commands` contribution, so only
   `onLanguage:crescent` needed to be declared explicitly.
2. **`language-configuration.json`** — line/block comments (`//`, `/* */`, matching
   `compiler/src/lexer.ts`'s `skipWhitespaceAndComments()` exactly), bracket matching/auto-closing
   for `{}`/`[]`/`()`, and a brace-based indent heuristic. **Deliberately excludes `<`/`>`** from
   bracket matching/auto-closing — `compiler/README.md`'s "Key implementation decisions" section
   documents that the lexer always emits a plain `LT`/`GT` token and the *parser* disambiguates
   generic-vs-comparison-vs-tag-open by which production is currently being parsed; a flat
   editor-side config has no such context, so auto-closing `<` would misfire on every `a < b`.
3. **`syntaxes/crescent.tmLanguage.json`** — a flat (no `view`/`style` sub-grammar embedding)
   TextMate grammar covering: comments, double-quoted strings with `\`-escapes (including that a
   string may legally span multiple lines, matching the lexer), the full keyword table from
   `compiler/src/tokens.ts` (split into declaration/control/literal groups for reasonable default
   theme coloring), the four primitive types, the name after `component`/`struct`, template tag
   names (`<div`, `</div`, `<UserCard`), operators, and punctuation.
   - **Verified by actually tokenizing, not just visual inspection**: installed `vscode-textmate`/
     `vscode-oniguruma` in a scratch directory and ran the real grammar against
     `compiler/examples/*.crs` through `Registry.loadGrammar()` / `tokenizeLine()`. This caught a
     real bug before it shipped: the tag-name pattern (`<` or `</` followed by an identifier)
     initially also matched the `<` in `state<int>`, `derived<T>`, etc. — misclassifying `<int>`
     as a tag instead of an operator + primitive type. Fixed with a negative lookbehind
     (`(?<![A-Za-z0-9_])` before the `<`/`</`), since a real tag's `<` is always preceded by
     whitespace/`{`/newline/another `>`, never glued directly onto an identifier the way a generic
     type's `<` is. Re-verified against `counter.crs`, `theme_toggle.crs` (style block — no CSS-
     aware highlighting attempted, by design), and `structs_and_generics.crs` after the fix.
4. **`src/extension.js`** — plain CommonJS (no bundler/build step). `findCliPath()` honors
   `crescent.cliPath` first, then walks up from the open project root looking for a sibling
   `compiler/dist/cli.js` (this monorepo's own layout) as a development-time convenience default.
   Both commands resolve a project root from the active editor's workspace folder (falling back to
   the first workspace folder), spawn the CLI via `child_process.spawn`, and stream stdout/stderr
   into a "Crescent" `OutputChannel`. **No diagnostics are published to the editor** (no
   `DiagnosticCollection`) — that's the plan's next bullet, deliberately not started this session
   per `AGENTS.md` §15 ("do not begin a second major feature").
5. **`editors/vscode/README.md`** — dev instructions (`F5` / Extension Development Host, no build
   step needed), settings reference, and an explicit "what the grammar highlights, and what it
   deliberately doesn't" section so the next session (or a user) doesn't mistake the flat grammar
   for something it isn't.
6. Root `README.md`: added a fourth documentation-index bullet linking to
   `editors/vscode/README.md`, alongside the design doc, grammar spec, and compiler README.
7. `TODO.md`: checked off the "Create a minimal VS Code extension: ..." bullet under §10 (with a
   short note on what it points to); left the next three bullets (diagnostics-on-save, `Crescent:
   Preview`, LSP replacement) unchecked.

### Manual verification

No automated test suite covers a VS Code extension (there's no VS Code test harness in this
repo, and none was added — see "Known Problems"/"Recommended Next Step"). Verified by hand:

- **Grammar**: tokenized `compiler/examples/counter.crs`, `theme_toggle.crs`, and
  `structs_and_generics.crs` with the real `vscode-textmate` engine (see above) — correct scopes
  for keywords, primitive types, tag names, `state<int>`-style generics (post-fix), comments,
  strings, and numbers throughout; style-block content intentionally gets only flat
  comment/string/number/punctuation treatment, no CSS awareness.
- **Extension logic**: since `vscode` isn't installable outside a real VS Code host, wrote a
  throwaway mock of the small slice of the `vscode` API `extension.js` actually calls
  (`workspace.getConfiguration`/`getWorkspaceFolder`/`workspaceFolders`, `window.activeTextEditor`/
  `createOutputChannel`/`showErrorMessage`, `commands.registerCommand`) in a scratch directory
  (not committed), loaded `extension.js` against it via `NODE_PATH`, called `activate()`, then
  invoked the registered `crescent.check`/`crescent.build` handlers directly:
  - Against the whole repo root: `findCliPath()` correctly located
    `compiler/dist/cli.js` (already built from last session) and correctly surfaced a real error
    from one of `compiler/scripts/fixtures/missing-export/`'s intentionally-broken checker
    fixtures — confirming end-to-end wiring, not just that it runs without throwing.
  - Against `compiler/examples/`: **Check** printed `OK — 17 file(s) checked, no problems found.`,
    exit 0. **Build** (with `crescent.outDir` left at its default `"dist"`) generated
    `compiler/examples/dist/gen/*.js` (mirroring the source tree, including the nested
    `modules/` subtree) plus `compiler/examples/dist/runtime.js`, exit 0 — confirming the
    `outDir` setting is joined onto the project root correctly. Both throwaway output directories
    were deleted after the check.
- `node --check editors/vscode/src/extension.js` — no syntax errors.
- Confirmed all three JSON files (`package.json`, `language-configuration.json`,
  `syntaxes/crescent.tmLanguage.json`) parse as valid JSON.

### Files changed

- `editors/vscode/package.json` (new)
- `editors/vscode/language-configuration.json` (new)
- `editors/vscode/syntaxes/crescent.tmLanguage.json` (new)
- `editors/vscode/src/extension.js` (new)
- `editors/vscode/README.md` (new)
- `README.md` (doc index bullet)
- `TODO.md` (checked off the relevant §10 bullet)
- `HANDOFF.md`

---

## Tests

### Last type-check and full suite

```text
cd compiler && npx tsc --noEmit
-> no errors (this session touched no compiler .ts files, so this is an unchanged-behavior check)

cd compiler && npm test
-> 145 PASS, 0 FAIL, exit code 0 (unchanged from last session — this session's changes are
entirely under editors/vscode/, outside the compiler's own test suite)
```

No automated suite exercises `editors/vscode/` — see "Manual verification" above for what was
checked by hand instead, and "Recommended Next Step" for a real, committed test harness as a
worthwhile follow-up.

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

_No active unfinished implementation. This session's VS Code extension task (`.crs` association,
syntax highlighting, language config, Check/Build commands) is complete and manually verified —
see "Last Completed Work" above. Diagnostics-in-editor, `Crescent: Preview`, and the LSP
replacement (`TODO.md` §10) remain unstarted — deliberately out of scope this session per
`AGENTS.md` §15 ("do not begin a second major feature")._

---

## Recommended Next Step

1. Read `TODO.md`.
2. **The maintainer's stated order was: CLI → VS Code support → playground → real project testing
   → broader language features (enum, match, etc).** CLI and a first VS Code extension are both
   done now (see "Last Completed Work" above and the previous session's entry below). The next
   unstarted bullet in `TODO.md`'s "Near-Term VS Code Enablement (v0.x)" is:
   - **Publish diagnostics in the editor.** Wire `checkProject()` (`compiler/src/project.ts`) into
     a `vscode.languages.createDiagnosticCollection('crescent')`, run on save (a
     `workspace.onDidSaveTextDocument` listener is enough for v1; "on document changes" /
     incremental checking is explicitly deferred by the plan). Map each `Diagnostic` from
     `checker.ts` (`{ severity, message, where, line }`, no column yet) onto a
     `vscode.Diagnostic` at `new vscode.Range(line - 1, 0, line - 1, <big number>)` (whole-line,
     since there's no column) with `severity === 'error' ? vscode.DiagnosticSeverity.Error :
     vscode.DiagnosticSeverity.Warning`. Also surface a `fatal` (parse/module) result as a single
     diagnostic on the file that actually failed if you can attribute it to one, or as a
     `showErrorMessage` if not (checker.ts's `CheckProjectResult.fatal` doesn't currently carry a
     file, since `LexError`/`ParseError`/`ModuleError` messages are just strings — check whether
     that's worth improving as part of this work, per `AGENTS.md`'s "identify the disagreement,
     don't silently choose" principle, rather than guessing at a file to attribute it to).
     `checkProject()` is disk-based only (rereads files from disk, not the editor's unsaved
     buffer) — that's fine for an on-save trigger, but means diagnostics will be stale for unsaved
     edits, which is an acceptable, documented v0.x limitation, not a bug to silently work around.
   - After that: `Crescent: Preview` (build + open/reload `build:web`-style bundled output, but
     pointed at a real project rather than `compiler/examples/`), then the LSP replacement.
3. A worthwhile small addition, independent of the above: a real, committed test harness for
   `editors/vscode/` and/or `cli.ts` (both currently only verified by hand — see "Manual
   verification" in "Last Completed Work" above for both sessions). Options, roughly in order of
   effort:
   - A script-based smoke test for `cli.ts` itself, following the existing
     `compiler/scripts/test-*.js` convention: spawn `node dist/cli.js check/build <fixture-dir>
     --out-dir <tmp>` via `child_process` and assert on stdout/exit code for a valid project, a
     semantic-error project, and a parse-error project (use a temp dir under `os.tmpdir()`, not a
     committed fixture, since this is exercising filesystem I/O, not checker behavior).
   - A grammar-tokenization test for `editors/vscode/syntaxes/crescent.tmLanguage.json`, using
     `vscode-textmate`/`vscode-oniguruma` (not currently a dependency anywhere in this repo — would
     need adding, presumably as a devDependency of a new `editors/vscode/package.json` "test"
     script) to tokenize `compiler/examples/*.crs` and assert on a few key scopes. This is exactly
     the manual check this session did by hand in a scratch directory; committing it as a real test
     would catch a regression like the `state<int>`-mistaken-for-a-tag bug this session found and
     fixed, before it ships next time.
   - A real VS Code extension test (`@vscode/test-electron`) is the most thorough option but the
     heaviest to set up; probably not worth it before the diagnostics-on-save feature above exists,
     since there's more to test once that lands.
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

**Commit:** Not committed — working tree contains the diff described above (new `editors/vscode/`
directory; modified `README.md`, `TODO.md`, `HANDOFF.md`), on top of last session's uncommitted
CLI diff (`compiler/src/project.ts`, `compiler/src/cli.ts`, modified `compiler/src/index.ts`,
`compiler/package.json`, `compiler/package-lock.json`, `compiler/README.md`).

**Tests:** `cd compiler && npx tsc --noEmit` (clean, unchanged); `npm test` (145 PASS, 0 FAIL,
exit 0, unchanged — this session touched nothing under `compiler/`). No automated suite covers
`editors/vscode/`; see "Manual verification" in "Last Completed Work" for what was checked by hand,
and "Recommended Next Step" #3 for options to make that a real, committed test.

**Next:** Diagnostics-in-editor is the maintainer's stated next VS Code bullet — see "Recommended
Next Step" #2 above for a concrete plan (map `checker.ts` `Diagnostic`s onto
`vscode.Diagnostic`s via a `DiagnosticCollection`, triggered `onDidSaveTextDocument`). A committed
test harness for either `cli.ts` or the TextMate grammar (see "Recommended Next Step" #3) would
also be a good small unit if VS Code work isn't picked up immediately.

---

### Previous session

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

**Commit:** Not committed — working tree contains the diff described above (new
`compiler/src/project.ts`, `compiler/src/cli.ts`; modified `compiler/src/index.ts`,
`compiler/package.json`, `compiler/package-lock.json` (bin field sync only), `compiler/README.md`,
`TODO.md`, `HANDOFF.md`).

**Tests:** `npx tsc --noEmit` (clean); `npm test` (145 PASS, 0 FAIL, exit 0 — same count as
before this session). `dist/cli.js` manually exercised against `/tmp` fixtures (not part of
`npm test`; see "Recommended Next Step" #3 for adding this as a real script-based test).

**Next:** VS Code support (done next session — see "Latest session" above).

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
