# Crescent Web

The Crescent marketing site — Home, Setup, Documentation, and an integrated Playground — plus the
real Crescent compiler running behind it. A React + Vite static site with one small serverless
function.

## Where this came from

The visual design (`src/pages/`, `src/shared/SiteShell.tsx`, `src/site.css`) started as a Replit
"mockup sandbox" export. Everything Replit-specific was removed: the generated backend/database
scaffold (Express, Drizzle, an Orval-generated API client — none of it was wired to anything real),
the `.replit`/`.agents` tooling files, the unused shadcn/ui component library (~55 components, zero
of which the actual site pages imported), and the mockup-preview-only routing
(`/__mockup/preview/...` URLs) — replaced with a small real client-side router (`src/router.ts`).

The code examples on the Home and Documentation pages were also corrected: the original mockup
invented syntax that doesn't match the real language (`fn` instead of `void`, `derived string`
instead of `derived<string>`, backtick template strings, `on:click` instead of `onclick`). They now
match `compiler/examples/counter.crs`'s actual, compiler-verified syntax.

## The Playground page

This is not an iframe to a separately-hosted site. The actual playground — `public/app/`
(`index.html`/`style.css`/`app.js`/`highlight.js`), the `/api/compile` serverless function
(`api/compile.js`), and the compiler-calling logic (`lib/compileToPreview.js`) — is the same,
already-tested code from the standalone `playground/` project, copied in as part of this one
deployment. `Playground.tsx` just embeds `/app/index.html` in a full-bleed, same-origin `<iframe>`
below the site's own header — no separate domain, no CORS, no second Vercel project to keep in
sync. The playground's own page header/footer were removed from the embedded copy since the site's
header already serves that role.

`crescent-compiler` is a `file:../compiler` dependency, same as the standalone playground was —
this only works because `crescent-web` and `compiler` are siblings in the same repository. See
"Splitting into its own repository" below for what changes if that stops being true.

### Why some folders have their own `package.json`

This project's own `package.json` has `"type": "module"` (required for `@tailwindcss/vite`, which
is ESM-only). The playground code copied into `api/`, `lib/`, `scripts/`, and `public/app/` is
CommonJS (`require`/`module.exports`) and needs to stay that way — it's unmodified, already-tested
code. Each of those directories has its own `{"type": "commonjs"}` package.json to override the
root setting locally, which is the standard Node.js way to mix module systems in one project
without renaming any files. `public/app/package.json` is only there for that reason; it has no
effect on how the browser loads those files (browsers don't consult `package.json` at all) and it
being publicly fetchable at `/app/package.json` is harmless.

## Local development

```bash
npm install   # needs compiler/ already built once: cd ../compiler && npm run build
npm run dev   # one command: the full site AND a working /api/compile, via a small Vite dev middleware
npm test      # the real playground test suite: highlighter round-trips, jsdom click-through, compile pipeline
```

`npm run dev` wires `/api/compile` into Vite's own dev server (see `apiCompileDevMiddleware` in
`vite.config.ts`), so there's no need for the Vercel CLI just to test locally. `npm run build`
type-checks with `tsc` and then runs `vite build`; the output in `dist/` includes both the compiled
React app and the untouched `public/app/` and `public/images/` files Vite copies through as-is.

## Deploying to Vercel

Same monorepo pattern as the standalone playground used: set this project's **Root Directory** to
`crescent-web` in Vercel's settings, and set the **Build Command** to build the compiler first,
since Vercel only installs this directory's own dependencies by default:

```
cd ../compiler && npm install && npm run build && cd ../crescent-web && npm install
```

`vercel.json` already points Vercel at `dist/` as the output directory, registers `api/compile.js`
as a serverless function, and rewrites any path that isn't `/api/...`, `/app/...`, or `/images/...`
to `/index.html` — the standard fallback a client-side-routed SPA needs so a direct visit to, say,
`/documentation` doesn't 404.

## Splitting into its own repository, later

When this moves to its own (private, per the current plan) repository as its own root rather than
a `crescent-web/` subfolder of the public Crescent repo, two things need to change:

1. **The `file:../compiler` dependency stops resolving** — there's no `compiler/` sibling anymore.
   Either vendor a built copy of `compiler/dist` + `runtime.js` into the new repo (quick, but goes
   stale unless you remember to re-copy it after every compiler change), or publish
   `crescent-compiler` to npm and depend on a real version number instead (the more durable option,
   and not much more work — see the note about this in the standalone `playground/README.md`'s
   "quick vs proper" section, which still applies here unchanged).
2. Nothing else moves — every path in this project is already relative to `crescent-web/` itself
   (`../compiler` is the only place that reaches outside), so the folder's contents can become a
   repository root as-is once (1) above is resolved.

## Current scope, deliberately limited

Same spirit as the original playground: one component, no `import`s, no accounts, no saved
snippets beyond what a share link's URL hash carries. See the standalone `playground/README.md`'s
"Current scope" section — everything it says still applies to the copy embedded here.
