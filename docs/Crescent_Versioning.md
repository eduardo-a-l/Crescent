# Crescent Versioning and Releases

This document says how Crescent versions are numbered, what counts as a feature, a fix or a breaking
change, and how a release is made. It follows the milestones of `docs/Crescent_Design.md` §14.7
(v0.x, then v1.0, then post-1.0).

Nothing has been tagged yet, so everything here can still be changed cheaply. Once the first tag exists,
changing the scheme becomes expensive, so this is the moment to decide.

---

## 1. The scheme

Crescent uses **semantic versioning**: `MAJOR.MINOR.PATCH`, for example `0.21.3`.

| Part | Meaning | Example |
|---|---|---|
| `MAJOR` | A breaking change to the stable language. Not used before 1.0 (it stays `0`). After 1.0 it should be very rare, because §14.7 promises no fundamental redesigns | `1.0.0` → `2.0.0` |
| `MINOR` | A new feature, or an important change: the things people notice | `0.21.0` adds `while` loops |
| `PATCH` | A fix or an adjustment: nothing new to learn, nothing that can break a program that worked | `0.21.3` fixes a diagnostic's line number |

Read the two numbers that matter the way you would read `21.3`: **feature release 21, fix 3**. The
leading `0.` is the honest "not 1.0 yet" marker, and the third number exists because the tools that carry
the version (npm, the VS Code Marketplace) only accept three parts: `21.3` on its own is rejected by npm
as an invalid version.

When a `MINOR` is released, `PATCH` goes back to `0` (`0.21.3` → `0.22.0`).

### Before 1.0

`0.MINOR.PATCH`. The language and the compiler can still change shape (§14.7), so:

- a `MINOR` release **may contain breaking changes**; each one is listed under "Changed (breaking)" in
  the changelog, so nobody is surprised;
- a `PATCH` release **never breaks** a program or a tool that worked on the same `MINOR`.

### 1.0

`1.0.0` is released when the two requirements of §14.7 are met: a trustworthy semantic checker, and a
real editor experience (LSP). It is a decision about the language, not a date.

### After 1.0

`MINOR` is additive only, `PATCH` is fixes only, and a breaking change needs a new `MAJOR`.

---

## 2. What counts as a change

What can break is the **public surface** of Crescent:

1. **The language**: syntax and semantics (`docs/Crescent_Grammar.md`, `docs/Crescent_Design.md`). A program
   that compiled and now does not, or now means something else, is a breaking change.
2. **Generated JavaScript and the runtime**: generated code runs against the runtime of the same Crescent
   version. They are released together for that reason.
3. **The command line**: commands, flags, exit codes and the shape of the output that scripts read.
4. **The library API** that editors and tools call: `parseCrescent`, `parseCrescentRecovering`,
   `checkProject`, `buildProject`, `buildPreviewHtml` and the result types they return.

What is **not** part of it, and may change in a `PATCH`: the wording of a diagnostic, the exact line it
is reported on, the order of independent diagnostics, performance, and anything under `src/` that is not
exported.

### Where a change goes

| Change | Version part |
|---|---|
| A new language feature (`while`, `use`, string interpolation) | `MINOR` |
| A new command, a new flag, a new API function | `MINOR` |
| A new warning | `MINOR` |
| A checker that now rejects code that used to compile, because the old behavior was unsound (for example null narrowing that survived an `await`) | `MINOR` before 1.0, listed under "Fixed (stricter)"; the language's promise is safety, so this is allowed in a `MINOR` after 1.0 too, with the note |
| A removed or reshaped API field (`checkProject()` no longer has `fatal`) | `MINOR` before 1.0, under "Changed (breaking)"; `MAJOR` after |
| A bug fix that makes something work as documented | `PATCH` |
| Better diagnostics: a more exact message or line | `PATCH` |
| Performance work, refactors with no visible change | `PATCH` |
| Documentation, tests, CI, benchmarks | no release by themselves |

When two rows could fit, the larger part wins.

---

## 3. What is versioned

There is **one Crescent version**: the language, the compiler, the runtime and the CLI together. Its source
of truth is `compiler/package.json`.

These are separate programs with their own pace, and keep **their own** versions in their own
`package.json`: the VS Code extension (`editors/vscode`), the web site (`crescent-web`) and the playground
(`playground`). When one of them needs a particular Crescent version, its README says so.

The specifications (`docs/`) do not have a version scheme of their own. A document states which Crescent
version it describes, and its history is the git history.

---

## 4. The changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com): an `## [Unreleased]` section at the
top, then one `## [X.Y.Z] - YYYY-MM-DD` section per release, newest first, with these headings when they
apply: **Added**, **Changed**, **Changed (breaking)**, **Fixed**, **Fixed (stricter)**.

The rule for everyone, humans and AI sessions alike: **a change a user can notice adds a line under
`[Unreleased]` in the same commit.** Documentation, tests, CI and benchmark changes do not need a line.

The changelog is also how the next version number is chosen: look at what is under `[Unreleased]` and
apply section 2. Commit prefixes (`feat:`, `fix:`) help, but they are not used to compute the version,
because a prefix describes how a commit was labeled, not what it changes.

---

## 5. Making a release

`develop` is where work is integrated. `main` always holds the latest release. A release is made by the
maintainer; assistants do not merge into `main` or create tags.

1. **Choose the version** from `[Unreleased]` (section 2). Stay on `0.x` until the 1.0 requirements are met.
2. **Check `develop`**: `npx tsc --noEmit` and `npm test` pass in `compiler/`.
3. **Bump the version**: `npm version <new> --no-git-tag-version` in `compiler/`.
4. **Close the changelog**: rename `[Unreleased]` to `[X.Y.Z] - date`, add a fresh empty `[Unreleased]` above it.
5. **Commit** on `develop`: `chore: Release X.Y.Z`.
6. **Merge `develop` into `main`** and **tag** the merge commit `vX.Y.Z` (an annotated tag, with the
   changelog section as its message).
7. **Publish the notes**: a GitHub release for the tag, with the changelog section as its text.

The other components are released the same way, with their own tag prefix: `vscode-vX.Y.Z`,
`web-vX.Y.Z`, `playground-vX.Y.Z`.

A fix for a released version is made on `develop`, released as the next `PATCH`, and only branched from
the old tag if `develop` already contains changes that must not ship yet.

---

## 6. Where this stands today

- `0.1.0` was the initial prototype of the first two days of the project. It was never tagged.
- **`0.2.0`** is the first release under this scheme, with everything the changelog lists under it. The
  version bump and the changelog are committed on `develop`. Merging `develop` into `main` and tagging
  `v0.2.0` (steps 6 and 7 of section 5) is for the maintainer.
- A guard test, `compiler/scripts/test-versioning.js`, keeps this document, the changelog and the package
  versions consistent: every package has a three-part version, and the newest release in the changelog
  is the version in `compiler/package.json`.
