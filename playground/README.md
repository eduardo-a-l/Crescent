# Crescent Playground

A minimal browser playground for Crescent: type a single component, click Run, and see it
render in a sandboxed preview. Share a snippet by copying the link — the source is encoded
directly in the URL, so there is no database or account involved.

## How it works

- The `public/` folder is a plain static site: a `<textarea>` editor, a "Run" button, and a
  sandboxed `<iframe>` for the compiled output. No framework, no build step.
- `api/compile.js` is a single Node.js serverless function. It writes whatever you typed to a
  temporary `.crs` file and runs it through the **actual Crescent compiler** —
  `crescent-compiler`'s `webPreview.buildPreviewHtml()` (`compiler/src/webPreview.ts`), the same
  function the VS Code extension's "Open Preview in Browser" command uses. It returns the
  compiled preview HTML plus the checker's diagnostics as JSON.
- `crescent-compiler` is consumed as a local `file:../compiler` dependency (see `package.json`) —
  this playground and the compiler live in the same repository and always compile against
  whatever is currently in `compiler/src`, with no publishing step.
- Sharing works by base64-encoding the source into the URL hash (`#code=...`), the same trick
  the TypeScript Playground and Svelte REPL use for simple share links. Nothing is stored
  server-side.

## Current scope (deliberately limited)

This is a first pass, kept intentionally small:

- **One component, no `import`s.** The whole snippet is compiled as a single `main.crs` file. If
  you want to try Crescent's module system, use the CLI or VS Code extension against a real
  project for now.
- **No persistent storage.** A share link is only as good as the URL — there's no "my snippets"
  list, no accounts, nothing server-side to lose.
- **No code editor niceties.** The editor is a plain `<textarea>` — no syntax highlighting, no
  autocomplete. Swapping in something like CodeMirror or Monaco later is a purely front-end
  change and doesn't touch anything described above.

None of these are permanent decisions — they're where the scope was intentionally cut to ship a
working first version. See `TODO.md`'s "Web Playground" entry for what's explicitly left open.

## Local development

From this directory:

```bash
npm install
npm test    # compiles a real component through the pipeline and checks the result with jsdom
npm run dev # starts a plain Node dev server at http://localhost:3000, no Vercel CLI required
```

`npm install` needs `compiler/` to already be built (`cd ../compiler && npm run build`) — the
`file:../compiler` dependency points at the compiler's own `dist/` output, not its TypeScript
source.

## Deploying to Vercel

This repository is a single Git repo containing `compiler/`, `editors/vscode/`, and this
`playground/` as independent sibling projects (the VS Code extension already works this way —
see `editors/vscode/src/extension.js`). To deploy just this one:

1. Import the repository into Vercel.
2. In the Vercel project's settings, set **Root Directory** to `playground`.
3. Set the **Build Command** to also build the compiler first, since Vercel's build only installs
   `playground/`'s own dependencies by default:
   ```
   cd ../compiler && npm install && npm run build && cd ../playground && npm install
   ```
   (Framework preset: "Other" — there's no framework here, just `public/` + `api/`.)
4. Deploy. `vercel.json` already points Vercel at `public/` as the static output directory and
   registers `api/compile.js` as a serverless function.

Once deployed, anyone with the URL can open it, write a component, and share what they wrote via
the "Copy share link" button — no sign-up, no server-side state.

## A note on the "quick" vs. "proper" approach

This whole playground works by reaching into `compiler/dist` from a sibling folder in the same
repo — quick to build, zero publishing overhead, and the playground always reflects whatever's
currently in `compiler/src`. The more "properly decoupled" version would publish
`crescent-compiler` as a real versioned package (npm or GitHub Packages) and let the playground
depend on it like any external consumer would, likely from its own separate repository. That's a
deliberate future option, not a mistake to fix urgently — it only starts to matter once the
compiler's public API is stable enough that a playground rebuild breaking on every compiler
commit becomes a real cost rather than a hypothetical one. Switching later doesn't require
touching the compiler at all — just publishing it and changing one dependency line here.
