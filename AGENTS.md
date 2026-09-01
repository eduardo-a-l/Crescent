# Crescent — AI Development Instructions

## 1. Project Overview

Crescent is a typed, component-based programming language for building reactive frontend user interfaces.

The compiler currently consists of a handwritten lexer/parser, AST, module resolution, semantic checking, JavaScript code generation, and a small reactive runtime.

The project is still pre-1.0. Language semantics and compiler architecture may evolve, but changes should be deliberate and documented.

---

## 2. Source of Truth

When deciding what Crescent is supposed to do, use these sources in this order:

1. `docs/Crescent_Design.md`
   - Language semantics
   - Reactivity model
   - Type-system decisions
   - Component behavior
   - Runtime/codegen architecture
   - Long-term milestones

2. `docs/Crescent_Grammar.md`
   - Concrete syntax
   - Lexer modes
   - Parser disambiguation rules
   - Grammar productions

3. Existing compiler implementation
   - `compiler/src/`
   - Existing behavior is important evidence, but implementation does not automatically override the design/grammar documents.

4. Existing examples and tests
   - `compiler/examples/`
   - `compiler/scripts/`

If these sources disagree, do not silently choose one. Identify the disagreement and resolve it deliberately.

---

## 3. Before Changing Code

Before implementing a feature:

1. Read this file.
2. Read `HANDOFF.md`.
3. Read the relevant sections of `docs/Crescent_Design.md`.
4. Read the relevant sections of `docs/Crescent_Grammar.md`.
5. Inspect the existing implementation.
6. Search the repository for related behavior.
7. Inspect existing examples/tests.
8. Determine whether the requested behavior already partially exists.

Do not immediately start editing after seeing the first relevant file.

---

## 4. General Development Rules

### Make small coherent changes

Prefer:

- one feature
- one bug fix
- one compiler stage improvement
- one well-defined refactor

over large unrelated rewrites.

Do not combine unrelated cleanup with a feature unless the cleanup is necessary for that feature.

### Preserve existing behavior

Do not change language semantics merely because another design would be cleaner.

If a behavior appears questionable:

1. identify it;
2. check the design document;
3. check the grammar;
4. check examples/tests;
5. explain the conflict;
6. only then change it.

### Do not invent language semantics

If the specification does not define something, do not silently invent a permanent rule.

Mark the behavior as an open design question or propose a minimal temporary behavior.

---

## 5. Compiler Architecture

The current compiler is organized approximately as:

```
source
  ↓
lexer
  ↓
parser
  ↓
AST
  ↓
module resolution
  ↓
semantic checker
  ↓
code generation
  ↓
generated JavaScript
  ↓
Crescent runtime
  ↓
DOM
```

Important compiler files include:

- `compiler/src/tokens.ts`
- `compiler/src/lexer.ts`
- `compiler/src/ast.ts`
- `compiler/src/parser.ts`
- `compiler/src/modules.ts`
- `compiler/src/checker.ts`
- `compiler/src/codegen.ts`
- `compiler/src/runtime.ts`
- `compiler/src/index.ts`

Do not bypass an earlier compiler stage by putting semantic behavior into codegen unless there is a clear architectural reason.

---

## 6. Language Design Rules

Crescent currently emphasizes:

- explicit typing;
- C-style declaration syntax;
- reactive state through `state<T>`;
- components;
- `view` blocks;
- `style` blocks;
- nullable types;
- arrays;
- structs;
- derived state;
- lifecycle blocks;
- component composition;
- reactive collections;
- JavaScript output as the current v0.x target.

The language is not intended to become a conventional class-based OOP language.

Do not introduce:

- classes;
- inheritance;
- arbitrary object-oriented encapsulation;

unless the language design is explicitly changed first.

---

## 7. Reactivity Rules

Treat the documented reactivity model as a semantic rule, not merely a runtime implementation detail.

Current design:

