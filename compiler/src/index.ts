import * as fs from 'fs';
import * as path from 'path';
import { parseCrescent } from './parser';

const examplesDir = path.join(__dirname, '..', 'examples');
const files = fs.readdirSync(examplesDir).filter((f) => f.endsWith('.crs'));

for (const file of files) {
  const source = fs.readFileSync(path.join(examplesDir, file), 'utf-8');
  console.log(`\n=== ${file} ===`);
  try {
    const ast = parseCrescent(source);
    console.log(`Parsed OK — ${ast.declarations.length} top-level declaration(s)`);
    console.log(JSON.stringify(ast, null, 2));
  } catch (e) {
    console.error(`FAILED: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
