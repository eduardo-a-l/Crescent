const path = require('path');
const { loadAllPrograms, resolveFileImports } = require(path.join(__dirname, '..', 'dist', 'modules.js'));
const { checkFile } = require(path.join(__dirname, '..', 'dist', 'checker.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const files = loadAllPrograms(path.join(__dirname, 'fixtures', 'unused-imports'));

function diagnosticsFor(relPath) {
  const file = files.get(relPath);
  return checkFile(file, files, resolveFileImports(file, files));
}

function assertOnlyWarning(relPath, line, pattern, label) {
  const diagnostics = diagnosticsFor(relPath);
  assert(
    diagnostics.length === 1 &&
      diagnostics[0].severity === 'warning' &&
      diagnostics[0].line === line &&
      pattern.test(diagnostics[0].message),
    `${relPath}: ${label}, got ${JSON.stringify(diagnostics)}`
  );
}

function assertClean(relPath, label) {
  const diagnostics = diagnosticsFor(relPath);
  assert(diagnostics.length === 0, `${relPath}: ${label}, got ${JSON.stringify(diagnostics)}`);
}

assertOnlyWarning('unused-component.crs', 1, /^Import 'Widget' from 'lib\.crs' is never used$/, 'an imported component that is never rendered is reported');
assertOnlyWarning('unused-struct.crs', 1, /^Import 'Point' from 'lib\.crs' is never used$/, 'an imported struct that is never referenced is reported');
assertOnlyWarning('unused-alias.crs', 1, /^Import 'Widget' \(as 'W'\) from 'lib\.crs' is never used$/, 'an unused aliased import names both the original and the alias');
assertOnlyWarning('partly-used.crs', 1, /^Import 'Point' from 'lib\.crs' is never used$/, 'only the unused item of a braced import is reported');
assertOnlyWarning('second-use-unused.crs', 2, /^Import 'Widget' from 'lib\.crs' is never used$/, 'the warning sits on the line of the use that holds the unused item');

assertClean('used-ok.crs', 'a component tag, a struct type, a struct literal and a destructure all count as uses');
assertClean('used-type-only-ok.crs', 'a struct used only in a nullable state type and a parameter type counts as used');
assertClean('used-via-alias-ok.crs', 'an alias counts as used when the alias is what the file references');
assertClean('lib.crs', 'a file with no imports gets no unused-import diagnostics');
