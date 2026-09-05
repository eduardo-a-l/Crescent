# Crescent for VS Code (v0.1)

A minimal VS Code extension for the Crescent language: `.crs` file association, syntax
highlighting, comment/bracket/indentation configuration, and two commands that shell out to the
`crescent` CLI (`compiler/src/cli.ts` — see `compiler/README.md`).

This is the first step of the "Near-Term VS Code Enablement (v0.x)" plan in the repository root's
`TODO.md` (§10). It is deliberately minimal: no diagnostics are published inside the editor yet
(that's the plan's next bullet), and there is no language server. What you get today:

- `.crs` files are recognized as the "Crescent" language.
- Syntax highlighting (see "What the grammar highlights, and what it deliberately doesn't" below).
- Matching comments (`//`, `/* */`), bracket matching/auto-closing for `{}`, `[]`, `()`, and basic
  brace-based auto-indent.
- **Crescent: Check** — runs `crescent check <project root>` and prints its output (diagnostics,
  summary line, exit code) to a "Crescent" output channel.
- **Crescent: Build** — runs `crescent build <project root> --out-dir <root>/<crescent.outDir>`
  the same way.

## Running it during development

There's no build step (the extension is plain JS, no bundler). From this directory:

```
code --extensionDevelopmentPath=. --new-window ../../compiler/examples
```

or open this repository in VS Code, open `editors/vscode/src/extension.js`, and press `F5` to
launch an "Extension Development Host" window. Open a folder containing `.crs` files in that
window (e.g. `compiler/examples`) to try it.

## Settings

- `crescent.cliPath` (string, default `""`) — path to a compiled `compiler/dist/cli.js`, or a bare
  command available on `PATH` (e.g. `crescent`, after running `npm link` inside `compiler/`). When
  empty, the extension walks up from the open folder looking for a sibling `compiler/dist/cli.js`
  — this matches this monorepo's own layout, so **Check**/**Build** work out of the box when
  developing Crescent itself (after `cd compiler && npm run build`). Consumers outside this
  monorepo will need to set this explicitly until the compiler is published as an npm package.
- `crescent.outDir` (string, default `"dist"`) — output directory for **Crescent: Build**, relative
  to the project root passed to the CLI.

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

- No diagnostics are shown inline in the editor yet — **Check**/**Build** output is plain text in
  the output channel, not squiggly underlines. Wiring `checkProject()`/`buildProject()`
  (`compiler/src/project.ts`) diagnostics into `vscode.languages.createDiagnosticCollection` on
  save is the next planned step.
- No `Crescent: Preview` command yet.
- No LSP — this extension is intentionally process-based (spawns the CLI), per the plan's own
  note that a full LSP is a later v0.x/v1.0 concern once the diagnostic model has stabilized.
- Not published to the VS Code Marketplace; there is no packaging (`vsce package`) step set up yet.
