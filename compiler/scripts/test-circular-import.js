const path = require('path');
const { loadAllPrograms, resolveFileImports, detectCycles, ModuleError } = require(path.join(__dirname, '..', 'dist', 'modules.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const fixturesDir = path.join(__dirname, 'fixtures', 'circular-modules');
const files = loadAllPrograms(fixturesDir);

try {
  const importsByFile = new Map();
  for (const [relPath, file] of files) {
    importsByFile.set(relPath, resolveFileImports(file, files));
  }
  detectCycles(files, importsByFile);
  assert(false, 'a circular import between a.crs and b.crs should have thrown a ModuleError');
} catch (err) {
  assert(err instanceof ModuleError, `threw ModuleError, got ${err.constructor.name}: ${err.message}`);
  assert(/Circular import:/.test(err.message), `error message identifies it as a circular import, got "${err.message}"`);
  assert(err.message.includes('a.crs') && err.message.includes('b.crs'), `error message names both files in the cycle, got "${err.message}"`);
}
