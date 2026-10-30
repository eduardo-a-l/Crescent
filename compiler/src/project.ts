import * as fs from 'fs';
import * as path from 'path';
import { CodegenError, generateProgram, ImportBinding } from './codegen';
import { checkFile, Diagnostic } from './checker';
import { LexError } from './lexer';
import { ParseError } from './parser';
import {
  FileImports,
  findCycles,
  jsRequirePath,
  loadAllPrograms,
  LoadedFile,
  ModuleIssue,
  resolveFileImportsLenient,
  runtimeRequirePathFor,
} from './modules';

export interface FatalDiagnostic {
  stage: 'parse';
  message: string;
  file: string | null;
  line: number | null;
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
        fatal: { stage: 'parse', message: e.message, file: e.file ?? null, line: null },
        files: new Map(),
        importsByFile: new Map(),
        diagnosticsByFile: new Map(),
      };
    }
    throw e;
  }

  const importsByFile = new Map<string, FileImports[]>();
  const issuesByFile = new Map<string, ModuleIssue[]>();
  const unresolvedByFile = new Map<string, Set<string>>();
  for (const [relPath, file] of files) {
    const resolved = resolveFileImportsLenient(file, files);
    importsByFile.set(relPath, resolved.imports);
    issuesByFile.set(relPath, resolved.issues);
    unresolvedByFile.set(relPath, resolved.unresolved);
  }
  for (const issue of findCycles(files, importsByFile)) {
    issuesByFile.get(issue.file)!.push(issue);
  }

  const diagnosticsByFile = new Map<string, Diagnostic[]>();
  for (const [relPath, file] of files) {
    const moduleDiagnostics: Diagnostic[] = (issuesByFile.get(relPath) ?? [])
      .slice()
      .sort((a, b) => a.line - b.line)
      .map((issue) => ({ severity: 'error', message: issue.message, where: `file '${relPath}'`, line: issue.line }));
    const fileImports = importsByFile.get(relPath) ?? [];
    const checked = checkFile(file, files, fileImports, unresolvedByFile.get(relPath));
    diagnosticsByFile.set(relPath, [...moduleDiagnostics, ...checked]);
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

  const skipped = new Map<string, string>();
  const unexpected = new Map<string, string>();
  const generated = new Map<string, string>();

  for (const [relPath, file] of check.files) {
    const diagnostics = check.diagnosticsByFile.get(relPath) ?? [];
    if (diagnostics.some((d) => d.severity === 'error')) {
      skipped.set(relPath, 'semantic errors must be fixed first');
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

      generated.set(relPath, generateProgram(file.program, runtimeRequirePathFor(relPath), Array.from(bindingsByTarget.values())));
    } catch (e) {
      if (e instanceof CodegenError) {
        skipped.set(relPath, e.message);
      } else {
        unexpected.set(relPath, (e as Error).message);
      }
    }
  }

  const unavailable = (relPath: string): boolean => skipped.has(relPath) || unexpected.has(relPath);
  const blockedBy = new Map<string, string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const relPath of generated.keys()) {
      if (blockedBy.has(relPath)) continue;
      for (const imp of check.importsByFile.get(relPath) ?? []) {
        if (!imp.names.some((n) => n.kind === 'component')) continue;
        if (unavailable(imp.targetRelPath) || blockedBy.has(imp.targetRelPath)) {
          blockedBy.set(relPath, imp.targetRelPath);
          changed = true;
          break;
        }
      }
    }
  }

  for (const relPath of check.files.keys()) {
    const reason = skipped.get(relPath);
    if (reason !== undefined) {
      builds.push({ relPath, outFile: null, skippedReason: reason, unexpectedError: null });
      continue;
    }
    const failure = unexpected.get(relPath);
    if (failure !== undefined) {
      builds.push({ relPath, outFile: null, skippedReason: null, unexpectedError: failure });
      continue;
    }
    const blocker = blockedBy.get(relPath);
    if (blocker !== undefined) {
      builds.push({ relPath, outFile: null, skippedReason: `'${blocker}', which it imports, was not built`, unexpectedError: null });
      continue;
    }
    try {
      const outFile = path.join(genDir, relPath.replace(/\.crs$/, '.js'));
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, generated.get(relPath)!, 'utf-8');
      builds.push({ relPath, outFile, skippedReason: null, unexpectedError: null });
    } catch (e) {
      builds.push({ relPath, outFile: null, skippedReason: null, unexpectedError: (e as Error).message });
    }
  }

  return { check, outDir, genDir, builds };
}
