import * as esbuild from 'esbuild';
import * as AST from './ast';
import { buildProject, BuildProjectResult, FileBuildResult } from './project';

export interface PreviewMount {
  relPath: string;
  componentName: string;
  globalName: string;
  rootId: string;
}

export interface BuildPreviewResult {
  ok: boolean;
  build: BuildProjectResult;
  html: string | null;
  mounts: PreviewMount[];
  bundleErrors: { relPath: string; message: string }[];
}

function sanitizeIdentifier(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, '_');
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A component is treated as a previewable root when it takes no parameters.
// Components with parameters are meant to be used as `<Card ...>` inside
// another component's view, not mounted standalone — the preview has no way
// to supply props for them. This matches every zero-param top-level
// component across compiler/examples/ (Counter, App, TaskBoard, Header, ...)
// and excludes every prop-taking one (Greeting, Card, DeepNestedWidget, ...).
function rootComponentNames(program: AST.Program): string[] {
  return program.declarations
    .filter((decl): decl is AST.ComponentDecl => decl.kind === 'ComponentDecl' && decl.params.length === 0)
    .map((decl) => decl.name);
}

function describeSkipped(build: FileBuildResult): string {
  return build.skippedReason ?? build.unexpectedError ?? 'unknown error';
}

export async function buildPreviewHtml(root: string, outDir: string): Promise<BuildPreviewResult> {
  const build = buildProject(root, outDir);

  if (!build.check.ok) {
    return { ok: false, build, html: null, mounts: [], bundleErrors: [] };
  }

  const mounts: PreviewMount[] = [];
  const bundleErrors: { relPath: string; message: string }[] = [];
  const scripts: string[] = [];
  const sections: string[] = [];
  const mountCalls: string[] = [];

  for (const fileBuild of build.builds) {
    if (!fileBuild.outFile) continue;
    const loaded = build.check.files.get(fileBuild.relPath);
    if (!loaded) continue;

    const componentNames = rootComponentNames(loaded.program);
    if (componentNames.length === 0) continue;

    const globalName = `Crescent_${sanitizeIdentifier(fileBuild.relPath)}`;
    let result;
    try {
      result = await esbuild.build({
        entryPoints: [fileBuild.outFile],
        bundle: true,
        format: 'iife',
        globalName,
        platform: 'browser',
        write: false,
      });
    } catch (e) {
      bundleErrors.push({ relPath: fileBuild.relPath, message: (e as Error).message });
      continue;
    }

    scripts.push(result.outputFiles[0].text);

    for (const componentName of componentNames) {
      const rootId = `crs-root-${sanitizeIdentifier(fileBuild.relPath)}-${sanitizeIdentifier(componentName)}`;
      mounts.push({ relPath: fileBuild.relPath, componentName, globalName, rootId });
      sections.push(
        `    <section>\n      <h2>${escapeHtml(componentName)}</h2>\n      <p class="crs-preview-path">${escapeHtml(
          fileBuild.relPath
        )}</p>\n      <div id="${rootId}"></div>\n    </section>`
      );
      // A zero-param component can still fail at mount time — most notably
      // `inject<T>` (design doc §12), which a component can declare without
      // taking it as a parameter, but which is only ever satisfied by an
      // ancestor's `provide<T>`. Detecting that transitively (including
      // through components nested arbitrarily deep in the view) is a real
      // dataflow analysis, not something to bolt onto this tool; instead,
      // each mount is wrapped so one failing root reports an inline error
      // without preventing every other root on the page from rendering.
      mountCalls.push(
        `        try {\n` +
          `          document.getElementById(${JSON.stringify(rootId)}).appendChild(${globalName}.${componentName}());\n` +
          `        } catch (err) {\n` +
          `          var el = document.getElementById(${JSON.stringify(rootId)});\n` +
          `          if (el) { el.textContent = 'Preview error: ' + (err && err.message ? err.message : err); el.className = 'crs-preview-mount-error'; }\n` +
          `          console.error(${JSON.stringify(`Crescent preview: failed to mount ${rootId}`)}, err);\n` +
          `        }`
      );
    }
  }

  const skipped = build.builds.filter((b) => b.outFile === null);
  const skippedHtml =
    skipped.length > 0
      ? `    <section class="crs-preview-warnings">\n      <h2>Skipped files</h2>\n      <ul>\n${skipped
          .map((s) => `        <li>${escapeHtml(s.relPath)}: ${escapeHtml(describeSkipped(s))}</li>`)
          .join('\n')}\n      </ul>\n    </section>`
      : '';

  const bundleErrorHtml =
    bundleErrors.length > 0
      ? `    <section class="crs-preview-warnings">\n      <h2>Bundling failed</h2>\n      <ul>\n${bundleErrors
          .map((e) => `        <li>${escapeHtml(e.relPath)}: ${escapeHtml(e.message)}</li>`)
          .join('\n')}\n      </ul>\n    </section>`
      : '';

  const emptyHtml =
    mounts.length === 0
      ? `    <section class="crs-preview-empty">\n      <p>No previewable components found. A previewable component is declared at the top` +
        ` level with no parameters (e.g. <code>component App { ... }</code>).</p>\n    </section>`
      : '';

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Crescent Preview</title>
    <style>
      body { font-family: sans-serif; margin: 1.5rem; }
      section { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
      .crs-preview-path { color: #888; font-size: 0.85em; margin-top: -0.5rem; }
      .crs-preview-warnings { color: #b00; }
      .crs-preview-empty { color: #888; }
      .crs-preview-mount-error { color: #b00; font-style: italic; }
    </style>
  </head>
  <body>
    <h1>Crescent Preview</h1>
${skippedHtml}
${bundleErrorHtml}
${emptyHtml}
${sections.join('\n')}
${scripts.map((code) => `<script>\n${code}\n</script>`).join('\n')}
    <script>
      window.addEventListener('DOMContentLoaded', function () {
${mountCalls.join('\n')}
      });
    </script>
  </body>
</html>
`;

  return { ok: true, build, html, mounts, bundleErrors };
}
