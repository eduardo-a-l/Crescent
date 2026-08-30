import * as fs from 'fs';
import * as path from 'path';
import { CodegenError, generateProgram, ImportBinding } from './codegen';
import { checkFile, Diagnostic } from './checker';
import {
  detectCycles,
  FileImports,
  jsRequirePath,
  loadAllPrograms,
  ModuleError,
  resolveFileImports,
  runtimeRequirePathFor,
} from './modules';

const examplesDir = path.join(__dirname, '..', 'examples');
const outDir = path.join(__dirname, '..', 'dist', 'gen');
fs.mkdirSync(outDir, { recursive: true });

const files = loadAllPrograms(examplesDir);

const importsByFile = new Map<string, FileImports[]>();
let cycleError: Error | null = null;
try {
  for (const [relPath, file] of files) {
    importsByFile.set(relPath, resolveFileImports(file, files));
  }
  detectCycles(files, importsByFile);
} catch (e) {
  if (e instanceof ModuleError) {
    cycleError = e;
  } else {
    throw e;
  }
}

function printDiagnostics(diagnostics: Diagnostic[]): void {
  for (const d of diagnostics) {
    const location = d.line > 0 ? `${d.where}, line ${d.line}` : d.where;
    const label = d.severity === 'error' ? 'error' : 'warning';
    console.log(`  [${label}] ${location}: ${d.message}`);
  }
}

if (cycleError) {
  console.error(`\nFAILED: ${cycleError.message}`);
  process.exitCode = 1;
} else {
  for (const [relPath, file] of files) {
    console.log(`\n=== ${relPath} ===`);
    console.log(`Parsed OK — ${file.program.declarations.length} top-level declaration(s)`);

    const fileImports = importsByFile.get(relPath) ?? [];
    const diagnostics = checkFile(file, files, fileImports);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    const warnings = diagnostics.filter((d) => d.severity === 'warning');

    if (diagnostics.length > 0) {
      console.log(`Semantic check found ${errors.length} error(s), ${warnings.length} warning(s):`);
      printDiagnostics(diagnostics);
    } else {
      console.log('Semantic check OK');
    }

    if (errors.length > 0) {
      console.log('Codegen skipped: semantic errors above must be fixed first');
      continue;
    }

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
      const outFile = path.join(outDir, relPath.replace(/\.crs$/, '.js'));
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, js, 'utf-8');
      console.log(`Codegen OK — wrote ${path.relative(process.cwd(), outFile)}`);
    } catch (e) {
      if (e instanceof CodegenError) {
        console.log(`Codegen skipped: ${e.message}`);
      } else {
        console.error(`FAILED: ${(e as Error).message}`);
        process.exitCode = 1;
      }
    }
  }
}
