import * as fs from 'fs';
import * as path from 'path';
import { CodegenError, generateProgram, ImportBinding } from './codegen';
import { checkFile, Diagnostic } from './checker';
import { LexError } from './lexer';
import { ParseError } from './parser';
import {
  detectCycles,
  FileImports,
  jsRequirePath,
  loadAllPrograms,
  LoadedFile,
  ModuleError,
  resolveFileImports,
  runtimeRequirePathFor,
} from './modules';

export interface FatalDiagnostic {
  stage: 'parse' | 'module';
  message: string;
  // The file that failed, when known. Parse/lex errors carry this (see
  // loadAllPrograms() in modules.ts); module errors (import cycles, missing
  // exports) don't have a single canonical file — their message text already
  // names the files involved (e.g. "... in 'lib.crs' (imported from
  // 'main.crs')"), so this is left null rather than guessing which one to
  // surface as *the* file.
  file: string | null;
}

export interface CheckProjectResult {
  ok: boolean;
  fatal: FatalDiagnostic | null;
  files: Map<string, LoadedFile>;
  importsByFile: Map<string, FileImports[]>;
  diagnosticsByFile: Map<string, Diagnostic[]>;
}

export function checkProject(root: string): CheckProjectResult {
  let files: Map<string, LoadedFile>;
  try {
    files = loadAllPrograms(root);
  } catch (e) {
    if (e instanceof LexError || e instanceof ParseError) {
      return {
        ok: false,
        fatal: { stage: 'parse', message: e.message, file: e.file ?? null },
        files: new Map(),
        importsByFile: new Map(),
        diagnosticsByFile: new Map(),
      };
    }
    throw e;
  }

  const importsByFile = new Map<string, FileImports[]>();
  try {
    for (const [relPath, file] of files) {
      importsByFile.set(relPath, resolveFileImports(file, files));
    }
    detectCycles(files, importsByFile);
  } catch (e) {
    if (e instanceof ModuleError) {
      return {
        ok: false,
        fatal: { stage: 'module', message: e.message, file: null },
        files,
        importsByFile,
        diagnosticsByFile: new Map(),
      };
    }
    throw e;
  }

  const diagnosticsByFile = new Map<string, Diagnostic[]>();
  for (const [relPath, file] of files) {
    const fileImports = importsByFile.get(relPath) ?? [];
    diagnosticsByFile.set(relPath, checkFile(file, files, fileImports));
  }

  return { ok: true, fatal: null, files, importsByFile, diagnosticsByFile };
}

export interface FileBuildResult {
  relPath: string;
  outFile: string | null;
  skippedReason: string | null;
  unexpectedError: string | null;
}

export interface BuildProjectResult {
  check: CheckProjectResult;
  outDir: string;
  genDir: string;
  builds: FileBuildResult[];
}

export function buildProject(root: string, outDir: string): BuildProjectResult {
  const check = checkProject(root);
  const genDir = path.join(outDir, 'gen');
  const builds: FileBuildResult[] = [];

  if (!check.ok) {
    return { check, outDir, genDir, builds };
  }

  fs.mkdirSync(genDir, { recursive: true });

  const runtimeSrc = path.join(__dirname, 'runtime.js');
  const runtimeDest = path.join(outDir, 'runtime.js');
  if (fs.existsSync(runtimeSrc) && path.resolve(runtimeSrc) !== path.resolve(runtimeDest)) {
    fs.copyFileSync(runtimeSrc, runtimeDest);
  }

  for (const [relPath, file] of check.files) {
    const diagnostics = check.diagnosticsByFile.get(relPath) ?? [];
    const errors = diagnostics.filter((d) => d.severity === 'error');
    if (errors.length > 0) {
      builds.push({
        relPath,
        outFile: null,
        skippedReason: 'semantic errors must be fixed first',
        unexpectedError: null,
      });
      continue;
    }

    const fileImports = check.importsByFile.get(relPath) ?? [];
    try {
      const bindingsByTarget = new Map<string, ImportBinding>();
      for (const imp of fileImports) {
        const componentNames = imp.names.filter((n) => n.kind === 'component');
        if (componentNames.length === 0) continue;
        const requirePath = jsRequirePath(relPath, imp.targetRelPath);
        const existing = bindingsByTarget.get(requirePath);
        if (existing) {
          existing.names.push(...componentNames.map((n) => ({ local: n.local, imported: n.imported })));
        } else {
          bindingsByTarget.set(requirePath, {
            requirePath,
            names: componentNames.map((n) => ({ local: n.local, imported: n.imported })),
          });
        }
      }

      const js = generateProgram(file.program, runtimeRequirePathFor(relPath), Array.from(bindingsByTarget.values()));
      const outFile = path.join(genDir, relPath.replace(/\.crs$/, '.js'));
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, js, 'utf-8');
      builds.push({ relPath, outFile, skippedReason: null, unexpectedError: null });
    } catch (e) {
      if (e instanceof CodegenError) {
        builds.push({ relPath, outFile: null, skippedReason: e.message, unexpectedError: null });
      } else {
        builds.push({ relPath, outFile: null, skippedReason: null, unexpectedError: (e as Error).message });
      }
    }
  }

  return { check, outDir, genDir, builds };
}