- `state<T>` is shallow reactive state.
- Primitive reassignment triggers reactivity.
- Whole-object reassignment triggers reactivity.
- Direct mutation of properties inside `state<T>` is restricted.
- Reactive arrays/collections have special mutation behavior.
- `derived<T>` uses lazy, pull-based memoization.
- Reactive CSS is lowered using scoped CSS custom properties.

When changing reactivity:

1. update/check the design document;
2. update the semantic checker;
3. update codegen/runtime if required;
4. add examples/tests;
5. verify generated behavior.

Do not implement only the runtime behavior and assume the language is therefore correct.

---

## 8. Parser and Grammar Rules

The parser is handwritten recursive descent.

The lexer/parser has multiple modes:

- `MODE_CODE`
- `MODE_VIEW`
- `MODE_STYLE`

Be particularly careful with:

- `<` as generic syntax vs comparison vs HTML/component opening;
- uppercase vs lowercase tag names;
- `{}` as interpolation vs template blocks;
- nested lexer modes;
- nullable and array type modifier ordering;
- generic type arguments.

If syntax changes:

1. update `docs/Crescent_Grammar.md`;
2. update the lexer/parser;
3. add/update examples;
4. verify parser behavior.

Never update the parser while leaving the formal grammar knowingly incorrect.

---

## 9. Semantic Checker Rules

The semantic checker is responsible for language correctness that should not be delegated to code generation.

Prefer the checker for:

- name/scope resolution;
- type compatibility;
- struct/property validation;
- component/property validation;
- reactive-state rules;
- nullability checks;
- invalid assignments;
- other compile-time semantic constraints.

If codegen currently rejects something because it is unsupported, distinguish that from a semantic error.

A valid Crescent program may temporarily be unsupported by codegen.

---

## 10. Code Generation Rules

The current v0.x target is JavaScript.

Codegen must not generate plausible-looking but semantically incorrect JavaScript.

If a feature cannot currently be generated safely:

- report that codegen is unsupported;
- do not silently produce incorrect output.

Preserve the existing distinction between:

- semantic errors;
- unsupported codegen;
- successfully generated code.

---

## 11. Runtime Rules

`compiler/src/runtime.ts` contains the runtime behavior used by generated programs.

Runtime changes should normally be accompanied by:

- a source-level example;
- generated-output verification;
- a runtime/DOM test where practical.

Do not fix a compiler semantic problem exclusively inside the runtime.

---

## 12. Testing

At minimum, when relevant:

```
npx tsc --noEmit
```

For the full compiler/codegen test suite:

```
npm test
```

For compiler execution:

```
npm start
```

For web bundling:

```
npm run build:web
```

Use the smallest relevant test while developing, then run the broader test suite before finishing.

Do not claim a test passed unless it was actually run.

If a test cannot be run, explicitly say so.

---

## 13. Examples Are Part of the Language

Examples in `compiler/examples/` are not disposable demonstrations.

Use them to:

- document syntax;
- reproduce bugs;
- verify parser behavior;
- verify semantic behavior;
- demonstrate newly supported codegen features.

When adding an important language feature, prefer adding a small example that demonstrates its intended use.

---

## 14. Documentation Changes

A change to language syntax or semantics should normally update the appropriate documentation.

Examples:

### Syntax change

Update:

- `docs/Crescent_Grammar.md`
- relevant design documentation
- examples/tests

### Semantic/type-system change

Update:

- `docs/Crescent_Design.md`
- checker
- examples/tests

### Codegen-only change

Usually update:

- compiler implementation
- relevant tests/examples
- compiler documentation if user-visible behavior changed

Do not modify documentation merely to make it agree with an accidental implementation bug.

---

## 15. AI Session Size

Work in small, independently understandable units.

Do not begin a second major feature after completing the requested feature.

If the task turns out to be substantially larger than expected:

1. finish the smallest safe unit;
2. test it;
3. update `HANDOFF.md`;
4. stop.

