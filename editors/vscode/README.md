# Crescent for VS Code (v0.2)

A VS Code extension for the Crescent language: `.crs` file association, syntax highlighting,
comment/bracket/indentation configuration, in-editor diagnostics on save/open, and four commands
that work with the `crescent` compiler (`compiler/src/cli.ts` — see `compiler/README.md`).

This covers the first two bullets, plus the `Crescent: Preview` bullet, of the "Near-Term VS Code
Enablement (v0.x)" plan in the repository root's `TODO.md` (§10). There is still no language
server — see "Known limitations / next steps" below. What you get today:

- `.crs` files are recognized as the "Crescent" language.
- A file icon for `.crs` files (`assets/crescent-logo.svg`, copied to `editors/vscode/icons/` so
  the extension is self-contained) — see "File icon" below for the one real caveat.
- Syntax highlighting (see "What the grammar highlights, and what it deliberately doesn't" below).
- Matching comments (`//`, `/* */`), bracket matching/auto-closing for `{}`, `[]`, `()`, and basic
  brace-based auto-indent.
- **In-editor diagnostics** — parser, module, and semantic-checker errors/warnings show up as
  squiggly underlines when you save or open a `.crs` file (see "Diagnostics" below for exactly
  when and how).
- **Crescent: Check** — runs `crescent check <project root>` and prints its output (diagnostics,
  summary line, exit code) to a "Crescent" output channel.
- **Crescent: Build** — runs `crescent build <project root> --out-dir <root>/<crescent.outDir>`
  the same way.
- **Crescent: Preview** — builds the project and bundles every previewable component into a live
  webview panel (see "Preview" below for exactly what gets mounted and when it reloads).
- **Crescent: Open Preview in Browser** — the same build/bundle, written to a real `index.html`
  file and opened in your actual default browser instead of a VS Code webview panel (see
  "Preview" → "Opening it in a real browser" below).

## File icon

