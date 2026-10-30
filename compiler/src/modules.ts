import * as fs from 'fs';
import * as path from 'path';
import * as AST from './ast';
import { LexError } from './lexer';
import { parseCrescent, ParseError } from './parser';

export class ModuleError extends Error {
  file: string | null;
  line: number | null;

  constructor(message: string, file: string | null = null, line: number | null = null) {
    super(message);
    this.file = file;
    this.line = line;
  }
}

export interface LoadedFile {
  relPath: string;
  program: AST.Program;
}

export function loadAllPrograms(rootDir: string): Map<string, LoadedFile> {
  const files = new Map<string, LoadedFile>();

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.crs')) {
        const relPath = path.relative(rootDir, full).split(path.sep).join('/');
        const source = fs.readFileSync(full, 'utf-8');
        try {
          const program = parseCrescent(source);
          files.set(relPath, { relPath, program });
        } catch (e) {
          if (e instanceof LexError || e instanceof ParseError) {
            e.file = relPath;
          }
          throw e;
        }
      }
    }
  }

  walk(rootDir);
  return files;
}

export function resolveUsePath(fromFileRelPath: string, segments: string[], line: number | null = null): string {
  const fromDir = path.posix.dirname(fromFileRelPath);
  const baseDir = fromDir === '.' ? '' : fromDir;
  const parts = baseDir === '' ? [] : baseDir.split('/');

  for (const seg of segments) {
    if (seg === 'super') {
      if (parts.length === 0) {
        throw new ModuleError(
          `'super' cannot go above the project root (while resolving an import in '${fromFileRelPath}')`,
          fromFileRelPath,
          line
        );
      }
      parts.pop();
    } else {
      parts.push(seg);
    }
  }

  return `${parts.join('/')}.crs`;
}

export interface ResolvedImportName {
  local: string;
  imported: string;
  kind: 'component' | 'struct';
}

export interface FileImports {
  targetRelPath: string;
  names: ResolvedImportName[];
  line: number;
}

export interface ModuleIssue {
  message: string;
  file: string;
  line: number;
}

export interface ResolvedImports {
  imports: FileImports[];
  issues: ModuleIssue[];
  unresolved: Set<string>;
}

export function resolveFileImportsLenient(file: LoadedFile, files: Map<string, LoadedFile>): ResolvedImports {
  const imports: FileImports[] = [];
  const issues: ModuleIssue[] = [];
  const unresolved = new Set<string>();

  for (const decl of file.program.declarations) {
    if (decl.kind !== 'UseDecl') continue;

    const markAllUnresolved = (): void => {
      for (const item of decl.items) unresolved.add(item.alias ?? item.name);
    };

    let targetRelPath: string;
    try {
      targetRelPath = resolveUsePath(file.relPath, decl.pathSegments, decl.line);
    } catch (e) {
      if (!(e instanceof ModuleError)) throw e;
      issues.push({ message: e.message, file: file.relPath, line: decl.line });
      markAllUnresolved();
      continue;
    }

    const target = files.get(targetRelPath);
    if (!target) {
      issues.push({
        message: `Cannot find module '${targetRelPath}' (imported from '${file.relPath}' via 'use ${decl.pathSegments.join('::')}::...;')`,
        file: file.relPath,
        line: decl.line,
      });
      markAllUnresolved();
      continue;
    }

    const names: ResolvedImportName[] = [];
    for (const item of decl.items) {
      const found = target.program.declarations.find(
        (d): d is AST.ComponentDecl | AST.StructDecl =>
          (d.kind === 'ComponentDecl' || d.kind === 'StructDecl') && d.name === item.name
      );
      if (!found) {
        issues.push({
          message: `'${item.name}' is not defined at the top level of '${targetRelPath}' (imported from '${file.relPath}')`,
          file: file.relPath,
          line: decl.line,
        });
        unresolved.add(item.alias ?? item.name);
        continue;
      }
      names.push({
        local: item.alias ?? item.name,
        imported: item.name,
        kind: found.kind === 'ComponentDecl' ? 'component' : 'struct',
      });
    }

    imports.push({ targetRelPath, names, line: decl.line });
  }

  return { imports, issues, unresolved };
}

export function resolveFileImports(file: LoadedFile, files: Map<string, LoadedFile>): FileImports[] {
  const resolved = resolveFileImportsLenient(file, files);
  if (resolved.issues.length > 0) {
    const first = resolved.issues[0];
    throw new ModuleError(first.message, first.file, first.line);
  }
  return resolved.imports;
}

export function findCycles(files: Map<string, LoadedFile>, allImports: Map<string, FileImports[]>): ModuleIssue[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const key of files.keys()) color.set(key, WHITE);
  const issues: ModuleIssue[] = [];

  interface Frame {
    node: string;
    imports: FileImports[];
    targets: string[];
    next: number;
  }

  for (const start of files.keys()) {
    if (color.get(start) !== WHITE) continue;

    const stack: Frame[] = [];
    const enter = (node: string): void => {
      color.set(node, GRAY);
      const imports = allImports.get(node) ?? [];
      stack.push({ node, imports, targets: Array.from(new Set(imports.map((i) => i.targetRelPath))), next: 0 });
    };

    enter(start);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.next >= frame.targets.length) {
        color.set(frame.node, BLACK);
        stack.pop();
        continue;
      }

      const target = frame.targets[frame.next++];
      const state = color.get(target);
      if (state === GRAY) {
        const nodes = stack.map((f) => f.node);
        const chain = [...nodes.slice(nodes.indexOf(target)), target];
        const closing = frame.imports.find((i) => i.targetRelPath === target);
        issues.push({ message: `Circular import: ${chain.join(' -> ')}`, file: frame.node, line: closing ? closing.line : 1 });
        continue;
      }
      if (state === WHITE) enter(target);
    }
  }

  return issues;
}

export function detectCycles(files: Map<string, LoadedFile>, allImports: Map<string, FileImports[]>): void {
  const issues = findCycles(files, allImports);
  if (issues.length > 0) throw new ModuleError(issues[0].message, issues[0].file, issues[0].line);
}

const GEN_ROOT = '/__crescent_gen_root__';

function absOutputPath(relPath: string): string {
  return path.posix.join(GEN_ROOT, relPath.replace(/\.crs$/, ''));
}

function toRelativeRequire(fromDir: string, toPath: string): string {
  let rel = path.posix.relative(fromDir, toPath);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

export function runtimeRequirePathFor(relPath: string): string {
  const fromDir = path.posix.dirname(absOutputPath(relPath));
  const runtimeAbs = path.posix.join(GEN_ROOT, '..', 'runtime');
  return toRelativeRequire(fromDir, runtimeAbs);
}

export function jsRequirePath(fromRelPath: string, toRelPath: string): string {
  const fromDir = path.posix.dirname(absOutputPath(fromRelPath));
  const toAbs = absOutputPath(toRelPath);
  return toRelativeRequire(fromDir, toAbs);
}
