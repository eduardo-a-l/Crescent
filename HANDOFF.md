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
Latest session implemented **array element type checking** (`TODO.md` §5 Semantic Checker →
Types), the next unchecked item after function return-type checking (which itself had already been
committed to `develop` — `b0b00e5` — by the time this session started; this session's own prior
patch had been applied and merged upstream). Added `checkArrayElements()` in `checker.ts`: walks
every element of an array literal (recursively for nested array literals) once the expected type is
known to be (or unwrap to) an `ArrayType`, catching a mismatched element or a disallowed `null`
element at *any* index — a real gap, since `inferLiteralType`'s existing array-type inference only
looks at `elements[0]`, so e.g. `int[] x = [1, 2, "three"]` previously passed the top-level
type-match check undetected. Wired into all four existing call sites that already do
literal-type-matching (`checkLiteralTypeMatch`, `checkCallArgs`, `checkAttributeTypeMatch`,
`checkReturnStmt`), each guarded to only run after its own existing top-level check passes. Four
new fixtures + `test-checker.js` cases (194 total tests, up from 190, all passing, no regressions).
`TODO.md` checked off with an implementation note. **Not committed** — see
`crescent-array-element-checking.patch` for a transferable copy of this session's diff.

Before that: implemented **function return-type checking** (`TODO.md` §5 Semantic Checker →
Types), the next unchecked item in that section after argument/prop-type checking. Added
`checkReturnStmt()`/`ReturnContext` in `checker.ts`: each `return` statement inside a `FunctionDecl`
body (including nested `if`/`for` blocks) is now validated against that function's declared return
type — a `void` function returning a value, a non-`void` function's bare `return;`, a
literal-shaped value of the wrong type, and a `null` return against a non-nullable type are all
flagged. Threaded through a new optional `returnCtx: ReturnContext | null` parameter on
`checkStmts()`, defaulting to `null`; `on_mount`/`on_change` bodies still call `checkStmts()`
without it, so they remain unaffected (lifecycle-block validation is a separate, still-unstarted
TODO item). Same literal-shaped-only limitation as the existing arg/prop/struct-field checks: a
`return someVar;` with a non-literal expression is left unchecked. Added four negative fixtures
(`wrong-return-type.crs`, `missing-return-value.crs`, `void-return-with-value.crs`,
`null-return-not-nullable.crs`) and one positive regression fixture (`correct-return-ok.crs`,
covering a matching nullable return and an early bare `return;` inside a `void` function), plus
matching `test-checker.js` cases. `TODO.md`'s "Function return-type checking" line checked off with
a note. Committed upstream as `b0b00e5` ("feat: Add return type checking") between sessions.

Before that: implemented **string interpolation** end to end — the first real
`TODO.md` §12 "Core Language Evolution" item picked up under the "important, not urgent, alternate
with hardening" framing from the previous session. A `string` literal can now embed `{ Expression }`
directly (`"Hello, {name}!"`), in any context a string literal appears (expressions, `view {}` text,
attribute values), with `\{`/`\}` as literal-brace escapes. See the top "Latest session" entry in
"Session Log" for the full design/implementation writeup. 6 new `npm test` cases (2 checker
fixtures + 4 e2e assertions), 185 total, all passing. `docs/Crescent_Grammar.md` and
`docs/Crescent_Design.md` both updated — this is the first session where a `TODO.md` §12 language
feature went from idea to a documented, implemented, tested part of the language, not just a
roadmap entry.

Before that: documentation-only — restructured `TODO.md`
§12 around ten maintainer-supplied core-language-evolution ideas (string interpolation,
destructuring, tuples, enums/ADTs, pattern matching, exhaustiveness diagnostics, first-class
function types, generics, interfaces/traits, broader type-system polish), framed explicitly as
"important, not urgent" with a note that hardening work (the last several sessions) shouldn't
indefinitely crowd it out. 179 total tests at that point (see the next "Older session" entry).

Before that: finished sweeping every `typeIsResolvable(...)` call site in `checker.ts` for
fixture coverage. Added tests for three untested paths (component-level param type, struct field
type, `inject<T>` type) and flagged (but did not fix) that `state`/`derived`/`provide`/`const`
declared types are never checked for existence, only compared against their initializer. 179 total
tests at that point (see further "Older session" entries).

Before that: added checker-level tests for the `Cannot assign to derived` and direct-property-
write-forbidden diagnostics, which previously were only exercised indirectly via `codegen.ts`'s
own separate `CodegenError` checks — flagged (but did not fix) that codegen still duplicates both
rules independently of the checker. 176 total tests at that point (see further "Older session"
entries).

Before that: added regression-test coverage for several semantic-checker diagnostics that were
already implemented but untested/marked unstarted in `TODO.md` (component existence/prop/
declaration checking, general undefined-name diagnostics). 174 total tests at that point (see
further "Older session" entries).

Before that: a documentation-only session organized an externally-sourced set of future-direction
ideas into `TODO.md` and fixed a stale `README.md` bullet (see further "Older session" entries).

Before that: `Crescent: Preview` for the VS Code extension (`editors/vscode/`) — a
`compiler/src/webPreview.ts` builds a project and bundles its previewable components (via
`esbuild`) into a single HTML page, `require()`d in-process by a `crescent.preview` command
that opens/reloads a webview panel, plus a `crescent.previewInBrowser` command
("Crescent: Open Preview in Browser") that builds the identical HTML but opens it in a real
system browser tab instead. The generated page has no "Crescent Preview"/component-name/file-path
chrome above each mounted app (just the rendered component(s)), `.crs` files get a file icon
(`editors/vscode/icons/crescent-logo.svg`), the preview page's own wrapper boxes (skipped-files/
bundling-failure/empty-project messages) are scoped to a `.crs-preview-box` class instead of a
bare `section` selector (so a user's own `<section>` in their view no longer picks up an unwanted
border), and tag punctuation (`>`/`/>`) in the TextMate grammar is now colored consistently with
`<`/`</` instead of like the `>`/`>=` comparison operator. All of the above is committed — see
"Last Completed Work"/"Session Log" for exactly which commit introduced which piece. Choose the
next item from `TODO.md` before beginning new work — the maintainer's stated plan was CLI → VS Code
support → real project testing → broader language features (enum, match, etc); there is no
"playground" step (an earlier session's summary of this plan mentioned one, which was
inaccurate — corrected here). Continuous/on-change diagnostics, multi-root diagnostic
partitioning, and the LSP replacement (`TODO.md` §10) are also still open if the maintainer
wants more VS Code work first. `TODO.md` itself grew substantially this session (see below) with
longer-term items (dev server/HMR/incremental compilation, `Result`/pattern matching, a typed-AST
architecture note, etc.) — none of it changes near-term priority, which remains the semantic
checker per `TODO.md` §16.

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

`Crescent: Preview` for the VS Code extension (`TODO.md` §10 "Near-Term VS Code Enablement", the
last unstarted bullet besides continuous diagnostics and the LSP replacement — the maintainer's
explicit next step, requested via a plain "continue"), plus a same-session follow-up requested by
the maintainer after reviewing it. Three parts:

**1. `compiler/src/webPreview.ts` — the compiler-side build/bundle engine, kept independent of the
extension so it's directly unit-testable:**
- `buildPreviewHtml(root, outDir)` calls `buildProject()` (the same `project.ts` API `cli.ts` and
  the diagnostics feature already use), then bundles each successfully-compiled file with
  `esbuild` (`bundle: true, format: 'iife'`, one unique `globalName` per file) — the same approach
  `scripts/build-web.js` already used for `compiler/examples/`, generalized to an arbitrary
  project root instead of a hard-coded target list.
- **Which components get mounted:** only top-level components declared with **zero parameters**.
  A component that takes parameters (e.g. `component Card(Point origin)`, `component
  Greeting(string name)`) exists to be used as `<Card origin={...}>`/`<Greeting name="...">` inside
  another component's view — the preview has no value to supply for `origin`/`name`. This isn't a
  guess: it was verified against every `.crs` file in `compiler/examples/` to match, component-for-
  component, the hand-picked target list `scripts/build-web.js` already used (`Counter`,
  `DayPicker`, `ThemeToggle`, the composition/provide_inject/modules `App`s, `TaskBoard`, `Cart`,
  `TodoList`, `TaskList`, `NumberList`, `Header` all have zero params; `Greeting` and the
  `modules/components/card.crs` `Card(Point origin)` are the only excluded ones).
- **Mount-time failure isolation:** a zero-param component can still fail once mounted standalone —
  most notably `inject<T>` (design doc §12) with no ancestor `provide<T>`, since a preview root by
  definition has no ancestors (`provide_inject.crs`'s `DeepNestedWidget` and `Dashboard` both hit
  this). Detecting that *transitively* — including through components nested arbitrarily deep in
  the view tree — is a real dataflow analysis, not something to bolt onto a preview-bundling tool
  in the same session. Instead, each mount call in the generated HTML is wrapped in its own
  try/catch: a failing root shows an inline "Preview error: ..." message in its own section,
  console-logs the real error, and does not prevent any other root on the page from rendering.
  This was a real bug caught by testing, not a decision made up front — see "Manual verification".