`contributes.languages[0].icon` in `package.json` points `.crs` files at
`editors/vscode/icons/crescent-logo.svg` (the same file as the repo root's
`assets/crescent-logo.svg`, copied in rather than referenced by a `../../` path, so the extension
still works if it's ever packaged/published on its own outside this monorepo). One real caveat,
straight from [VS Code's own file-icon-theme docs](https://code.visualstudio.com/api/extension-guides/file-icon-theme):
a language's `icon` is only a **fallback**. If the person's currently-active File Icon Theme (Seti,
the various "Material Icon Theme"/"vscode-icons" community themes, etc.) already defines its own
icon for a file — by extension, filename, or language ID — that theme's icon wins; ours is only
shown when the active theme falls back to a generic icon for the language. In practice this means
it *will* show up for effectively everyone, since no icon theme has ever heard of `.crs` — but it's
not an unconditional override, and a future theme update that adds its own `.crs` icon would take
over from ours. There's no VS Code API to force our icon to win over an active theme's own
choice — that's deliberate on their end, not a gap here.

## Running it during development

There's no build step for the extension itself (plain JS, no bundler) — but diagnostics and
**Check**/**Build**/**Preview** all need the *compiler* built first:

```
cd ../../compiler && npm run build
```

Then, from the repository root, open the whole `Crescent` repo in VS Code and press `F5` — the
root `.vscode/launch.json` ("Launch Extension") launches an "Extension Development Host" window
with this extension active. Open a folder containing `.crs` files in that window (e.g.
`compiler/examples`) to try it. (You can also run
`code --extensionDevelopmentPath=editors/vscode --new-window compiler/examples` from the repo root
without the debugger attached.)

## Settings

- `crescent.cliPath` (string, default `""`) — path to a compiled `compiler/dist/cli.js`, or a bare
  command available on `PATH` (e.g. `crescent`, after running `npm link` inside `compiler/`). When
  empty, the extension walks up from the open folder looking for a sibling `compiler/dist/cli.js`
  — this matches this monorepo's own layout, so **Check**/**Build**/diagnostics all work out of
  the box when developing Crescent itself (after `cd compiler && npm run build`). Consumers outside
  this monorepo will need to set this explicitly until the compiler is published as an npm package.
  Diagnostics and **Preview** specifically need a *path* here (or the auto-detected one) — both
  `require()` the compiler in-process (`project.js`/`webPreview.js`), so a bare command on `PATH`
  gives the extension no directory to find those next to, and they fall back to reporting that the
  compiler couldn't be loaded rather than guessing a location; **Check**/**Build** still work fine
  with a bare command, since those just spawn it.
- `crescent.outDir` (string, default `"dist"`) — output directory for **Crescent: Build**, relative
  to the project root passed to the CLI. **Preview** compiles into a `preview/` subdirectory of
  this same setting (`<root>/<crescent.outDir>/preview`), so it never clobbers a **Build** run's
  own `gen/`/`runtime.js`.

## Diagnostics

Diagnostics are recomputed by calling `checkProject()` (`compiler/src/project.ts`) **in-process**
(via `require()`ing the compiled `compiler/dist/project.js`, not by spawning and parsing the CLI's
text output — that keeps the mapping to `vscode.Diagnostic` exact instead of re-parsing formatted
strings) whenever you **save** or **open** a `.crs` file. There is no continuous/on-change
checking yet — that's still open, see "Known limitations" below.

- Each run re-checks **every** `.crs` file under the project root (the saved/opened file's
  workspace folder, or its own directory if there's no workspace folder open), not just the one
  file — correct, since things like a duplicate-declaration or undefined-name diagnostic can
  depend on another file via `use` imports. A side effect: diagnostics for a *different* open
  project in a multi-root workspace are cleared until that project is itself saved/opened again.
  There's no per-root partitioning of the diagnostic collection yet.
- Every diagnostic underlines the **whole line** — `checker.ts`'s `Diagnostic` type only carries a
  line number, not a column, so there's nothing more precise to underline yet.
- A parser or lexer error (`LexError`/`ParseError`) is attributed to the specific file that failed
  to parse (`modules.ts`'s `loadAllPrograms()` now attaches the file before rethrowing) and shown
  as a diagnostic on that file. A module-level error (an import cycle, or `use`-ing a name that
  isn't exported) doesn't point at one canonical file, since it inherently involves at least two
  (see `FatalDiagnostic` in `project.ts`) — its message already names them, so it's shown as a
  popup error instead of being attributed to a guessed file.
- Diagnostics reflect what's **on disk**, not unsaved editor buffers — expected for an on-save
  trigger, but means an unsaved edit won't update the squiggles until you save again.
- If the compiler is rebuilt while an Extension Development Host window is still running, Node's
  module cache keeps using the old `project.js` until that window is reloaded — a normal
  edit-the-extension-itself dev-loop wrinkle, not something an end user would hit.

## Preview

**Crescent: Preview** builds the project (`buildProject()`, same as **Build**) and then bundles
each successfully-compiled file with `esbuild` (`compiler/src/webPreview.ts`'s `buildPreviewHtml()`,
`require()`d in-process the same way diagnostics `require()`s `project.js`) into a webview panel
titled "Crescent Preview".

- Only **top-level components declared with zero parameters** are mounted as preview roots — a
  component that takes parameters (e.g. `component Card(Point origin)`) exists to be used as
  `<Card origin={...}>` inside another component's view, and the preview has no way to invent a
  value for `origin`. This matches, component-for-component, the hand-picked target list
  `compiler/scripts/build-web.js` already used for `compiler/examples/`.
- The page itself has no visible chrome — no "Crescent Preview" title, no per-component heading or
  file-path label above each mount, just the rendered component(s) as they'd actually look
  deployed. The component name and source file are still attached to each mount as invisible
  `data-crescent-component`/`data-crescent-file` attributes (visible in devtools or by viewing the
  page source) for anyone debugging a multi-component preview, but nothing is printed on the page.
- A zero-param component can still fail once mounted standalone — most commonly `inject<T>`
  (design doc §12) with no ancestor `provide<T>` in the mounted subtree, since a preview root has
  no ancestors. Each mount is wrapped individually, so a failing root shows an inline "Preview
  error: ..." message in its own place instead of taking down the rest of the page.
- A file that fails semantic checking is skipped for codegen the same way **Build** skips it (see
  `compiler/README.md`), and listed under a "Skipped files" section at the top of the preview page
  instead of silently disappearing.
- A **fatal** error (a parse/lexer error, or a module-level error like an import cycle) has no
  partial output to show, same as diagnostics' `FatalDiagnostic` case — it's reported as a popup
  error instead of opening an empty panel.
- Running the command again re-runs the build and replaces the existing panel's content in place
  (it does not open a second panel) and brings it to the front. Saving or opening a `.crs` file
  also triggers this same rebuild-and-replace *without* bringing the panel to the front, so it
  doesn't steal focus from the editor while you're actively working — but only for the project the
  currently-open panel was itself built from, so a save in a different open project (multi-root
  workspace) doesn't silently swap out what the panel is showing.
- Like diagnostics, this reflects what's **on disk**, and a compiler rebuilt mid-session needs an
  Extension Development Host reload to be picked up (same module-cache caveat as above).
- There's no CSS/HMR-style partial reload — each refresh replaces the entire webview HTML, so any
  local UI state inside a previewed component (e.g. a `Counter`'s current count) resets on every
  save. That's a real trade-off of the panel-replace approach, not an oversight; a persistent dev
  server with real hot-module-reload is a larger, separate piece of work (see "Known limitations"
  below).

### Opening it in a real browser

**Crescent: Open Preview in Browser** builds the exact same HTML as **Crescent: Preview**
(`buildPreviewResult()` in `extension.js` is the shared build step behind both commands), but
instead of a VS Code webview panel it:

- Writes it to `<root>/<crescent.outDir>/preview/index.html` on disk.
- Opens that file in your system's actual default browser via `vscode.env.openExternal` — a real
  `file://` page outside VS Code's webview sandbox/CSP, so browser devtools, extensions, and
  responsive-design mode all work on it normally, unlike the embedded panel.
- Never opens a webview panel itself, and is not wired to save/open auto-reload the way
  **Crescent: Preview**'s panel is: there's no live connection to an already-open external browser
  tab to push a reload into. Running the command again just rewrites the same file and re-invokes
  the OS's "open" on it — most browsers reuse an already-open tab for the same `file://` URL and
  you'll need to refresh it yourself (or your browser may do so automatically); that's the
  browser's/OS's behavior, not something this extension controls.
- Otherwise behaves identically to the panel version for what gets mounted, mount-failure
  isolation, skipped-files reporting, and the fatal-error popup case — see the rest of this
  "Preview" section.

## What the grammar highlights, and what it deliberately doesn't

`syntaxes/crescent.tmLanguage.json` is a flat, whole-file TextMate grammar (no `view`/`style`
sub-grammar embedding). It highlights, honestly and without inventing structure the compiler
doesn't expose to this grammar:

- Line (`//`) and block (`/* */`) comments, and double-quoted strings with `\`-escapes — matching
  `compiler/src/lexer.ts` exactly (including that a string literal may legally span multiple
  lines, since the lexer only ever stops at an unescaped `"` or end-of-file).
- Declaration/control/literal keywords and the four primitive types (`int`, `float`, `string`,
  `bool`) from `compiler/src/tokens.ts`'s keyword table.
- The name immediately following `component`/`struct`.
- Template tag names (`<div`, `</div`, `<UserCard`) via a heuristic: an identifier right after `<`
  or `</`, as long as the `<` isn't itself glued to a preceding identifier character. That last
  condition is what keeps `state<int>` from being misread as a tag — `<` in `state<int>` is
  preceded by `e`, `<` in `<div>` is preceded by whitespace/`{`/newline/another `>`. It's a
  heuristic, not real parsing, so a contrived case gluing a type name directly onto a `<` some
  other way could in principle confuse it; none of `compiler/examples/*.crs` do.

Deliberately **not** attempted in this version, matching how little a flat TextMate grammar can
know without real parsing:

- Attribute names inside tags (`class`, `onclick`, ...) get no special color — same token
  treatment as other identifiers.
- `style { ... }` block contents (selectors, CSS properties, `{expr}` interpolations) are not
  given CSS-aware highlighting — just the same flat comment/string/number/operator/punctuation
  rules as everywhere else.
- `<`/`>` are **not** in `language-configuration.json`'s bracket-matching or auto-closing pairs.
  Crescent's lexer always emits a plain `LT`/`GT` token and the *parser* disambiguates generic vs.
  comparison vs. tag-open by context (see `compiler/README.md`'s "Key implementation decisions").
  A flat editor-side grammar has no such context, so auto-closing `<` would misfire constantly on
  every `a < b` comparison; leaving it out is the honest choice for a v0.1 grammar, not an
  oversight.

## Known limitations / next steps

Tracked in the root `TODO.md` (§10, "Near-Term VS Code Enablement"):

- No continuous/on-document-change checking — only on save and on open (see "Diagnostics" above).
- No per-workspace-folder diagnostic partitioning in a multi-root workspace (see "Diagnostics"
  above).
- **Crescent: Preview** replaces the whole webview on every reload rather than doing a real
  hot-module-reload, so previewed components lose their local state on every save (see "Preview"
  above).
- **Crescent: Open Preview in Browser** has no equivalent of the panel's save-triggered
  auto-reload — there's no live connection to an already-open external browser tab, so you'll
  refresh it yourself after re-running the command (see "Opening it in a real browser" above).
- No LSP — this extension is intentionally process/in-process-`require()`-based, not a language
  server, per the plan's own note that a full LSP is a later v0.x/v1.0 concern once the diagnostic
  model has stabilized.
- Not published to the VS Code Marketplace; there is no packaging (`vsce package`) step set up yet.
