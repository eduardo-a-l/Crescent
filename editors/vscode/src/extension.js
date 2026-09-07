const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let outputChannel;
let diagnosticCollection;
let previewPanel;
// The project root the currently open preview panel was built from, so a
// save in a *different* open project doesn't reload this one's preview.
let previewRoot;

function getConfig() {
  return vscode.workspace.getConfiguration('crescent');
}

function getProjectRoot() {
  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  if (activeUri) {
    const folder = vscode.workspace.getWorkspaceFolder(activeUri);
    if (folder) return folder.uri.fsPath;
  }
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) return folders[0].uri.fsPath;
  return null;
}

// The project root for a specific document being saved/opened: its workspace
// folder if it has one, otherwise the file's own directory (so a single .crs
// file opened without a folder still gets checked, treating its directory as
// the project — a reasonable fallback, though it means any sibling .crs files
// in that directory get checked too, not just the one that was saved).
function getProjectRootForDocument(document) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (folder) return folder.uri.fsPath;
  return path.dirname(document.uri.fsPath);
}

// Looks for compiler/dist/ above `startDir`, matching this monorepo's own
// layout (compiler/src/*.ts compiled to compiler/dist/*.js). This is a
// convenience default for developing Crescent itself; `crescent.cliPath`
// always wins when set.
function findDistDir(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(dir, 'compiler', 'dist');
    if (fs.existsSync(path.join(candidate, 'cli.js'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// A path to the CLI: `crescent.cliPath` if set (a path, or a bare command
// such as "crescent" available on PATH after `npm link`), otherwise an
// auto-detected compiler/dist/cli.js.
function findCliPath(startDir) {
  const configured = getConfig().get('cliPath');
  if (configured && configured.trim().length > 0) return configured.trim();
  const distDir = findDistDir(startDir);
  return distDir ? path.join(distDir, 'cli.js') : null;
}

// A path to the compiled project.js module (checkProject()/buildProject()),
// for in-process diagnostics. Only resolvable when we have an actual
// filesystem path to compiler/dist (a configured bare `crescent.cliPath`
// command gives us no directory to find project.js next to, so diagnostics
// fall back to reporting that the compiler couldn't be loaded rather than
// guessing a location).
function findProjectModulePath(startDir) {
  const configured = getConfig().get('cliPath');
  if (configured && configured.trim().endsWith('.js')) {
    return path.join(path.dirname(configured.trim()), 'project.js');
  }
  const distDir = findDistDir(startDir);
  return distDir ? path.join(distDir, 'project.js') : null;
}

// Same resolution strategy as findProjectModulePath(), for the compiled
// webPreview.js (buildPreviewHtml()) module used by "Crescent: Preview".
function findWebPreviewModulePath(startDir) {
  const configured = getConfig().get('cliPath');
  if (configured && configured.trim().endsWith('.js')) {
    return path.join(path.dirname(configured.trim()), 'webPreview.js');
  }
  const distDir = findDistDir(startDir);
  return distDir ? path.join(distDir, 'webPreview.js') : null;
}

function runCrescentCommand(actionLabel, buildArgs) {
  const root = getProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage('Crescent: open a folder before running this command.');
    return;
  }

  const cliPath = findCliPath(root);
  if (!cliPath) {
    vscode.window.showErrorMessage(
      'Crescent: could not find the compiler CLI. Build it (`npm run build` inside compiler/) ' +
        'or set the "crescent.cliPath" setting.',
    );
    return;
  }

  const runsAsScript = cliPath.endsWith('.js');
  const command = runsAsScript ? process.execPath : cliPath;
  const args = runsAsScript ? [cliPath, ...buildArgs(root)] : buildArgs(root);

  if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Crescent');
  outputChannel.show(true);
  outputChannel.appendLine(`\n> crescent ${buildArgs(root).join(' ')}`);

  const child = spawn(command, args, { cwd: root });
  child.stdout.on('data', (data) => outputChannel.append(data.toString()));
  child.stderr.on('data', (data) => outputChannel.append(data.toString()));
  child.on('error', (err) => {
    outputChannel.appendLine(`Failed to run crescent: ${err.message}`);
  });
  child.on('close', (code) => {
    outputChannel.appendLine(`\n${actionLabel} exited with code ${code}`);
  });
}

// require()s compiler/dist/project.js. Node caches this by resolved path, so
// if the compiler is rebuilt while this extension host is still running, the
// stale in-memory version keeps being used until the Extension Development
// Host window is reloaded — a known dev-loop limitation, not something worth
// working around (e.g. with cache-busting) for how rarely it matters.
function loadProjectModule(root) {
  const modulePath = findProjectModulePath(root);
  if (!modulePath || !fs.existsSync(modulePath)) return null;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(modulePath);
  } catch (err) {
    outputChannel?.appendLine(`Crescent: failed to load the compiler from ${modulePath}: ${err.message}`);
    return null;
  }
}

// require()s compiler/dist/webPreview.js. Same Node module-cache caveat as
// loadProjectModule() above: a mid-session compiler rebuild needs a
// Development Host reload to be picked up.
function loadWebPreviewModule(root) {
  const modulePath = findWebPreviewModulePath(root);
  if (!modulePath || !fs.existsSync(modulePath)) return null;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(modulePath);
  } catch (err) {
    outputChannel?.appendLine(`Crescent: failed to load the compiler from ${modulePath}: ${err.message}`);
    return null;
  }
}

function severityFor(diagnosticSeverity) {
  return diagnosticSeverity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
}

// checker.ts's Diagnostic only carries a line number, not a column, so every
// diagnostic is reported as spanning the whole line. `line` is 1-based from
// the checker; vscode.Range is 0-based, and a `line <= 0` (shouldn't happen
// for per-file diagnostics, but checked defensively) falls back to line 0.
function wholeLineRange(line) {
  const zeroBased = line > 0 ? line - 1 : 0;
  return new vscode.Range(zeroBased, 0, zeroBased, Number.MAX_SAFE_INTEGER);
}

// Runs checkProject() for `root` and republishes the *entire* diagnostic
// collection from its result. This means diagnostics for every .crs file
// under `root` are recomputed on every save/open, not just the file that
// triggered it — correct, since a duplicate-declaration or undefined-name
// diagnostic can depend on other files via `use` imports, but it also means
// diagnostics for a *different* open project are cleared until that project
// is itself saved/opened again. Acceptable for the multi-root-workspace case
// this v0.x pass doesn't specifically handle; see editors/vscode/README.md.
function refreshDiagnostics(root) {
  const projectModule = loadProjectModule(root);
  if (!projectModule || typeof projectModule.checkProject !== 'function') {
    if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Crescent');
    outputChannel.appendLine(
      'Crescent: could not load the compiler to compute diagnostics. Build it ' +
        '(`npm run build` inside compiler/), or set "crescent.cliPath" to a compiled ' +
        'compiler/dist/cli.js.',
    );
    return;
  }

  let result;
  try {
    result = projectModule.checkProject(root);
  } catch (err) {
    outputChannel?.appendLine(`Crescent: diagnostics failed unexpectedly: ${err.message}`);
    return;
  }

  diagnosticCollection.clear();

  if (result.fatal) {
    if (result.fatal.file) {
      const diagnostic = new vscode.Diagnostic(wholeLineRange(0), result.fatal.message, vscode.DiagnosticSeverity.Error);
      diagnostic.source = 'crescent';
      diagnosticCollection.set(vscode.Uri.file(path.join(root, result.fatal.file)), [diagnostic]);
    } else {
      // A module-level error (import cycle, missing export/module) doesn't
      // point at one canonical file — see FatalDiagnostic in project.ts.
      // Its message already names the files involved, so surface it directly
      // rather than attributing it to a guessed file.
      vscode.window.showErrorMessage(`Crescent: ${result.fatal.message}`);
    }
    return;
  }

  for (const [relPath, diagnostics] of result.diagnosticsByFile) {
    if (diagnostics.length === 0) continue;
    const vsDiagnostics = diagnostics.map((d) => {
      const diagnostic = new vscode.Diagnostic(wholeLineRange(d.line), `${d.where}: ${d.message}`, severityFor(d.severity));
      diagnostic.source = 'crescent';
      return diagnostic;
    });
    diagnosticCollection.set(vscode.Uri.file(path.join(root, relPath)), vsDiagnostics);
  }
}

// Runs buildPreviewHtml() and reports any failure via showErrorMessage(),
// exactly the way it did inline before this was split out — shared by both
// "show in a webview panel" (refreshPreview) and "open in a real browser
// tab" (openPreviewInBrowser) below, so both destinations agree on what
// counts as a build failure and how it's reported.
async function buildPreviewResult(root) {
  const webPreviewModule = loadWebPreviewModule(root);
  if (!webPreviewModule || typeof webPreviewModule.buildPreviewHtml !== 'function') {
    vscode.window.showErrorMessage(
      'Crescent: could not load the compiler to build the preview. Build it ' +
        '(`npm run build` inside compiler/), or set "crescent.cliPath" to a compiled ' +
        'compiler/dist/cli.js.',
    );
    return null;
  }

  const outDirSetting = getConfig().get('outDir') || 'dist';
  // Nested under a `preview/` subdirectory of the configured build output so
  // it doesn't collide with a "Crescent: Build" run's own `gen/`/`runtime.js`.
  const previewOutDir = path.join(root, outDirSetting, 'preview');

  let result;
  try {
    result = await webPreviewModule.buildPreviewHtml(root, previewOutDir);
  } catch (err) {
    vscode.window.showErrorMessage(`Crescent: preview build failed unexpectedly: ${err.message}`);
    return null;
  }

  if (!result.ok) {
    // A fatal parse/module error, same shape as refreshDiagnostics() above —
    // there is no partial HTML to show in that case.
    const detail = result.build.check.fatal ? result.build.check.fatal.message : 'unknown error';
    vscode.window.showErrorMessage(`Crescent: preview build failed: ${detail}`);
    return null;
  }

  return { html: result.html, previewOutDir };
}

// Builds the project and shows the bundled browser output in a webview
// panel: "opens" it on first run, "reloads" it (replacing its HTML in place)
// on subsequent runs, matching the TODO.md wording ("builds the project and
// opens/reloads the browser output"). `reveal` controls whether the panel is
// brought to the front — true for an explicit "Crescent: Preview" invocation,
// false for the on-save auto-refresh below, so saving doesn't keep stealing
// focus from the editor.
async function refreshPreview(root, reveal) {
  const built = await buildPreviewResult(root);
  if (!built) return;

  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel('crescentPreview', 'Crescent Preview', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    previewPanel.onDidDispose(() => {
      previewPanel = undefined;
      previewRoot = undefined;
    });
  } else if (reveal) {
    previewPanel.reveal(vscode.ViewColumn.Beside, true);
  }

  previewRoot = root;
  previewPanel.webview.html = built.html;
}

// Builds the project and writes the same HTML `refreshPreview()` would show
// in a webview panel to `<root>/<crescent.outDir>/preview/index.html`, then
// opens it in the system's real default browser via `vscode.env.openExternal`
// — a genuine `file://` page, not sandboxed inside VS Code's webview CSP, so
// e.g. browser devtools/extensions work on it normally. Unlike the panel,
// this is a one-shot "build now, open now": there's no live connection to an
// already-open browser tab to push a reload into, so running the command
// again just rewrites the same file and re-invokes the OS's "open" on it —
// most browsers reuse an already-open tab for the same `file://` URL and
// pick up the change on their own refresh, but that's the browser's/OS's
// behavior to control, not something this extension can guarantee.
async function openPreviewInBrowser(root) {
  const built = await buildPreviewResult(root);
  if (!built) return;

  const htmlPath = path.join(built.previewOutDir, 'index.html');
  try {
    fs.writeFileSync(htmlPath, built.html, 'utf8');
  } catch (err) {
    vscode.window.showErrorMessage(`Crescent: could not write the preview file: ${err.message}`);
    return;
  }

  await vscode.env.openExternal(vscode.Uri.file(htmlPath));
}

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Crescent');
  context.subscriptions.push(outputChannel);

  diagnosticCollection = vscode.languages.createDiagnosticCollection('crescent');
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.commands.registerCommand('crescent.check', () => {
      runCrescentCommand('Check', (root) => ['check', root]);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('crescent.build', () => {
      runCrescentCommand('Build', (root) => {
        const outDirSetting = getConfig().get('outDir') || 'dist';
        return ['build', root, '--out-dir', path.join(root, outDirSetting)];
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('crescent.preview', () => {
      const root = getProjectRoot();
      if (!root) {
        vscode.window.showErrorMessage('Crescent: open a folder before running this command.');
        return undefined;
      }
      return refreshPreview(root, true);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('crescent.previewInBrowser', () => {
      const root = getProjectRoot();
      if (!root) {
        vscode.window.showErrorMessage('Crescent: open a folder before running this command.');
        return undefined;
      }
      return openPreviewInBrowser(root);
    }),
  );

  const handleDocumentEvent = (document) => {
    if (document.languageId !== 'crescent') return;
    const root = getProjectRootForDocument(document);
    refreshDiagnostics(root);
    // Only reload an already-open preview, and only when the saved/opened
    // document belongs to the same project it was built from — otherwise a
    // save in a different open project would silently rebuild and replace
    // this one's preview. Not revealed (reveal=false): saving shouldn't
    // steal focus away from the editor the user is actively working in.
    if (previewPanel && previewRoot === root) {
      refreshPreview(root, false);
    }
  };

  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(handleDocumentEvent));
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(handleDocumentEvent));

  // Populate diagnostics for any .crs files already open when the extension
  // activates, so opening a broken file doesn't show a clean editor until the
  // user happens to save it once.
  for (const document of vscode.workspace.textDocuments) {
    handleDocumentEvent(document);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
