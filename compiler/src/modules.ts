import * as fs from 'fs';
import * as path from 'path';
import * as AST from './ast';
import { parseCrescent } from './parser';

export class ModuleError extends Error {}

export interface LoadedFile {
  relPath: string;
  program: AST.Program;
}

export function loadAllPrograms(rootDir: string): Map<string, LoadedFile> {
  const files = new Map<string, LoadedFile>();

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.crs')) {
        const relPath = path.relative(rootDir, full).split(path.sep).join('/');
        const source = fs.readFileSync(full, 'utf-8');
        const program = parseCrescent(source);
        files.set(relPath, { relPath, program });
      }
    }
  }

  walk(rootDir);
  return files;
}

export function resolveUsePath(fromFileRelPath: string, segments: string[]): string {
  const fromDir = path.posix.dirname(fromFileRelPath);
  const baseDir = fromDir === '.' ? '' : fromDir;
  const parts = baseDir === '' ? [] : baseDir.split('/');

  for (const seg of segments) {
    if (seg === 'super') {
      if (parts.length === 0) {
        throw new ModuleError(`'super' cannot go above the project root (while resolving an import in '${fromFileRelPath}')`);
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
}

export function resolveFileImports(file: LoadedFile, files: Map<string, LoadedFile>): FileImports[] {
  const result: FileImports[] = [];

  for (const decl of file.program.declarations) {
    if (decl.kind !== 'UseDecl') continue;

    const targetRelPath = resolveUsePath(file.relPath, decl.pathSegments);
    const target = files.get(targetRelPath);
    if (!target) {
      throw new ModuleError(
        `Cannot find module '${targetRelPath}' (imported from '${file.relPath}' via 'use ${decl.pathSegments.join('::')}::...;')`
      );
    }

    const names: ResolvedImportName[] = [];
    for (const item of decl.items) {
      const found = target.program.declarations.find(
        (d): d is AST.ComponentDecl | AST.StructDecl =>
          (d.kind === 'ComponentDecl' || d.kind === 'StructDecl') && d.name === item.name
      );
      if (!found) {
        throw new ModuleError(`'${item.name}' is not defined at the top level of '${targetRelPath}' (imported from '${file.relPath}')`);
      }
      names.push({
        local: item.alias ?? item.name,
        imported: item.name,
        kind: found.kind === 'ComponentDecl' ? 'component' : 'struct',
      });
    }

    result.push({ targetRelPath, names });
  }

  return result;
}

export function detectCycles(files: Map<string, LoadedFile>, allImports: Map<string, FileImports[]>): void {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const key of files.keys()) color.set(key, WHITE);

  function visit(node: string, stack: string[]): void {
    color.set(node, GRAY);
    stack.push(node);

    const imports = allImports.get(node) ?? [];
    const targets = Array.from(new Set(imports.map((i) => i.targetRelPath)));
    for (const target of targets) {
      const state = color.get(target);
      if (state === GRAY) {
        const cycleStart = stack.indexOf(target);
        const chain = [...stack.slice(cycleStart), target];
        throw new ModuleError(`Circular import: ${chain.join(' -> ')}`);
      }
      if (state === WHITE) visit(target, stack);
    }

    stack.pop();
    color.set(node, BLACK);
  }

  for (const key of files.keys()) {
    if (color.get(key) === WHITE) visit(key, []);
  }
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
