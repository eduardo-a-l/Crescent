const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let outputChannel;

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

// Looks for compiler/dist/cli.js above `startDir`, matching this monorepo's own
// layout (compiler/src/cli.ts compiled to compiler/dist/cli.js). This is a
// convenience default for developing Crescent itself; `crescent.cliPath` (a
// path, or a bare command such as "crescent" after `npm link`) always wins.
function findCliPath(startDir) {
  const configured = getConfig().get('cliPath');
  if (configured && configured.trim().length > 0) return configured.trim();

  let dir = startDir;
  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(dir, 'compiler', 'dist', 'cli.js');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
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

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Crescent');
  context.subscriptions.push(outputChannel);

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
}

function deactivate() {}

module.exports = { activate, deactivate };