Do not attempt to "squeeze in one more feature."

---

## 16. Handoff Requirement

At the end of every meaningful session, update `HANDOFF.md`.

It must contain:

- current task;
- what was completed;
- files changed;
- tests run;
- test results;
- important decisions;
- known problems;
- unfinished work;
- recommended next step;
- current git commit, if committed.

The next AI must be able to continue without seeing the previous AI's conversation.

---

## 17. Stop Condition

If the available context, usage, time, or task complexity becomes a concern:

STOP expanding the scope.

Finish the smallest safe unit of work.

Then:

1. run the relevant tests;
2. inspect `git diff`;
3. update `HANDOFF.md`;
4. summarize the state;
5. stop.

Never leave behind a large unexplained half-implementation simply because the session is ending.

---

## 18. Git Discipline

Before modifying files:

```
git status
```

Before finishing:

```
git status
git diff
```

Do not overwrite unrelated user changes.

If the working tree already contains changes:

- understand which changes belong to the current task;
- do not revert unrelated work;
- mention relevant pre-existing changes in `HANDOFF.md`.

Prefer focused commits.

A good commit represents one coherent change.

---

## 19. AI Collaboration

Crescent may be developed using different AI coding agents, including
Claude and Codex.

No agent should assume that another specific agent will perform the next
step.

The repository must therefore remain understandable and recoverable by
any agent.

The shared sources of state are:

1. Git history and current working tree
2. `AGENTS.md`
3. `HANDOFF.md`
4. `TODO.md`
5. `docs/Crescent_Design.md`
6. `docs/Crescent_Grammar.md`
7. The actual source code and tests

An AI may:

- implement a task;
- review previous work;
- fix bugs;
- improve tests;
- continue unfinished work;
- or begin a new task.

Do not wait for another specific AI.

If reviewing another agent's work, inspect the actual repository and git
diff rather than trusting the previous agent's summary.

A handoff is useful context, not authoritative evidence. The source code,
tests, git history, and language specification remain authoritative.

---

### Session Checkpoints

AI coding sessions may end unexpectedly because of context, usage, time, or platform limits.

For tasks that involve substantial changes, create checkpoints during the work rather than relying exclusively on the final response.

A checkpoint should contain:

- current implementation state;
- tests already run;
- known failures;
- remaining work;
- important decisions;
- files changed.

When practical, maintain a patch representing the uncommitted work.

Do not wait until the final moments of a session to create the only copy of the work.

---

### Before Ending a Session

When the current task is complete, or when the session may be approaching its practical limit:

1. Stop expanding the task.
2. Finish the smallest coherent unit currently being implemented.
3. Run relevant tests.
4. Inspect `git diff`.
5. Update `HANDOFF.md`.
6. Ensure all important changes are represented in the repository or in a patch.
7. Clearly state what remains unfinished.
8. Give a concise handoff summary.

If a patch is requested or needed, create it before continuing with any optional work.

---

### Patch Handoff

A patch may be used to transfer uncommitted work between environments or AI agents.

When creating a patch:

- include only changes belonging to the current task;
- do not include unrelated user changes;
- ensure the patch can be applied cleanly;
- include `HANDOFF.md` when it contains information necessary to understand the changes;
- mention the patch filename in the final handoff.

Prefer a Git-generated patch when possible.

Example:

```
git diff > crescent-checkpoint.patch
```

For staged changes:

```
git diff --cached > crescent-checkpoint.patch
```

Before declaring a patch ready, inspect it:

```
git diff --check
git diff
```

The patch itself is not the source of truth. The source of truth is the resulting repository state after the patch is applied and tested.

## 20. Final Response Format

When finishing a session, use this structure:

```
## Completed
...

## Changed
...

## Tests
...

## Problems
...

## Decisions
...

## Remaining
...

## Next Step
...
```

Keep the final response concise enough to be pasted into another AI's context.
