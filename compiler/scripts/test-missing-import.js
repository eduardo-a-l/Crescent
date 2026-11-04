const path = require('path');
const { loadAllPrograms, resolveFileImports, ModuleError } = require(path.join(__dirname, '..', 'dist', 'modules.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const missingModuleDir = path.join(__dirname, 'fixtures', 'missing-module');
const missingModuleFiles = loadAllPrograms(missingModuleDir);
try {
  resolveFileImports(missingModuleFiles.get('main.crs'), missingModuleFiles);
  assert(false, 'importing a nonexistent module should have thrown a ModuleError');
} catch (err) {
  assert(err instanceof ModuleError, `threw ModuleError, got ${err.constructor.name}: ${err.message}`);
  assert(/Cannot find module 'nonexistent.crs'/.test(err.message), `error message names the missing module, got "${err.message}"`);
}

const missingExportDir = path.join(__dirname, 'fixtures', 'missing-export');
const missingExportFiles = loadAllPrograms(missingExportDir);
try {
  resolveFileImports(missingExportFiles.get('main.crs'), missingExportFiles);
  assert(false, 'importing an undefined name from a real module should have thrown a ModuleError');
} catch (err) {
  assert(err instanceof ModuleError, `threw ModuleError, got ${err.constructor.name}: ${err.message}`);
  assert(
    /'Ghost' is not defined at the top level of 'lib.crs'/.test(err.message),
    `error message names the missing export, got "${err.message}"`
  );
}
