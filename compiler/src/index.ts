import * as fs from 'fs';
import * as path from 'path';
import { parseCrescent } from './parser';
import { generateProgram, CodegenError } from './codegen';

const examplesDir = path.join(__dirname, '..', 'examples');
const outDir = path.join(__dirname, '..', 'dist', 'gen');
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(examplesDir).filter((f) => f.endsWith('.crs'));

for (const file of files) {
  const source = fs.readFileSync(path.join(examplesDir, file), 'utf-8');
  console.log(`\n=== ${file} ===`);
  try {
    const ast = parseCrescent(source);
    console.log(`Parsed OK — ${ast.declarations.length} top-level declaration(s)`);

    try {
      const js = generateProgram(ast);
      const outFile = path.join(outDir, file.replace(/\.crs$/, '.js'));
      fs.writeFileSync(outFile, js, 'utf-8');
      console.log(`Codegen OK — wrote ${path.relative(process.cwd(), outFile)}`);
    } catch (e) {
      if (e instanceof CodegenError) {
        console.log(`Codegen skipped: ${e.message}`);
      } else {
        throw e;
      }
    }
  } catch (e) {
    console.error(`FAILED: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
