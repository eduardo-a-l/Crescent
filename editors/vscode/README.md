# Crescent for VS Code (v0.2)

A VS Code extension for the Crescent language: `.crs` file association, syntax highlighting,
comment/bracket/indentation configuration, in-editor diagnostics on save/open, and two commands
that shell out to the `crescent` CLI (`compiler/src/cli.ts` — see `compiler/README.md`).

This covers the first two bullets of the "Near-Term VS Code Enablement (v0.x)" plan in the
repository root's `TODO.md` (§10). There is still no language server — see "Known limitations /
next steps" below. What you get today:

- `.crs` files are recognized as the "Crescent" language.
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

## Running it during development

There's no build step for the extension itself (plain JS, no bundler) — but diagnostics and
**Check**/**Build** both need the *compiler* built first:

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
  Diagnostics specifically need a *path* here (or the auto-detected one) — a bare command on `PATH`
  gives the extension no directory to find `project.js` next to, so diagnostics fall back to
  reporting that the compiler couldn't be loaded rather than guessing a location; **Check**/
  **Build** still work fine with a bare command, since those just spawn it.
- `crescent.outDir` (string, default `"dist"`) — output directory for **Crescent: Build**, relative
  to the project root passed to the CLI.

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
- No `Crescent: Preview` command yet.
- No LSP — this extension is intentionally process/in-process-`require()`-based, not a language
  server, per the plan's own note that a full LSP is a later v0.x/v1.0 concern once the diagnostic
  model has stabilized.
- Not published to the VS Code Marketplace; there is no packaging (`vsce package`) step set up yet.