- A file that fails semantic checking is skipped for codegen exactly the way `buildProject()`
  already skips it for **Build**; skipped files are listed under a "Skipped files" section at the
  top of the preview page (with the checker's own message) instead of silently vanishing. If
  *every* file fails, the result is a valid, empty preview page saying so — not a thrown error.
- A **fatal** error (parse/lex, or a module-level error like an import cycle) has no partial output
  to bundle, same as `FatalDiagnostic` in the diagnostics feature — `buildPreviewHtml()` returns
  `{ ok: false }` in that case rather than throwing or producing broken HTML.

**2. The `crescent.preview` command, in `editors/vscode/src/extension.js`:**
- `findWebPreviewModulePath()`/`loadWebPreviewModule()` mirror the existing
  `findProjectModulePath()`/`loadProjectModule()` pattern exactly (same `crescent.cliPath`/
  `findDistDir()` resolution, same in-process `require()` rationale, same bare-command limitation
  and same Node module-cache dev-loop caveat) — resolving to `webPreview.js` instead of
  `project.js`.
- Compiles into `<root>/<crescent.outDir>/preview` — nested under the existing `crescent.outDir`
  setting rather than a new setting, so it never collides with a **Build** run's own `gen/`/
  `runtime.js` in the same directory.
- On first run, opens a `vscode.WebviewPanel` (`enableScripts: true`); on subsequent runs, replaces
  that panel's `webview.html` in place and reveals it, rather than opening a second panel —
  verified with a mock-`vscode` harness (see "Manual verification").
- Saving or opening a `.crs` file also triggers this same rebuild-and-replace, but with
  `reveal=false` (doesn't steal focus from the editor while typing) and **only** when a preview
  panel is already open **and** was built from the same project root as the saved/opened document
  — so a save in a different open project (multi-root workspace) can't silently swap out what an
  unrelated open preview panel is showing.
- The `crescent.preview` command handler and the save/open-triggered refresh both call (and, for
  the command, `return` — see "Manual verification" for why this mattered) the same
  `refreshPreview(root, reveal)` helper, keeping the "open" and "reload" paths from drifting apart.
- `editors/vscode/README.md`: added a "Preview" section covering all of the above (what gets
  mounted and why, mount-failure isolation, skipped-files/fatal-error reporting, panel reuse and
  the save-triggered reload's scoping, and the honest limitation that a reload replaces the whole
  webview rather than doing a real hot-module-reload — so a previewed component's local state, like
  a `Counter`'s count, resets on every save); updated the intro bullet list, the `cliPath`/`outDir`
  settings notes, and "Known limitations" (removed the now-stale "no `Crescent: Preview` command
  yet" bullet, added the HMR/state-reset one in its place).
- `compiler/README.md`: added `src/project.ts`, `src/webPreview.ts`, and
  `scripts/test-preview.js` to the structure list (the first was previously undocumented there
  despite already existing; the other two are new this session).
- `TODO.md`: checked off the `Crescent: Preview` bullet under §10 with a pointer to what it covers
  and its known HMR/state-reset trade-off.

**3. A same-session follow-up, requested directly by the maintainer after reviewing the panel-only
version:** a second command, `crescent.previewInBrowser` ("Crescent: Open Preview in Browser"),
for seeing the preview as a genuine browser tab rather than a VS Code webview panel. Required no
new compiler-side work — `buildPreviewHtml()`'s output was already a self-contained HTML string
with no webview-specific assumptions baked in. In `extension.js`:
- Extracted the shared "load `webPreview.js`, call `buildPreviewHtml()`, report any failure via
  `showErrorMessage()`" logic out of `refreshPreview()` into a new `buildPreviewResult(root)`
  helper, so both commands agree on exactly what counts as a build failure and how it's reported,
  instead of duplicating that error-handling.
- `openPreviewInBrowser(root)`: writes the built HTML to
  `<root>/<crescent.outDir>/preview/index.html` (same `previewOutDir` `buildProject()` already
  wrote the compiled `gen/`/`runtime.js` into, so no new directory-creation logic was needed —
  `fs.mkdirSync(..., { recursive: true })` inside `project.ts` already guarantees it exists by the
  time this runs) and opens it via `vscode.env.openExternal()` — a real `file://` page outside the
  webview's sandbox/CSP.
- Deliberately **not** wired to the save/open auto-reload `refreshPreview()`'s panel gets: there's
  no live connection to an already-open external browser tab to push a reload into, so it's
  documented as a one-shot "build now, open now" — rerunning the command rewrites the same file
  and re-invokes the OS's "open" on it, and whether that refreshes an already-open tab is up to the
  browser/OS, not something this extension can control.
- `editors/vscode/README.md`: new "Opening it in a real browser" subsection under "Preview", an
  intro bullet, and a "Known limitations" bullet for the no-auto-reload trade-off.
- `TODO.md`: extended the `Crescent: Preview` bullet's note to mention this second command rather
  than adding a new bullet, since it's the same TODO item ("opens ... the browser output") — this
  command is arguably a more literal reading of that original wording than the webview panel is.

**4. Two more follow-ups, requested after the maintainer committed and actually looked at the
rendered output — not yet committed as of this writing:**
- **Removed the preview page's debug chrome.** The generated page used to open with a visible
  `<h1>Crescent Preview</h1>`, then a `<h2>{ComponentName}</h2>` and a `<p>{file path}</p>` above
  every mounted component — useful while eyeballing a dozen unrelated `compiler/examples/`
  components at once, but wrong for a single real project: it just reads as clutter above your
  actual app. `compiler/src/webPreview.ts` now emits a bare `<div id=... data-crescent-component=
  "..." data-crescent-file="...">` for each mount instead — the component/file mapping survives
  (visible in devtools, or `grep`-able in the HTML source) but isn't printed on the page.
  `<title>Crescent Preview</title>` (the browser **tab** title, not on-page text) was left as-is.
  Skipped-files/bundling-failure/empty-project messaging is untouched — those are real diagnostics,
  not decorative chrome, and only ever render when actually relevant. `body`'s margin dropped to
  `0` so a single mounted app isn't padded away from the page edge the way a real deployment
  wouldn't be either.
- **A file icon for `.crs` files**: `assets/crescent-logo.svg` (repo root) copied into
  `editors/vscode/icons/crescent-logo.svg` — copied rather than referenced via a `../../` path so
  the extension stays self-contained if it's ever packaged/published standalone outside this
  monorepo — and wired up via `contributes.languages[0].icon` (`{ light, dark }`, both pointing at
  the same file) in `package.json`. This is VS Code's own documented mechanism for exactly this
  (https://code.visualstudio.com/api/extension-guides/file-icon-theme), present well before this
  extension's `engines.vscode: ^1.75.0` floor, so no version bump was needed. One real caveat,
  from that same doc, recorded in `editors/vscode/README.md`'s new "File icon" section: a
  language's `icon` is only a **fallback** — it's shown only when the person's active File Icon
  Theme doesn't already define its own icon for that file (by extension/filename/language ID). In
  practice this means it'll show for effectively everyone, since no theme has ever heard of `.crs`
  — but there's no VS Code API to force it to win over an active theme's own choice if one is ever
  added, and that's deliberate on VS Code's end, not a gap here.

### Manual verification

Extended the existing mock-`vscode` approach (from the diagnostics session) with a minimal
`WebviewPanel`/`createWebviewPanel` mock, plus a real, committed automated test
(`compiler/scripts/test-preview.js`, wired into `npm test`) for the compiler-side half:

- **`buildPreviewHtml()` against `compiler/examples/`**: asserts every expected zero-param root
  (`Counter`, `DayPicker`, `ThemeToggle`, `App` ×3, `TaskBoard`, `Cart`, `TodoList`, `TaskList`,
  `NumberList`, `Header`) is mounted, the two prop-taking components are not, there are zero
  bundling errors, and — via `jsdom` with real script execution — that `Counter` actually renders
  ("Current Count: 0") and increments on a simulated click ("Current Count: 1") inside the *actual
  generated preview page*, not just the underlying component module directly.
- **The inject-without-provider case**: the same `jsdom` page asserts `DeepNestedWidget`'s mount
  shows the `crs-preview-mount-error` class (confirming the try/catch path fires) **and** that
  `Counter` still incremented correctly on the same page — proving one failing root doesn't take
  down the others. This test is what caught the crash in the first place: the initial
  implementation had no try/catch, so `provide_inject.crs`'s `DeepNestedWidget`/`Dashboard` roots
  threw during mount and crashed the whole page's `DOMContentLoaded` handler, silently breaking
  every other mount call queued after them.
- **All-semantic-errors project**: a throwaway project with a single type-mismatch-only file still
  produces `{ ok: true }` with zero mounts and the broken file listed under `builds` with
  `outFile === null` — not a thrown exception.
- **The VS Code command, via mock-`vscode`**: ran `crescent.preview` against the real
  `compiler/examples/` — a webview panel was created with the expected title, its HTML contained
  the expected mount IDs for both `Counter` and the composition example's `App`; running the
  command a **second** time confirmed exactly one panel exists (not two) and `reveal()` was called
  on it. This surfaced a real bug: the command handler didn't `return` the promise from
  `refreshPreview()`, so `await`ing the command resolved before the build actually finished —
  harmless in real VS Code (which doesn't wait on a void-returning command either way) but flagged
  as worth fixing anyway, since a command handler that *can* return its promise should, for any
  caller (including a future test) that does want to await completion. Fixed by returning it.
- **The fatal-error path**: ran the command against a project with an unterminated `view {` block
  — zero panels created, `showErrorMessage` called with the parser's real message
  (`Expected a template node inside view block at line 3 (got EOF '')`), not a bare "unknown
  error". This caught a second real bug: the code originally read `result.build.fatal` instead of
  the correctly-nested `result.build.check.fatal`, which silently produced "unknown error" for
  every fatal case. Fixed, then re-verified.
- `node --check editors/vscode/src/extension.js` — no syntax errors.
- Full compiler regression: `npx tsc --noEmit` and `npm test` (168 PASS, up from 145 — the 23 new
  assertions are `test-preview.js`; every pre-existing assertion still passes unchanged).
- **`crescent.previewInBrowser`, via mock-`vscode`** (extended with an `env.openExternal` mock):
  ran it against `compiler/examples/` — no webview panel was created, `openExternal` was called
  exactly once with a `file://` path under `<root>/dist/preview/index.html`, and that file's
  actual on-disk contents contained the expected `Counter` mount ID, matching what the panel
  command would have shown. Ran it a second time to confirm it doesn't accumulate a second target
  or error — same path both times. Ran it again against the same unterminated-`view{`-block
  project used for the panel's fatal-error check: no file was written, no `openExternal` call was
  made, and the same real parser message surfaced via `showErrorMessage` — confirming the shared
  `buildPreviewResult()` extraction didn't change either command's fatal-error behavior. No new
  automated test was added for this follow-up (only manual verification, as above) — the extracted
  `buildPreviewResult()` has no new *compiler-side* logic to unit-test; it's a thin VS Code-side
  wrapper around the already-tested `buildPreviewHtml()`.
- **Chrome removal**: inspected `buildPreviewHtml()`'s actual output against `compiler/examples/`
  directly (not through the mock-`vscode` harness) — confirmed no literal `<h1>Crescent
  Preview</h1>` or any `<h2>` remains anywhere in the generated HTML, and that
  `data-crescent-component="Counter"` is present on its mount `<div>`. Re-ran the full
  `test-preview.js` suite unmodified — still 168 PASS, since its `Counter` assertions query
  `counterRoot.querySelector('h1')` for the `<h1>` the *component itself* renders inside its own
  view, which is unrelated to (and unaffected by) the page-chrome `<h1>` that was removed. Re-ran
  both the panel and browser-open verifications end-to-end against the new HTML shape — both still
  create/write correctly.
- **File icon**: `python3 -c "import json; json.load(...)"` confirmed `package.json` is still valid
  JSON after the `icon` addition; confirmed `editors/vscode/icons/crescent-logo.svg` is byte-
  identical to `assets/crescent-logo.svg`. Could not visually confirm the icon actually renders in
  a live VS Code Explorer pane — that needs an actual VS Code window (or `@vscode/test-electron`),
  neither of which this environment can run; this is a real, documented gap in verification, not
  something resolved silently. The mechanism itself (`contributes.languages[].icon`) is confirmed
  against VS Code's own extension API documentation, not assumed from general knowledge.

### Files changed

- `compiler/src/webPreview.ts` (`buildPreviewHtml()`; this round removed its page-chrome
  `<h1>`/`<h2>`/path-paragraph output, replacing it with invisible `data-*` attributes on each
  mount `<div>`)
- `compiler/scripts/test-preview.js` (wired into `npm test`)
- `compiler/package.json` (`test` script now runs `test-preview.js`)
- `compiler/README.md` (structure list: `src/project.ts`, `src/webPreview.ts`,
  `scripts/test-preview.js`)
- `editors/vscode/src/extension.js` (`crescent.preview`/`crescent.previewInBrowser` commands,
  `refreshPreview()`/`openPreviewInBrowser()`/`buildPreviewResult()`,
  `findWebPreviewModulePath()`/`loadWebPreviewModule()`, webview panel state, save/open-triggered
  reload)
- `editors/vscode/package.json` (registered both preview commands; this round added
  `contributes.languages[0].icon` pointing at the new `icons/crescent-logo.svg`)
- `editors/vscode/icons/crescent-logo.svg` (new this round — copy of `assets/crescent-logo.svg`)
- `editors/vscode/README.md` ("Preview" section plus its "Opening it in a real browser"
  subsection, a new "File icon" section, updated intro/settings/"Known limitations", and a
  "three commands" → "four commands" count fix left stale by the previous round)
- `TODO.md` (checked off the `Crescent: Preview` bullet, noting the browser-open follow-up)
- `HANDOFF.md`

---

## Tests

### Last type-check and full suite

```text
cd compiler && npx tsc --noEmit
-> no errors

cd compiler && npm test
-> 168 PASS, 0 FAIL, exit code 0 (up from 145 — 23 new assertions from
compiler/scripts/test-preview.js, added this session; every pre-existing assertion still passes
unchanged)
```

No automated suite exercises `editors/vscode/` — see "Manual verification" above for what was
checked by hand instead (now covering the `Crescent: Preview` command too, not just Check/Build/
diagnostics), and "Recommended Next Step" for a real, committed test harness as a worthwhile
follow-up.

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

- `Crescent: Preview` (this session) mounts a zero-param component standalone even when it (or
  something nested inside its view, arbitrarily deep) declares `inject<T>` with no ancestor
  `provide<T>` — a preview root has no ancestors by construction, so this always fails at mount
  time. It's caught per-mount (an inline "Preview error" instead of crashing the page — see "Last
  Completed Work"), not prevented; detecting it statically would need to trace `provide`/`inject`
  through the whole component-nesting graph, which is a real, separate analysis task, not
  something to fold into a preview-bundling tool. Also: a preview reload replaces the entire
  webview HTML rather than doing a real hot-module-reload, so a previewed component's own local
  `state<T>` (e.g. a counter's current count) resets on every save — a real, documented trade-off
  of the "just replace the panel" approach, not an oversight.
- `Crescent: Open Preview in Browser` (follow-up, this session) has no equivalent of the panel's
  save-triggered auto-reload — there's no live connection to an already-open external browser tab
  to push a reload into, so it's a one-shot "build now, open now" and the person has to refresh
  the tab themselves after re-running the command.
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

_No active unfinished implementation. This session's `Crescent: Preview` command
(`compiler/src/webPreview.ts` + `editors/vscode/src/extension.js`'s `crescent.preview`) is
complete, covered by a new committed automated test (`compiler/scripts/test-preview.js`, in
`npm test`) for its compiler-side half, and manually verified end-to-end for the extension half —
see "Last Completed Work" above. Continuous/on-change diagnostics, multi-root diagnostic
partitioning, and the LSP replacement (`TODO.md` §10) remain unstarted — deliberately out of scope
this session per `AGENTS.md` §15 ("do not begin a second major feature")._

---

## Recommended Next Step

1. Read `TODO.md`.
2. **The maintainer's stated order was: CLI → VS Code support → real project testing → broader
   language features (enum, match, etc)** (there is no "playground" step — an earlier session's
   summary of this plan mentioned one, which was inaccurate; corrected here and in "Current
   State" above). CLI, a first VS Code extension, in-editor diagnostics, and now
   `Crescent: Preview` are all done (see "Last Completed Work" above and the session log below).
   Remaining unstarted bullets in `TODO.md`'s "Near-Term VS Code Enablement (v0.x)":
   - **Diagnostics on document changes** (continuous/incremental checking), not just save/open.
     Would need debouncing (don't re-run `checkProject()` on every keystroke) and, since
     `checkProject()` currently only reads from disk, either writing changed buffers to a temp
     location before checking or teaching `loadAllPrograms()`/`checkProject()` to accept in-memory
     file contents for the currently-edited document(s) — the latter is more invasive and was
     explicitly *not* attempted in the diagnostics session (see its in-process `project.js`
     approach, which still shells out to disk).
   - **LSP replacement** — the plan's own note is to defer this until the diagnostic model has
     stabilized; three sessions of hand-verified/tested VS Code tooling (diagnostics, then preview)
     is a reasonable point to start considering it, but there's no urgency while the extension's
     current process/in-process-`require()` approach still works.
   - **Multi-root workspace diagnostic partitioning** (see `editors/vscode/README.md`'s
     "Diagnostics" section) — currently, saving in one project's folder clears diagnostics for a
     different open project until it's re-saved. Scope the `DiagnosticCollection` per project root
     (e.g. key entries by root, or run `checkProject()` for every currently-open root on each save)
     rather than doing one global clear-and-repopulate. Note this session's `crescent.preview`
     command has the analogous scoping already (a save only reloads a preview panel built from the
     *same* root) — the diagnostics fix could follow the same pattern.
3. A worthwhile small addition, independent of the above: a real, committed test harness for
   `cli.ts` and the rest of `editors/vscode/` (this session added one for the compiler-side half of
   `Crescent: Preview` — `compiler/scripts/test-preview.js` — but `cli.ts` itself and the
   extension's diagnostics/command-wiring logic are still only verified by hand across three
   sessions now — see "Manual verification" in "Last Completed Work" above). Options, roughly in
   order of effort:
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
     the manual check a previous session did by hand in a scratch directory; committing it as a
     real test would catch a regression like the `state<int>`-mistaken-for-a-tag bug that session
     found and fixed, before it ships next time.
   - A script-based smoke test for `extension.js`'s diagnostics **and** preview command logic,
     committing the mock-`vscode` approach both sessions have built up by hand
     (`DiagnosticCollection`/`Diagnostic`/`Range`/`Uri`/`WebviewPanel` mocks) as a real fixture
     rather than a throwaway scratch directory each time.
   - A real VS Code extension test (`@vscode/test-electron`) is the most thorough option but the
     heaviest to set up; now that the extension's feature set has settled more (Check, Build,
     diagnostics, and Preview are all in), this is a reasonable point to consider it if VS Code
     work continues being the priority.
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

**Task:** Continuing from the previous session (whose diff had, by this session's start, already
been committed to `develop` as `b0b00e5` outside the AI's own workflow — the maintainer applied and
committed the handed-off patch between sessions). Re-checked `HEAD`, confirmed the working tree was
clean and green, then continued down `TODO.md` §16's priority order: **array element type
checking** in §5 Types, the next unchecked box.

**Result:** Investigated first, since the box's true scope wasn't obvious from its one-line
description. Found `inferLiteralType`'s existing `ArrayLiteral` case only infers a type from
`expr.elements[0]` — meaning `state<int[]> nums = [1, 2, "three"];` already passed the top-level
`literalTypeMatches` check silently, because the check only ever "sees" the first element's type.
That's the actual gap, not a from-scratch feature.

Added `checkArrayElements(declared, expr, where, line, diagnostics, messagePrefix)` to
`checker.ts`: unwraps a `NullableType` wrapper off `declared`, bails out if what remains isn't an
`ArrayType` (or `expr` isn't an `ArrayLiteral`) — safe no-op for any type it doesn't apply to — then
walks every element by index: a `null` element against a non-nullable element type is flagged, a
nested `ArrayLiteral` element recurses (so `int[][]` is checked element-by-element at every depth,
not just the outer array), and everything else goes through the same `inferLiteralType` +
`literalTypeMatches` pair every other check in this file already uses, with the mismatching index
named in the message.

Wired into all four places that already do a top-level literal-type match, each call added
*after* its own existing check and only reached when that check passed — so a wholesale wrong array
type (e.g. passing a `string[]` where `int[]` is declared) still produces exactly the one
pre-existing top-level diagnostic, not that plus a redundant per-element pile-on:
- `checkLiteralTypeMatch` — `state`/`derived`/`provide`/`const` initializers and struct-field
  values (both call sites this function already serves).
- `checkCallArgs` — call arguments, message prefixed `element of argument '<param>' of function
  '<fn>'`.
- `checkAttributeTypeMatch` — component props, message prefixed `element of prop '<attr>'`.
- `checkReturnStmt` — return values, message prefixed `element of function '<fn>' return value`
  (guarded on `returnType !== 'void'`, reusing the `ReturnContext` from last session).

Added four fixtures under `scripts/fixtures/checker/`: `wrong-array-element-type.crs` (a mismatched
element deep in a `state` initializer), `null-array-element-not-nullable.crs` (a `null` element
against non-nullable `int`), `wrong-array-element-type-arg.crs` (a mismatched element in an inline
array literal passed as a call argument), and `correct-array-elements-ok.crs` (positive — a plain
`int[]`, an `int?[]` with a `null` element, and a nested `int[][]`, plus that array being both a
`state` initializer and a function-call argument, none of which should fire). Matching
`test-checker.js` cases added. `TODO.md`'s "Array element type checking" line checked off with an
implementation note.

**Commit:** Not committed — working tree contains this focused diff. Handed over as
`crescent-array-element-checking.patch`.

**Tests:** `npx tsc --noEmit` clean. `npm test`: 194 PASS, 0 FAIL, exit 0 (up from 190 before this
session — exactly the 4 new fixture-driven cases above, no regressions anywhere, including the "all
real examples pass the semantic checker cleanly" check — the existing examples' array literals
(`array_mutators.crs`, `keyed_list.crs`, `reactive_list.crs`, `structs_and_generics.crs`, etc.) all
still produce zero diagnostics under the new per-element walk).

**Decisions:** Ran the element-wise check only *after* the existing top-level check succeeds, not
instead of it or in addition unconditionally — a wrong array type shouldn't drown the person in one
diagnostic per element when the real problem is the declared type itself. Recursed through nested
`ArrayLiteral` elements rather than trying to handle `int[][]` as a special flat case, since the
recursive form falls out naturally from `checkArrayElements` calling itself with `elementType` and
generalizes to any depth for free. Did not attempt to check non-literal array elements (e.g. an
identifier or function call inside `[a, b(), c]`) — same literal-shaped-only boundary as every other
check in this file; a real expression-type-inference pass is the actual prerequisite for going
further, as already noted in earlier sessions' "Decisions".

**Problems:** None. No pre-existing behavior needed to change; this was purely additive (new
diagnostics for cases that previously fell through silently).

**Remaining:** `TODO.md` §5 Types still has open items: complete assignment compatibility (the
`todos = [...]` plain-reassignment case in `keyed_list.crs`/`reactive_list.crs` is *not* checked by
anything today, array or otherwise — reassignment isn't routed through `checkLiteralTypeMatch` at
all), function-type compatibility, and the "More precise diagnostic messages" `typeIsResolvable`
note. None started this session.

**Next step:** Per `TODO.md` §16, either keep hardening the checker — "complete assignment
compatibility" is the most natural next box, and would also make the plain `state<T> x; ... x =
<value>;` case exercise the same `checkArrayElements` machinery — or, since hardening has now run
two sessions in a row, deliberately pick a §12 language-feature item next per the note at the end of
§16.

---

### Older session

**AI:** Claude

**Task:** No explicit maintainer task; followed `TODO.md` §16's priority order ("strengthen the
semantic checker" ranks above expanding language features) and picked **function return-type
checking** from §5 Types — the next unchecked box after argument checking and component prop-type
checking, both already done in prior sessions using the same literal-shaped-comparison approach.

**Result:** Added `ReturnContext` (`{ functionName, returnType }`) and `checkReturnStmt()` to
`checker.ts`. `checkComponentDecl()`'s `FunctionDecl` case now builds a `ReturnContext` from the
function's own name/declared return type and passes it into `checkStmts()` via a new optional
`returnCtx` parameter (default `null`), which the `If`/`For` recursive calls thread through
unchanged so a `return` nested inside a loop or branch is still checked against the *enclosing
function's* return type, not treated as un-contextualized. The `Return` statement case then calls
`checkReturnStmt()`, which mirrors `checkCallArgs()`'s existing null/literal-type-matching logic:
- a `void` function's `return <expr>;` is flagged ("has a 'void' return type but returns a value");
- a non-`void` function's bare `return;` is flagged ("must return a value of type '...'");
- `return null;` against a non-nullable declared type is flagged, matching the existing
  arg/prop/struct-field null-check wording;
- a literal-shaped return value (int/float/string/bool/struct-literal/array-literal) of the wrong
  type is flagged with the same "Type mismatch: ... but returns/received a '...' value" phrasing
  used elsewhere in the checker.

`on_mount`/`on_change` bodies call `checkStmts()` without a `returnCtx` (still `null`), so a
`return;` used there for early-exit is deliberately left unchecked — lifecycle-specific return
semantics are an open, separate `TODO.md` item ("Lifecycle block validation"), not something to
invent here. Only literal-shaped return expressions are checked; `return someVar;` (the common
case) is left alone, consistent with every other type-match check in this file — see the existing
"More precise diagnostic messages" `TODO.md` note for the same limitation elsewhere.

Added five fixtures under `scripts/fixtures/checker/`: `wrong-return-type.crs`,
`missing-return-value.crs`, `void-return-with-value.crs`, and `null-return-not-nullable.crs`
(negative), plus `correct-return-ok.crs` (positive — a normal `int` return, an `int?` function that
both returns `null` and returns a plain `int` depending on a branch, and a `void` function with an
early bare `return;` inside an `if`, none of which should produce a diagnostic). Added matching
cases to `scripts/test-checker.js`. Checked off "Function return-type checking" in `TODO.md` §5
Types with a short implementation note (existence-checking of the return type name itself was
already done by an earlier Codex session — this is the separate, previously-missing check that a
`return` statement's *value* matches that type).

**Commit:** Handed over as `crescent-return-type-checking.patch`; the maintainer applied and
committed it upstream as `develop`'s `b0b00e5` ("feat: Add return type checking") between sessions.

**Tests:** `cd compiler && npx tsc --noEmit` (clean); `npm install` (needed — `node_modules` was
absent at the start of this session, fresh clone); `npm test` (190 PASS, 0 FAIL, exit 0 — up from
185 before this session, i.e. exactly the 5 new fixture-driven assertions above, no regressions in
any pre-existing case, including the "all real examples pass the semantic checker cleanly" check
and every runtime/DOM/preview test).

**Decisions:** Kept the check literal-shaped-only (no attempt at a real expression type-inference
pass) to stay consistent with every other type-comparison check already in `checker.ts` — see the
"Decisions" note on component prop type checking two sessions ago, which flagged that a real
inference helper is the actual prerequisite for going beyond literal-only checking anywhere in this
file, return types included. Did not touch `on_mount`/`on_change` — giving lifecycle blocks a
return context (and deciding what "returning early" should even mean there) is a different,
undecided piece of work.

**Problems:** None encountered. No pre-existing behavior needed to change.

**Remaining:** `TODO.md` §5 Types still has open items: complete assignment compatibility, array
element type checking, function-type compatibility, and the "More precise diagnostic messages"
note (checking `typeIsResolvable` on `state`/`derived`/`provide`/`const` declared types before
comparing against the initializer). None started this session.

**Next step:** Per `TODO.md` §16, either continue hardening the checker (array element type
checking is the next naturally-scoped item using the same literal-shaped pattern used here and in
`checkCallArgs`/`checkAttributeTypeMatch`/`checkReturnStmt`) or, if hardening has now run several
sessions in a row, deliberately pick a §12 language-feature item instead per the note at the end of
§16.

---

### Older session

**AI:** Claude

**Task:** Explicit instruction to continue, following through on the previous session's own
framing ("important, not urgent... don't get stuck forever fixing things — a healthy project
alternates hardening with real language-design work"). Picked **string interpolation** from
`TODO.md` §12's "Core Language Evolution" list — the item explicitly flagged as "a reasonable
place to start if a small, self-contained language change is wanted" — and, per the framing note's
own instruction to "design it against `docs/Crescent_Design.md`'s existing principles, and write it
up there before touching the parser," did real design work first, then implemented the whole
feature (not just the design writeup) since the design turned out small and low-risk once grounded
in an existing pattern already in the codebase.

**Result:**
- Investigated before designing anything: Crescent had *zero* real string interpolation anywhere,
  including in `view`/`style` blocks — what looks like interpolation there
  (`<p>"Don't Buy " {item}</p>`) is actually just adjacent template-node siblings, not embedding
  inside one string. But `style {}` value parsing already has a working, tested mechanism for
  exactly this shape of problem: `Lexer.readInterpolationSource()` (brace-depth counting to find a
  matching `}`) plus `AST.StyleValuePart` (`raw`/`expr` parts) plus a nested `new Parser(exprSource)`
  to parse each captured expression source substring
  (`parser.ts`'s `parseStyleDeclaration()`). Designed string interpolation to reuse this exact
  mechanism rather than invent a second one, which kept the actual diff small and low-risk despite
  touching every compiler layer.
- **`compiler/src/ast.ts`:** generalized `StyleValuePart` into a new `InterpolatedPart` type alias
  (kept `StyleValuePart = InterpolatedPart` so every existing reference is untouched) and added a
  new `Expr` variant, `TemplateString { parts: InterpolatedPart[] }`.
- **`compiler/src/tokens.ts`:** added an optional `stringParts` field to `Token`, carrying
  `Array<{ kind: 'raw'; text } | { kind: 'expr'; source }>` when a string literal contains
  interpolation; left `undefined` for the overwhelming majority of strings that don't, so nothing
  about a non-interpolated `STRING_LITERAL` token changes shape.
- **`compiler/src/lexer.ts`:** the `"` string-scanning branch now detects an *unescaped* `{`
  (an escaped `\{` still falls through the pre-existing backslash-escape fallback, exactly like
  `\"`/`\\` already did — no new escape convention was invented) and, on finding one, delegates to
  `readInterpolationSource()` to capture the raw expression source up to its balanced matching `}`
  (this already correctly handles a nested brace pair inside the expression, e.g. a struct literal
  like `{Point { x: 1, y: 2 }}`, by depth-counting rather than assuming the first `}` closes it —
  the same reasoning applied to the TextMate grammar fix several sessions ago). Also generalized
  `readInterpolationSource()`'s error message from `'Unterminated style interpolation'` to
  `'Unterminated interpolation'`, since it now serves two callers, not one — a one-line, symmetric
  improvement to both. A string with no unescaped `{` returns the exact same `STRING_LITERAL` token
  as before this session; behavior for the entire existing corpus of non-interpolated strings is
  provably unchanged (confirmed by the full, unmodified 179-test suite still passing after this
  layer alone).
- **`compiler/src/parser.ts`:** added a `parseInterpolatedStringParts(token)` helper mirroring
  `parseStyleDeclaration()`'s own expression-parsing loop, and updated all three (and only three)
  places a `STRING_LITERAL` token is consumed: `parsePrimary()` now returns a `TemplateString` expr
  when the token has interpolation parts (otherwise the same plain `StringLiteral` as before);
  `parseTemplateNodeInner()` now returns a `TextInterpolation` node wrapping a `TemplateString`
  (reusing the *existing* `TextInterpolation` `TemplateNode` kind — no new template-node variant
  needed); the plain-attribute-value branch now produces `{ isExpr: true, exprValue: TemplateString }`
  instead of a static `stringValue` when interpolated (reusing the *existing* `isExpr`/`exprValue`
  attribute shape — no new `Attribute` variant needed either). Reusing existing AST shapes this
  thoroughly meant the feature needed a total of one new `Expr` variant and zero new `TemplateNode`
  or `Attribute` variants.
- **`compiler/src/checker.ts`:** added a `TemplateString` case to `checkExpr` (recurses into each
  `expr` part exactly like `Binary`/`Call`/etc. already do for their sub-expressions — an
  identifier used inside an interpolation is checked the same as anywhere else) and to
  `inferLiteralType` (a `TemplateString` always infers as `string`). The `inferLiteralType` case is
  a genuine, if incidental, improvement over the status quo: before this session, an initializer
  that wasn't a bare literal returned `null` from `inferLiteralType` and skipped type-mismatch
  checking entirely (a pre-existing, `TODO.md`-documented limitation — see the "More precise
  diagnostic messages" note added two sessions ago); a `TemplateString` initializer now gets real
  type checking for free, e.g. `state<int> x = "count: {n}";` is correctly flagged as a type
  mismatch rather than silently accepted.
- **`compiler/src/codegen.ts`:** renamed `styleValuePartsToJs` to `interpolatedPartsToJs` (now used
  by both style values and the new `TemplateString` case, so the style-specific name no longer
  fit) and added a `TemplateString` case in `exprToJs` that calls it — an interpolated string
  compiles to a genuine JS template literal (`` `Hello, ${name.get()}!` ``), not a manually
  constructed `+`-concatenation chain.
- **New example + tests:** `compiler/examples/string_interpolation.crs` (interpolation in view
  text, an attribute, and escaped braces, on a component with reactive `state`);
  `compiler/scripts/test-string-interpolation.js` (a jsdom end-to-end test — mounts the compiled
  component, asserts the initial interpolated text/attribute render correctly, asserts escaped
  braces render literally, then clicks a button and asserts the interpolated text updates
  reactively); two new `compiler/scripts/fixtures/checker/` fixtures
  (`interpolated-string-undefined-identifier.crs`, `interpolated-string-type-mismatch.crs`) with
  matching `test-checker.js` cases. Wired the new e2e test into `package.json`'s `test` script
  chain, in the same position as the other page-mount tests.
- **Docs:** `docs/Crescent_Grammar.md` — added a formal `StringLiteral`/`StringPart`/`StringEscape`
  lexical grammar (§6, previously entirely unspecified beyond the bare `Literal` alternative); a
  new §2.4 disambiguation subsection for `{`/`}` inside a string literal, describing precisely how
  this differs from `MODE_VIEW`/`MODE_STYLE`'s interpolation (it's lexer-internal to one token, not
  a parser-visible mode transition); fixed a now-false claim in §7 ("No quoted-brace hybrid form is
  legal" — this was true before this session and is not anymore, so it was corrected rather than
  left stale, per `AGENTS.md`'s rule against a knowingly-incorrect grammar doc); and a "Resolved"
  entry in §10 cross-referencing all the new files. `docs/Crescent_Design.md` — new "String
  Interpolation" subsection under §2 (Type System & Variables), with the concatenation-equivalence
  explanation, the escaping rule, and an explicit note that formatting expressions (padding,
  decimal places) are a deliberately separate, deferred piece of `TODO.md` §12's original item, not
  bundled into this one.
- `TODO.md` §12: checked off "String interpolation," with a note on exactly what shipped and what
  (formatting expressions) is explicitly still open and why it's a separate, larger piece of work
  rather than an oversight.

**Files changed:** `compiler/src/ast.ts`, `compiler/src/tokens.ts`, `compiler/src/lexer.ts`,
`compiler/src/parser.ts`, `compiler/src/checker.ts`, `compiler/src/codegen.ts`,
`compiler/examples/string_interpolation.crs` (new),
`compiler/scripts/test-string-interpolation.js` (new),
`compiler/scripts/fixtures/checker/interpolated-string-undefined-identifier.crs` (new),
`compiler/scripts/fixtures/checker/interpolated-string-type-mismatch.crs` (new),
`compiler/scripts/test-checker.js`, `compiler/package.json` (test script chain),
`docs/Crescent_Grammar.md`, `docs/Crescent_Design.md`, `TODO.md`, `HANDOFF.md`.

**Tests:** `cd compiler && npx tsc --noEmit` (clean throughout — checked after each layer, not just
at the end). `npm test`: 185 PASS, 0 FAIL, exit 0 (up from 179 — 2 new checker-fixture cases plus 4
new e2e assertions in `test-string-interpolation.js`). The full existing suite (179 tests) was
re-run and confirmed passing after the lexer change alone, before any parser/checker/codegen
changes were made, specifically to isolate and confirm that non-interpolated strings are
byte-for-byte unaffected.

**Problems/Decisions:** The main design decision, stated explicitly above: reuse the `style{}`
interpolation mechanism rather than build a second one, and reuse existing AST shapes
(`TextInterpolation`, `isExpr`/`exprValue`) rather than add new `TemplateNode`/`Attribute` variants
— both choices were about keeping the diff small and consistent with the codebase's own
conventions, not about cutting corners on the feature itself (the feature is fully implemented,
checked, code-generated, and tested end to end, not a stub). Deliberately left out of scope:
formatting expressions (documented as future work, both in `docs/Crescent_Design.md` and
`TODO.md`); a would-be edge case where an interpolation's expression source itself contains a
nested string literal with a `{`/`}` inside it (e.g. `` {fn("a}b")} ``) is not specially handled —
`readInterpolationSource()`'s raw depth-counting doesn't know about nested string literals, exactly
the same pre-existing limitation `MODE_STYLE` interpolation already has, so this is not a new
regression, just an inherited, narrow edge case worth knowing about.

**Next:** `TODO.md` §16's priority order applies as always — pick the next item, whether that's
more §12 language-evolution work (destructuring is the natural next step per §12's own stated
dependency ordering, since tuples/pattern-matching both build on it) or a return to
hardening/testing work if that's judged more valuable right now. Either is legitimate per the
alternating-priorities framing from two sessions ago.

---

### Older session (documentation only)

**AI:** Claude

**Task:** The maintainer gave a structured list of ten core-language-evolution ideas (string
interpolation, destructuring, tuples, enums/ADTs, pattern matching, exhaustiveness diagnostics,
first-class function types, generics, interfaces/traits, and broader type-system polish) and asked
for them to be recorded in the project's docs as *important but not urgent*, with an explicit
instruction not to let the project get "stuck forever fixing things" instead of also evolving the
language — a direct response to the last several sessions, which were all checker regression-test
hardening.

**Result:**
- Restructured `TODO.md` §12 ("Language Features to Evaluate") around the maintainer's ten items,
  organized as a new "Core Language Evolution" subsection, roughly sequenced by real dependency
  (destructuring before tuples/pattern-matching; enums before `Result<T,E>`; pattern matching
  before exhaustiveness checking) rather than just transcribed in the order given — and
  cross-referenced each against what's already tracked elsewhere in `TODO.md` so nothing exists in
  two places with two different descriptions (e.g. "First-class function types" now explicitly
  notes its overlap with §5's existing "Function-type compatibility" checker item; "More powerful
  type-system features" notes its overlap with §5's existing "Flow-sensitive null narrowing" work).
  This superseded and absorbed four flatter, less-detailed bullets from an earlier session's
  version of this section (generics, function types, pattern matching, destructuring) rather than
  leaving duplicates.
- Added an explicit "important, not urgent" framing note at the top of §12, addressed to future
  sessions (including future instances of me), stating directly that hardening work has no natural
  end point and should not be used as a permanent excuse to defer language evolution — a healthy
  project alternates between the two. Added a short cross-reference to this from §16's "Current
  Priority Order" too, so the framing is visible from both the feature-list side and the
  task-selection side.
- Deliberately did **not** put this level of detail in `docs/Crescent_Design.md`: that document is
  the source of truth for *decided* semantics (per `AGENTS.md` §2), and every one of these ten
  items is explicitly undesigned/undecided (e.g. "decide whether interfaces and traits should be
  one concept or two" is itself listed as open work). Putting a decided-looking write-up in the
  design doc before any of this is actually designed would misrepresent the document's own stated
  purpose. `TODO.md` is the correct home for "important, not urgent, not yet designed" ideas — this
  matches how the maintainer's previous batch of future-direction ideas were handled two sessions
  ago.

**Files changed:** `TODO.md`, `HANDOFF.md`. No compiler/runtime/extension source touched — this was
a documentation/roadmap session per the maintainer's explicit request, not a code task.

**Tests:** Not applicable (no code changed). `git diff --check` run to confirm no whitespace issues.

**Problems/Decisions:** The one deliberate restructuring choice: grouped and lightly reordered the
maintainer's ten items by dependency rather than preserving their exact given order, since several
of them explicitly build on each other (this was called out per-item so the reasoning is visible,
not just imposed silently).

**Next:** No new code work implied by this session. `TODO.md` §16's priority order (with its new
note that hardening work shouldn't indefinitely crowd out §12) is still the right place to pick up
the next task — including, now more explicitly than before, a §12 "Core Language Evolution" item if
the next session judges the recent run of checker-hardening work sufficient for now.

---

### Older session

**AI:** Claude

**Task:** Continued the same `checker.ts` regression-coverage sweep, per the previous session's
"Next" note: check every `typeIsResolvable(...)` call site for fixture coverage.

**Result:**
- Enumerated all `typeIsResolvable` call sites in `checker.ts` (12 total, including the recursive
  helper itself) and cross-referenced each against `test-checker.js`. Found three genuinely
  untested-but-implemented paths, each distinguishable from an already-tested one only by *where*
  it fires (same message shape, different declaration context) — the existing tests' regex
  patterns don't check the `where` field, so a superficial grep for the message text alone would
  have missed that these were actually different code paths:
  - Component-level param type (`checkComponentDecl`'s own `for (const p of decl.params)` loop,
    `where = "component '...'"`) — previously only the *function*-param path (`fnWhere = "...,
    function '...'"`) had a fixture (`unknown-function-param-type.crs`).
  - Struct field type (`checkStructDecl`, "referenced by field").
  - `inject<T>` declared type (`checkComponentDecl`'s `InjectDecl` case, "referenced by inject").
- Added matching fixtures (`component-param-unknown-type.crs`, `struct-field-unknown-type.crs`,
  `inject-unknown-type.crs`) and three `test-checker.js` cases. All three passed against the
  existing, unmodified checker.
- While enumerating, noticed `state`/`derived`/`provide`/`const` declared types are the one
  category *not* checked via `typeIsResolvable` at all — `checkLiteralTypeMatch` only compares the
  declared type against the initializer's inferred type. Verified experimentally (a scratch
  `/tmp` fixture, not committed) that `state<BogusType> x = "hello";` still produces a diagnostic
  today, just a less precise one (`Type mismatch: declared as 'BogusType' but initialized with a
  'string' value` instead of `Unknown type 'BogusType'`). This is not a silent gap — an error does
  fire — so it didn't belong in this session's "add a test for existing behavior" scope; recorded
  as a concrete example under `TODO.md`'s existing (previously vague) "More precise diagnostic
  messages" bullet instead, per `AGENTS.md` §4 ("identify it ... explain the conflict ... only
  then change it" — the "only then change it" part is future work, not this session's).

**Files changed:**
- `TODO.md` (Types section: added a concrete example to the existing "More precise diagnostic
  messages" bullet; no checkbox states changed elsewhere this session — the three newly-tested
  paths all fall under the already-`[x]`-checked "Generic-aware type positions")
- `compiler/scripts/test-checker.js` (3 new test cases)
- `compiler/scripts/fixtures/checker/component-param-unknown-type.crs` (new)
- `compiler/scripts/fixtures/checker/struct-field-unknown-type.crs` (new)
- `compiler/scripts/fixtures/checker/inject-unknown-type.crs` (new)

**Tests:** `cd compiler && npx tsc --noEmit` (clean). `npm test`: 179 PASS, 0 FAIL, exit 0 (up from
176 before this session).

**Problems/Decisions:** The `state`/`derived`/`provide`/`const` type-resolvability gap described
above is a real, if minor, diagnostic-quality issue — not fixed this session, deliberately, since
it's new checker behavior (an additional `typeIsResolvable` call plus a decision about whether the
existing `Type mismatch` diagnostic should still fire alongside a new `Unknown type` one, or be
suppressed) rather than a test for something that already works as designed.

**Next:** Implementing the fix just described would be a good next small unit: add
`typeIsResolvable(m.type, globalScope)` alongside the existing `checkExpr`/`checkLiteralTypeMatch`
calls in `checkComponentDecl`'s `StateDecl`/`DerivedDecl`/`ProvideDecl`/`ConstDecl` case, decide
what the resulting message/severity should be when both an unresolvable type *and* a mismatched
initializer are present at once (probably: report `Unknown type` and skip the now-redundant `Type
mismatch` check for that declaration, since comparing against a type that doesn't exist isn't a
meaningful comparison), add a fixture, and update the `TODO.md` note accordingly. Beyond that, the
`typeIsResolvable` sweep is now complete; `TODO.md` §16's standing priorities (Null Safety's
flow-sensitive narrowing, or the Types section's remaining assignment-compatibility gaps) are the
next candidates if further coverage-sweeping is judged sufficient for now.

---

### Older session

**AI:** Claude

**Task:** Direct continuation of the previous session's own "Next" recommendation: sweep
`checker.ts` for more implemented-but-untested diagnostics, starting with the two it named —
`Cannot assign to derived '...'` and the direct-property-write-forbidden diagnostic, both inside
`checkAssignmentTarget` — and, per its explicit caveat, first check whether the existing
`test-forbidden-derived-assignment.js`/`test-forbidden-property-write.js` scripts already cover
them before assuming they don't.

**Result:**
- Confirmed those two existing test scripts exercise `codegen.ts`'s own independent
  `CodegenError` checks (calling `generateProgram()` directly on a parsed program, never running
  the checker), not `checker.ts`'s `checkAssignmentTarget` diagnostics. The two enforcement points
  are separate code paths with separate (if similarly-worded) error messages — the checker's own
  diagnostics genuinely had no regression coverage before this session, confirming the earlier
  session's guess.
- Added two new fixtures under `compiler/scripts/fixtures/checker/`
  (`derived-assignment-forbidden.crs`, `direct-property-write-forbidden.crs` — content mirrors the
  existing top-level `fixtures/forbidden-derived-assignment.crs`/`forbidden-property-write.crs`
  used by the codegen tests, since the same source naturally exercises both layers) and two
  matching cases in `compiler/scripts/test-checker.js` asserting the checker's own diagnostic
  messages (`Cannot assign to derived 'total'; ...` and `Direct property write on state 'user' is
  forbidden; ...`).
- Updated `TODO.md`'s Reactivity subsection: annotated "Restrictions on reactive object property
  mutation" (already checked `[x]`) with what's now actually covered and, importantly, flagged that
  codegen still duplicates both rules independently rather than the checker being the sole source
  of truth — this is a real (if minor) architectural duplication worth knowing about per `AGENTS.md`
  §9/§10, not something this session tried to fix, since collapsing it is a separate, larger unit
  of work (would mean deciding whether codegen should trust the checker having already run, which
  touches the CLI's compile pipeline, not just these two rules).

**Files changed:**
- `TODO.md` (annotation only)
- `compiler/scripts/test-checker.js` (2 new test cases)
- `compiler/scripts/fixtures/checker/derived-assignment-forbidden.crs` (new)
- `compiler/scripts/fixtures/checker/direct-property-write-forbidden.crs` (new)

**Tests:** `cd compiler && npx tsc --noEmit` (clean). `npm test`: 176 PASS, 0 FAIL, exit 0 (up from
174 before this session).

**Problems/Decisions:** Noticed but explicitly did not fix: `checker.ts` and `codegen.ts` each
independently re-derive and enforce the same two reactive-mutation rules. This isn't a bug today —
both layers currently agree — but it's a duplication that could silently drift if one side changes
without the other (e.g. a future new dependency of `total` that codegen's own check doesn't handle
the same way the checker's does). Recorded in `TODO.md` rather than acted on, since fixing it means
deciding whether `cli.ts`'s pipeline should skip codegen's own checks once the semantic checker has
already run cleanly — a design/architecture question, not a same-session fix.

**Next:** The rest of the sweep this session didn't get to: the `Unknown type` family already has
partial fixture coverage (`unknown-generic-type.crs`, `unknown-function-param-type.crs`,
`unknown-return-and-for-types.crs`) but it's worth double-checking every `typeIsResolvable(...)`
call site in `checker.ts` has at least one fixture exercising it (e.g. `InjectDecl`'s unknown-type
check doesn't appear to have one yet). Otherwise, `TODO.md` §16's next-highest items (Null Safety's
flow-sensitive narrowing, or the Types section's remaining assignment-compatibility gaps) remain
the standing priority once this kind of coverage sweep is judged sufficient.

---

### Older session

**AI:** Claude

**Task:** No explicit instruction — picked up `TODO.md` §16's priority order (fix
spec/implementation contradictions, strengthen the semantic checker, add regression tests). The
previous session's own "Recommended Next Step" #4 specifically flagged "Undefined-name diagnostics"
as plausibly already implemented and just needing verification; investigating that turned up a
broader pattern worth the same treatment: `TODO.md`'s §5 "Components" subsection listed five items
as entirely `[ ]` unstarted, but reading `checker.ts` showed three of them (component existence
checking, component prop checking, and most of component declaration checking) were already
substantially implemented and simply untested/undocumented.

**Result:**
- Confirmed via `checker.ts` inspection, not assumption, exactly what already exists:
  - `checkExpr`'s `Identifier` case (used for every expression context — reads, assignment targets,
    view interpolations, function arguments, etc.) already flags any name that isn't in scope,
    global scope, or `BUILTIN_GLOBALS`. This is "Undefined-name diagnostics" (§5 Scope/Names),
    confirmed genuinely general-purpose, not narrowly scoped to the one assignment-target fixture
    that existed before this session.
  - `checkTemplateNode`'s `Element` case already reports `Unknown component '<Tag>'` for a
    nonexistent component name, `'Tag' is a struct, not a component...` when a struct name is used
    as an element, and `Unknown prop 'x' passed to <Tag>` for an undeclared prop (in addition to
    the already-tested "Missing prop"/type-mismatch cases). This is "Component existence checking"
    and most of "Component prop checking" (§5 Components).
  - `checkComponentDecl` already rejects a component with zero or more than one `view` block, on
    top of the already-tested duplicate-member-name check. This is most of "Component declaration
    checking" (§5 Components).
- Added 6 new fixtures under `compiler/scripts/fixtures/checker/` and 6 corresponding cases in
  `compiler/scripts/test-checker.js`, each asserting the exact diagnostic message and exercising a
  behavior that had no regression coverage before this session: `undefined-identifier-read.crs`
  (a plain read of an undefined name in a view interpolation, to complement the existing
  assignment-target fixture), `unknown-component.crs`, `struct-as-component.crs`,
  `unknown-prop.crs`, `missing-view-block.crs`, `duplicate-view-block.crs`. All six pass against
  the existing, unmodified checker — no compiler behavior changed this session, only test coverage
  and documentation accuracy.
- Updated `TODO.md` §5's "Scope / Names" and "Components" subsections to check off the
  now-verified-and-tested items, with a short note next to each pointing at the fixture(s) that
  cover it and, where relevant, what's explicitly still *not* covered (e.g. undefined-name
  diagnostics don't cover cross-module resolution; component prop checking exempts `on*` attributes
  entirely rather than validating them, which is exactly why "Event handler signature checking"
  is still unchecked). Removed the separate "Component argument checking" bullet, folding it into
  "Component prop checking" — components don't have a distinct "argument" concept apart from props
  in Crescent's current design, and the two bullets described the same behavior.

**Files changed:**
- `TODO.md` (checkbox/documentation accuracy only — see above)
- `compiler/scripts/test-checker.js` (6 new test cases)
- `compiler/scripts/fixtures/checker/undefined-identifier-read.crs` (new)
- `compiler/scripts/fixtures/checker/unknown-component.crs` (new)
- `compiler/scripts/fixtures/checker/struct-as-component.crs` (new)
- `compiler/scripts/fixtures/checker/unknown-prop.crs` (new)
- `compiler/scripts/fixtures/checker/missing-view-block.crs` (new)
- `compiler/scripts/fixtures/checker/duplicate-view-block.crs` (new)

**Tests:** `cd compiler && npx tsc --noEmit` (clean). `npm test`: 174 PASS, 0 FAIL, exit 0 (up from
168 before this session — 6 new cases, all passing on the first real run since they test existing,
unmodified behavior rather than new code).

**Problems/Decisions:** None requiring resolution. The main judgment call was scope: rather than
also adding tests/checkboxes for every other untested diagnostic in the checker (there are more —
e.g. `Cannot assign to derived`, `Direct property write on state ... is forbidden`, the
`Unknown type` family for params/returns/for-loops which already has partial coverage), this
session stayed focused on the Components subsection plus the one Scope/Names item the previous
session explicitly flagged, per `AGENTS.md` §4 ("make small coherent changes") and §15 ("one
feature ... over large unrelated rewrites"). The remaining untested-but-implemented diagnostics are
a reasonable, well-scoped follow-up in the same spirit.

**Next:** A natural continuation, if VS Code/tooling work isn't the priority: sweep the rest of
`checker.ts` for other implemented-but-untested/unchecked diagnostics using the same method (read
the code, don't assume the checklist is accurate, add a fixture + test case, then correct the
checkbox) — `Cannot assign to derived '...'` and the direct-property-write-forbidden diagnostic
(both in `checkAssignmentTarget`) are the most obvious candidates, and would round out the
Reactivity subsection's "Restrictions on reactive object property mutation" claim with real
regression coverage rather than relying on it having been exercised only via `forbidden-derived-
assignment.js`/`forbidden-property-write.js` (which test *codegen*/runtime behavior, not that the
checker itself reports the right diagnostic message — worth double-checking whether those already
cover it before assuming they don't). Otherwise, `TODO.md` §16's next-highest items (Null Safety's
flow-sensitive narrowing, or the Types section's remaining assignment-compatibility gaps) remain
open.

---

### Older session

**AI:** Claude

**Task:** The maintainer pasted an external review/brainstorm document (someone else's analysis of
where Crescent could go next — compiler architecture, LSP, dev server/hot-reload, `Result`/pattern
matching, ecosystem ideas, self-hosting, etc.) and asked for its ideas to be organized into the
project's existing `TODO.md`/roadmap rather than left as a one-off message, with freedom to adjust
or complement the ideas rather than transcribe them verbatim. Separately, asked for the top-level
`README.md`'s VS Code Extension bullet to be reworded: it listed specific current commands
(`Crescent: Check`/`Crescent: Build`) and was flagged as already out of date (`Crescent: Preview`
and `Crescent: Open Preview in Browser` exist too, per the last two sessions) — the maintainer's
point was that the top README should stay static/high-level like its other three bullets, not
restate implementation details that drift out of sync as commands are added.

**Result:**
- Read the pasted document and cross-checked every idea against the current implementation
  (`grep`ed for `on_mount`/`on_change`/`on_destroy` etc. to confirm which lifecycle hooks actually
  exist, confirmed no `Result`/pattern-matching/router/typed-AST support exists yet) and against
  `TODO.md`'s existing structure, so nothing was added as a duplicate of something already tracked.
  Distributed the ideas into the existing numbered sections rather than dumping them as one new
  block, matching the roadmap's own stated principle ("organized by dependency and maturity rather
  than cool features first"):
  - §5 Semantic Checker: new "Architecture" subsection for an eventual typed-AST/IR pass (resolve
    names → resolve modules → infer/check types → validate reactivity → typed AST → codegen),
    framed as a foundation for codegen, a future LSP, and future optimizations rather than a
    feature of its own.
  - §7 Runtime: a note under "Reactive Core" about evaluating additional primitives (e.g. a
    `resource`-style async-reactive shape) only once async semantics settle, explicitly requiring
    justification against `state`/`derived`/`effect`/`watch` rather than copying other frameworks;
    a new "Lifecycle" subsection recording that only `on_mount`/`on_change` exist today and that
    `on_destroy`/`before_update`/`after_update` should only be added if a real need shows up.
  - §9 Testing: new "Compiler Robustness" (fuzzing the lexer/parser so it never crashes on garbage
    input; a compiler benchmark suite) and "Conformance" (a `tests/valid`/`tests/invalid` fixture
    suite with declared expected outcomes) subsections.
  - §10 Developer Experience: new "Project Scaffolding & Dev Server (Later)" subsection —
    `crescent new`, `crescent.toml`, `crescent dev`, hot-module-reload for the preview/dev loop
    (explicitly contrasted with today's full-webview-reload `Crescent: Preview`), and incremental
    compilation — placed *before* the existing "Near-Term VS Code Enablement" block with an
    explicit warning not to start it before the compiler/CLI/semantic-checker foundations are
    solid. Also cross-referenced incremental compilation from the existing "Language Server"
    subsection as a real prerequisite, not parallel work.
  - §11 Frontend Output: SSR added under "Future," with the same "don't add a second target before
    semantics stabilize" reasoning already stated there for Wasm.
  - §12 Language Features to Evaluate: expanded "Pattern matching" and "Better error/result
    conventions" with a concrete `Result<T, E>` sketch (the two motivate each other); added router,
    an official component library (framed as a stress test for the language, not a UI-work item),
    and compiler-assisted accessibility warnings (framed as "helps avoid mistakes," not "solves
    accessibility"); tightened the existing "Compile-time/meta-programming" bullet to explicitly
    say post-v1.0 and why. Closed the section with the document's strongest idea verbatim in spirit
    — every proposal here should answer "why is this especially good *in Crescent*", not "language
    X has this too" — since it's a good complement to §13's existing "don't add casually" list
    without duplicating it.
  - §14 Milestones: new "Someday / Maybe" subsection for self-hosting (rewriting compiler stages in
    Crescent itself) and a note to revisit the Wasm question alongside it — explicitly framed as
    not scheduled and not influencing near-term priority.
  - Deliberately did **not** add: a package manager beyond the existing "module/package ecosystem"
    bullet (already adequately hedged), or a separate "External Feedback" dump section — the
    document's ideas belong at the level of the concepts, integrated with what's already tracked,
    not attributed to a specific external source inside the roadmap itself.
- `README.md`: reworded the VS Code Extension bullet from enumerating specific commands to
  "Editor support for `.crs` files — see its README for the current feature set and commands,"
  matching the descriptive-not-enumerative style the other three bullets already use (design doc:
  "reactivity model, type system, ..."; grammar doc: "EBNF grammar, lexer modes, ..."; compiler
  doc: "how to build, test, and run"). This should not need touching again every time a VS Code
  command is added or renamed — that's exactly the property the maintainer asked for.

**Files changed:** `TODO.md`, `README.md`, `HANDOFF.md`. No compiler, runtime, or extension source
touched — this was a documentation/roadmap session per the maintainer's explicit request, not a
code task, so `AGENTS.md` §12's test commands were not applicable; confirmed no source files
appear in `git diff --stat` for this session beyond the three doc files above.

**Tests:** Not applicable (no code changed). `git diff --check` run to confirm no whitespace issues
in the modified Markdown files.

**Problems/Decisions:** None — this was integration of already-reasonable external ideas into an
existing, well-organized roadmap, not a design decision requiring resolution. The one deliberate
change from the source document: it proposed a single linear "Phase 1–5" plan as a wholesale
replacement mental model; this was not adopted as a new top-level structure, since `TODO.md`
already has an equivalent (§14 "Milestones" + §16 "Current Priority Order") and duplicating it
under a different name would create two competing sources of sequencing truth.

**Next:** No new code work was started or implied by this session. The next AI should still pick up
`TODO.md` §16's priority order (semantic checker first) unless the maintainer gives an explicit new
instruction — none of this session's roadmap additions are meant to be picked up next; they are
long-term context, most of them explicitly gated behind current work.

---

### Older session

**AI:** Claude

**Task:** Maintainer-reported preview/editor polish, requested directly: (1) remove the leftover
"Crescent Preview"/component-name/file-path chrome the maintainer said they were still seeing atop
the rendered preview; (2) remove an unexplained horizontal rule appearing below their own rendered
content; (3) fix TextMate syntax highlighting so a tag's closing `>`/`/>` is colored like the rest
of the tag punctuation (`<`, `</`) instead of like the `>`/`>=` comparison operator.

**Result:**
- (1) Inspected `compiler/src/webPreview.ts` at HEAD: the `<h1>Crescent Preview</h1>` and per-mount
  `<h2>{name}</h2>`/`<p>{file}</p>` chrome the maintainer described was already removed in the
  prior session's commit `db5b3c0` ("feat: Add Icon and Polish Preview") — confirmed by `grep`ing
  the whole repo for that literal markup (none found) and by reading the commit's diff. No further
  compiler-side change was needed for this part; the maintainer's screenshot most likely reflects a
  stale local build (an unrebuilt `compiler/dist/` and/or a cached VS Code webview panel HTML from
  before pulling `db5b3c0`) rather than a regression at HEAD. Flagged this to the maintainer rather
  than silently assuming it — see `AGENTS.md` §4 ("Do not invent language semantics"/verify before
  changing) and §18 (inspect actual repo state, not a summary).
- (2) Found the real, still-open bug behind the horizontal rule: `webPreview.ts`'s page stylesheet
  had a bare `section { margin: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }`
  rule, originally meant only for the tool's own `<section class="crs-preview-warnings">`/
  `<section class="crs-preview-empty">` wrapper blocks (skipped-files, bundling-failure, empty-
  project messages). Because it targeted the bare `section` element rather than a class, it also
  applied to any `<section>` tag a *user's own* Crescent component renders in its view — exactly
  the maintainer's case (a `<section>` around their counter's UI), which is why only their content
  showed the rule and not a `<div>`-based layout. Fixed by renaming the rule to a
  `.crs-preview-box` class added to the tool's own wrapper `<section>` elements only, leaving a
  user's own `<section>` (or any other tag) with no injected default page styling.
- (3) Root cause: `editors/vscode/syntaxes/crescent.tmLanguage.json`'s `tags` rule only tokenized
  the opening `<`/`</` and the tag name, matching them once and stopping; the closing `>` (and the
  `/>` of a self-closing tag) was left for the root `operators` rule to pick up, which colors it
  identically to the `>`/`>=` comparison operator — the actual bug the maintainer's screenshot
  showed (white, not gray). Fixed by turning `tags` into a `begin`/`end` rule: `begin` still
  matches `<`/`</` + tag name exactly as before (same negative-lookbehind guard against `state<int>`
  generics), and `end` matches `/?>`, both captured as `punctuation.definition.tag.crescent` so the
  whole tag's punctuation is visually consistent. A new `tag-interpolation` sub-rule (a recursive
  `{`/`}` `begin`/`end`, included inside `tags`) ensures a `>`/`>=` comparison or a nested struct
  literal inside an attribute's `{...}` expression (e.g. `<HelloPoint p={Point { x: item, y: item }}/>`)
  is consumed as its own nested region before the outer tag's `end` pattern ever sees it, so it
  can't prematurely close the tag or get mis-highlighted. The dead standalone
  `punctuation.terminator.tag.crescent` rule for a bare `/>` (now unreachable, since the tag rule's
  own `end` consumes it first) was removed to avoid two rules claiming the same token.
  Verified (scratch-only, not committed — see below) with `vscode-textmate`/`vscode-oniguruma`
  against: a self-closing component tag with a nested-brace/struct-literal attribute expression
  (`<HelloPoint p={Point { x: item, y: item }}/>` — confirmed the trailing `/>` and every inner
  `{`/`}` tokenize correctly, no premature tag close); a text-interpolated child (`<p>...{item}</p>`
  — confirms plain in-between `{item}` text interpolation, outside any tag's attribute list, is
  untouched by this change); `state<int>` (confirms the generic-vs-tag guard is unaffected); and
  two bare comparison lines (`if (count < 5)`, `if (a > b && c >= d)`) confirming ordinary
  comparison operators outside a tag are still `keyword.operator.crescent`, not tag punctuation.

**Commit:** Not committed at the time — working tree contains the diff described above (modified
`compiler/src/webPreview.ts`, `editors/vscode/syntaxes/crescent.tmLanguage.json`).

**Tests:** `cd compiler && npx tsc --noEmit` (clean); `npm test` (168 PASS, 0 FAIL, exit 0 —
unchanged count; both changes are non-functional-surface — a CSS class rename and a grammar-only
fix — so no assertion was expected to change). Grammar fix verified with a scratch
`vscode-textmate`/`vscode-oniguruma` tokenizer script (not committed to the repo — this remains a
real, standing gap per a previous session's "Recommended Next Step" #3: a committed TextMate
tokenization test would catch a future regression here automatically instead of relying on manual
verification each time).

**Problems/Decisions:** The "Crescent Preview" header the maintainer reported is not reproducible
against the current `develop` HEAD; this is noted rather than silently "fixed" again, since
re-touching already-correct code without a reproducible cause would risk masking the real issue
(a stale local build) instead of pointing the maintainer at it.

**Next:** Ask the maintainer to rebuild (`cd compiler && npm run build`) and fully reload/reopen
the preview panel (or reload the VS Code window) to confirm the header is in fact already gone at
HEAD; if it still appears after a clean rebuild, that would mean this session's read of the code is
missing something and needs re-investigation with the maintainer's exact repro steps. Committing a
real TextMate-tokenization regression test (see "Recommended Next Step" #3 in the previous entries)
would be a good small follow-up given this session found and fixed a real coloring bug there.

---

### Older session

**AI:** Claude

**Task:** `Crescent: Preview` for the VS Code extension (`TODO.md` §10, "Near-Term VS Code
Enablement" plan's last unstarted feature bullet besides continuous diagnostics and the LSP
replacement) — the maintainer's explicit next step, requested via a plain "continue" after
reading `AGENTS.md`/`HANDOFF.md`/`TODO.md`. Followed, across the same sitting after each round
was committed and reviewed, by three further requests: a second command to open the preview in a
real browser tab instead of only a VS Code webview panel; removing the preview page's visible
"Crescent Preview"/component-name/file-path chrome once the maintainer actually looked at the
rendered output; and a file icon for `.crs` files.

**Result:** Done. New `compiler/src/webPreview.ts` exports `buildPreviewHtml(root, outDir)`:
builds the project via the existing `buildProject()`, bundles each compiled file with `esbuild`
(same technique `scripts/build-web.js` already used, generalized off a hard-coded target list),
and mounts every top-level **zero-parameter** component (verified to exactly match
`build-web.js`'s hand-picked target list across all of `compiler/examples/`) into one HTML page.
Each mount is wrapped in its own try/catch so a component that needs an ancestor `provide<T>` it
doesn't have (`inject<T>` with nothing providing it — a preview root has no ancestors by
definition) shows an inline error without crashing the rest of the page; a project where every
file fails semantic checking still produces a valid, empty preview rather than throwing. Wired up
via a new `crescent.preview` command in `editors/vscode/src/extension.js`, following the exact
same `findDistDir()`/in-process-`require()` pattern the diagnostics feature already established
(`findWebPreviewModulePath()`/`loadWebPreviewModule()`) — opens a `WebviewPanel` on first run,
replaces its HTML and reveals it on later runs, and auto-reloads (without stealing focus) on save/
open of a `.crs` file, scoped to only affect a preview panel built from the *same* project root.
Added a real, committed automated test (`compiler/scripts/test-preview.js`, now in `npm test`) for
the compiler-side half — including a `jsdom` test that actually clicks a real `Counter` inside the
generated preview page — plus manual verification of the VS Code command with an extended
mock-`vscode` harness (`WebviewPanel` mock). Testing caught two real bugs before they shipped: (1)
no try/catch around mount calls, so `provide_inject.crs`'s `DeepNestedWidget`/`Dashboard` crashed
the whole page; (2) the command handler read `result.build.fatal` instead of the correctly-nested
`result.build.check.fatal`, so every fatal-error case printed a bare "unknown error" instead of the
real message — both fixed and re-verified. Updated `editors/vscode/README.md` (new "Preview"
section, updated intro/settings/"Known limitations"), `compiler/README.md` (structure list), and
`TODO.md` (checked off the bullet). The maintainer committed this part as `3684f51`
("feat: Add preview"). The browser-open follow-up — extracted the shared build/error-
reporting logic into `buildPreviewResult(root)`, added `openPreviewInBrowser(root)` and a
`crescent.previewInBrowser` command that writes the same HTML to
`<root>/<crescent.outDir>/preview/index.html` and opens it via `vscode.env.openExternal()` — needed
no compiler-side changes at all, since `buildPreviewHtml()`'s output was already a plain,
self-contained HTML string with no webview-specific assumptions baked in. Verified the same way
(mock-`vscode`, now with an `env.openExternal` mock): correct file written, correct URI opened, no
webview panel created, and the same fatal-error path re-verified through the new shared helper.
The maintainer committed this part too, as `c51415a` ("feat: Add preview in browser"). Then, once
the maintainer actually saw the rendered page: removed the page's visible `<h1>Crescent
Preview</h1>` and per-mount `<h2>{name}</h2>`/`<p>{file}</p>` chrome from `webPreview.ts`,
replacing them with invisible `data-crescent-component`/`data-crescent-file` attributes on each
mount `<div>` (kept for debuggability without being printed on the page); and added a file icon
for `.crs` files — copied `assets/crescent-logo.svg` into `editors/vscode/icons/` and wired it up
via `contributes.languages[0].icon` in `package.json`, VS Code's own documented mechanism for a
language-level fallback file icon. This last round is **not yet committed**.

**Commit:** The panel command (`webPreview.ts`, `crescent.preview`, and the associated docs/tests)
was committed by the maintainer as `3684f51` ("feat: Add preview"). The browser-open command
(`crescent.previewInBrowser`, `buildPreviewResult()`, `openPreviewInBrowser()`) was committed as
`c51415a` ("feat: Add preview in browser"), on top of `3684f51`/`b47d2e9`/`b57be3f`/`4f51112`/
`4e6f485` — this repo's actual `develop` HEAD as of this writing. The chrome-removal and file-icon
round on top of `c51415a` is **not committed**: working tree contains modified
`compiler/src/webPreview.ts`, `editors/vscode/package.json`, `editors/vscode/README.md`,
`HANDOFF.md`, plus the new `editors/vscode/icons/crescent-logo.svg`.

**Tests:** `cd compiler && npx tsc --noEmit` (clean); `npm test` (168 PASS, 0 FAIL, exit 0 — up
from 145; the 23 new assertions are `test-preview.js`, every pre-existing assertion unchanged;
unchanged again after the browser-open command and the chrome removal, neither of which added or
removed any assertions — `test-preview.js`'s `Counter` checks query the `<h1>` the *component*
itself renders, not the page chrome that was removed). Manually verified the VS Code command
end-to-end for both the panel (creation/reuse/reveal, the fatal-error popup path with the real
parser message, and that a saved `.crs` file in the *same* project reloads an already-open panel)
and the browser-open command (correct file written, correct URI passed to `openExternal`, no panel
created, fatal-error path unaffected by the refactor) via the mock-`vscode` harness — see "Manual
verification" in "Last Completed Work" for the specific scenarios and the two bugs each one caught
for the panel command. No automated suite covers `editors/vscode/` itself yet — see "Recommended
Next Step" #3 for making that a real, committed test.

**Next:** Continuous/on-change diagnostics, multi-root diagnostic partitioning, and the LSP
replacement are all still open under `TODO.md` §10 — see "Recommended Next Step" #2 for specifics
on each. A committed test harness (`cli.ts` itself, the TextMate grammar, or the extension's
diagnostics/command-wiring logic — see "Recommended Next Step" #3) would also be a good small unit
if VS Code work isn't picked up immediately. If the maintainer likes the browser-open command,
worth considering whether it should also support a lightweight local HTTP server (instead of a
bare `file://` URL) for cases where `file://` script execution is restricted by browser security
settings — not attempted here since a plain `file://` page already works for the verified case.
The maintainer should confirm the `.crs` file icon actually renders correctly in a real VS Code
Explorer pane (light and dark themes) — this environment can't launch a real VS Code window to
check that visually, only that the JSON/SVG are well-formed and the mechanism matches VS Code's
documented API.

---

### Previous session

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

**Commit:** Not committed at the time — working tree contained the diff described above (modified
`compiler/src/lexer.ts`, `compiler/src/parser.ts`, `compiler/src/modules.ts`,
`compiler/src/project.ts`, `compiler/src/cli.ts`, `compiler/src/index.ts`,
`editors/vscode/src/extension.js`, `editors/vscode/README.md`, `editors/vscode/package.json`,
`TODO.md`, `HANDOFF.md`), on top of the previous two sessions' already-committed CLI and minimal-
extension work (`4e6f485`, `4f51112`) plus the maintainer's own `b57be3f` (`.vscode/launch.json`).
Since committed by the maintainer as `b47d2e9` ("feat: Add diagnostics").

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

### Older session

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

**Next:** Diagnostics-in-editor (done — see "Older session" below, then superseded by "Previous
session" and "Latest session" above).

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
