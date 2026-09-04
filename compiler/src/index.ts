import * as path from 'path';
import { Diagnostic } from './checker';
import { buildProject } from './project';

const examplesDir = path.join(__dirname, '..', 'examples');
const distDir = path.join(__dirname, '..', 'dist');

function printDiagnostics(diagnostics: Diagnostic[]): void {
  for (const d of diagnostics) {
    const location = d.line > 0 ? `${d.where}, line ${d.line}` : d.where;
    const label = d.severity === 'error' ? 'error' : 'warning';
    console.log(`  [${label}] ${location}: ${d.message}`);
  }
}

const result = buildProject(examplesDir, distDir);

if (result.check.fatal) {
  console.error(`\nFAILED: ${result.check.fatal.message}`);
  process.exitCode = 1;
} else {
  for (const [relPath, file] of result.check.files) {
    console.log(`\n=== ${relPath} ===`);
    console.log(`Parsed OK — ${file.program.declarations.length} top-level declaration(s)`);

    const diagnostics = result.check.diagnosticsByFile.get(relPath) ?? [];
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

    const build = result.builds.find((b) => b.relPath === relPath);
    if (build?.outFile) {
      console.log(`Codegen OK — wrote ${path.relative(process.cwd(), build.outFile)}`);
    } else if (build?.unexpectedError) {
      console.error(`FAILED: ${build.unexpectedError}`);
      process.exitCode = 1;
    } else if (build?.skippedReason) {
      console.log(`Codegen skipped: ${build.skippedReason}`);
    }
  }
}
