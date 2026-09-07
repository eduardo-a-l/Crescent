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
Just completed: `Crescent: Preview` for the VS Code extension (`editors/vscode/`) — a new
`compiler/src/webPreview.ts` builds a project and bundles its previewable components (via
`esbuild`) into a single HTML page, `require()`d in-process by a `crescent.preview` command
that opens/reloads a webview panel, plus a `crescent.previewInBrowser` command
("Crescent: Open Preview in Browser") that builds the identical HTML but opens it in a real
system browser tab instead (both commands, and the diagnostics/webPreview.ts work behind them,
are now committed — see "Last Completed Work"/"Session Log"). Two smaller follow-ups on top,
**not yet committed**: the generated page no longer has visible "Crescent Preview"/component-
name/file-path chrome above each mounted app, just the rendered component(s); and `.crs` files
now get a file icon (`editors/vscode/icons/crescent-logo.svg`, via
`contributes.languages[].icon`). See "Last Completed Work" below for both. Choose the next item
from `TODO.md` before beginning new work — the maintainer's stated plan was CLI → VS Code
support → real project testing → broader language features (enum, match, etc); there is no
"playground" step (an earlier session's summary of this plan mentioned one, which was
inaccurate — corrected here). Continuous/on-change diagnostics, multi-root diagnostic
partitioning, and the LSP replacement (`TODO.md` §10) are also still open if the maintainer
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
