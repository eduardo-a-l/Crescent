#!/usr/bin/env node
import * as path from 'path';
import { Diagnostic } from './checker';
import { BuildProjectResult, CheckProjectResult, buildProject, checkProject } from './project';

function printUsage(): void {
  console.log(`Crescent compiler CLI

Usage:
  crescent check [path]
  crescent build [path] --out-dir <dir>

  [path] defaults to the current directory.`);
}

function printFileDiagnostics(relPath: string, diagnostics: Diagnostic[]): void {
  for (const d of diagnostics) {
    const location = d.line > 0 ? `${relPath}:${d.line}` : relPath;
    console.log(`${location} [${d.severity}] ${d.where}: ${d.message}`);
  }
}

function reportCheck(result: CheckProjectResult): number {
  if (result.fatal) {
    console.error(`error: ${result.fatal.message}`);
    return 1;
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  for (const [relPath, diagnostics] of result.diagnosticsByFile) {
    printFileDiagnostics(relPath, diagnostics);
    totalErrors += diagnostics.filter((d) => d.severity === 'error').length;
    totalWarnings += diagnostics.filter((d) => d.severity === 'warning').length;
  }

  if (result.files.size === 0) {
    console.log('No .crs files found.');
  } else if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`OK — ${result.files.size} file(s) checked, no problems found.`);
  } else {
    console.log(`${totalErrors} error(s), ${totalWarnings} warning(s) in ${result.files.size} file(s).`);
  }

  return totalErrors > 0 ? 1 : 0;
}

function reportBuild(result: BuildProjectResult): number {
  const checkExitCode = reportCheck(result.check);
  let hadUnexpected = false;

  for (const build of result.builds) {
    if (build.outFile) {
      console.log(`Codegen OK — wrote ${path.relative(process.cwd(), build.outFile)}`);
    } else if (build.unexpectedError) {
      console.error(`FAILED: ${build.relPath}: ${build.unexpectedError}`);
      hadUnexpected = true;
    } else if (build.skippedReason) {
      console.log(`${build.relPath}: codegen skipped: ${build.skippedReason}`);
    }
  }

  return hadUnexpected ? 1 : checkExitCode;
}

interface ParsedArgs {
  command: string;
  root: string;
  outDir: string | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  let outDir: string | null = null;
  const positionals: string[] = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--out-dir') {
      i += 1;
      outDir = rest[i] ?? null;
    } else {
      positionals.push(arg);
    }
  }

  return { command: command ?? '', root: positionals[0] ?? '.', outDir };
}

function main(): void {
  const { command, root, outDir } = parseArgs(process.argv.slice(2));
  const absRoot = path.resolve(process.cwd(), root);

  if (command === 'check') {
    process.exitCode = reportCheck(checkProject(absRoot));
    return;
  }

  if (command === 'build') {
    if (!outDir) {
      console.error('error: crescent build requires --out-dir <dir>');
      process.exitCode = 1;
      return;
    }
    const absOutDir = path.resolve(process.cwd(), outDir);
    process.exitCode = reportBuild(buildProject(absRoot, absOutDir));
    return;
  }

  printUsage();
  process.exitCode = command ? 1 : 0;
}

main();
