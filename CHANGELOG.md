# Changelog

All notable changes to Crescent are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com), and the versions follow `docs/Crescent_Versioning.md`
(semantic versioning, staying on `0.x` until 1.0).

A change a user can notice adds a line under `[Unreleased]` in the same commit. Documentation, tests, CI
and benchmark changes do not need a line.

## [Unreleased]

Everything since the initial prototype below. It was reconstructed from the git history when the
changelog was introduced, and is proposed as `0.2.0`.

### Added

- **Modules**: `use` imports, with resolution across files, import cycle detection, conflicting-name and
  unused-import diagnostics, and module errors reported on the `use` line without aborting the project.
- **Language**: keyed `for` loops with list reconciliation, effect disposal, array mutators,
  `provide`/`inject`, views with several root nodes, string interpolation, struct declarations and
  destructuring, and `while`, `do`-`while`, C-style `for`, `break` and `continue`.
- **Type and null safety**: a semantic and type checker (generics, function parameters, arguments and
  return types, component props, array elements, assignment compatibility, duplicate declarations,
  `const` reassignment), nullable locals and parameters, and flow-sensitive null narrowing through
  `if`/`else`, `&&`/`||`, ternaries, loop tests and early exits by `return`, `break` and `continue`.
- **Command line**: `crescent check` and `crescent build`.
- **Syntax errors**: every syntax error of a file is reported, up to 20, instead of only the first. The
  parser recovers at statements, component members, top-level declarations and view nodes.
- **Editor and web**: a VS Code extension (diagnostics, syntax highlighting, a preview panel and a browser
  preview), a web playground with syntax highlighting, and the `crescent-web` site.
- **Quality tooling**: a fuzzer, a benchmark suite with a scaling guard, and regression suites for the
  checker, modules, error locations and recovery.

### Changed (breaking)

- `checkProject()` no longer returns `fatal`, and `FatalDiagnostic` is gone. A file that does not parse is
  an error diagnostic on that file, listed in the new `unparsed`, and `ok` now means "every file parsed".
- `buildProject()` no longer stops when a file does not parse: the other files are checked and built, and
  a file that imports one that did not parse gets an error on its `use` line.
- `LexError` and `ParseError` carry a `line` and their messages no longer end in "at line N".
- `BuildPreviewResult.ok` is removed, and `html` is always a string. The web preview's `fatal` field is
  gone: a syntax error arrives in `diagnostics` like any other.
- `loadAllPrograms()` is now a wrapper over `loadAllProgramsLenient()`, which collects the syntax errors
  of every file.

### Changed

- The parser is 3 to 7 times faster.
- `CodegenError` carries the line of the node being generated, which `crescent build` prints as
  `file:line: codegen skipped: reason`.
- `crescent check` prints a syntax error in the same `file:line [error] ...` format as the other diagnostics.

### Fixed

- Null narrowing is invalidated by an assignment (it never was), by a call to a function that may assign
  the name, across `await`, by the order of evaluation inside one expression, and for a `derived` value
  when what it depends on is written.
- Import cycle detection no longer overflows the stack on very large module graphs, and file discovery
  skips `node_modules` and hidden entries.
- An unterminated `style {` block no longer loops forever, and deeply nested input is rejected with an error
  instead of a stack overflow (nesting limit 256, syntax tree depth limit 1000).
- A line counter that drifted after the parser backtracked.
- An error inside a string or `style` interpolation is reported on its real line, not on line 1, and an
  unterminated string is reported where it started.
- The code generator now rejects a second `view` block itself, instead of silently ignoring it.

## [0.1.0] - 2026-08-07

The initial prototype, reconstructed from the git history. It was never tagged.

### Added

- The project structure, the language design and grammar documents, and a handwritten lexer, parser and AST.
- JavaScript code generation with a small reactive runtime for a supported subset of the language.
- `for` loops in view blocks.
- Bundling of the generated components into a runnable browser HTML file.
- A continuous-integration workflow: type check, code generation and a DOM smoke test.
- The MIT license.
