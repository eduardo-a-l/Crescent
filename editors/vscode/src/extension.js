const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let outputChannel;
let diagnosticCollection;

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

  const handleDocumentEvent = (document) => {
    if (document.languageId !== 'crescent') return;
    refreshDiagnostics(getProjectRootForDocument(document));
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
