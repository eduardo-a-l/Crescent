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

const files = loadAllPrograms(path.join(__dirname, 'fixtures', 'import-conflicts'));

function diagnosticsFor(relPath) {
  const file = files.get(relPath);
  return checkFile(file, files, resolveFileImports(file, files));
}

const conflicting = diagnosticsFor('conflicting-imports.crs');
assert(
  conflicting.length === 1 &&
    conflicting[0].severity === 'error' &&
    conflicting[0].line === 2 &&
    /Import 'Thing' from 'b.crs' conflicts with 'Thing' already imported from 'a.crs'/.test(conflicting[0].message),
  `conflicting-imports.crs: the second import of a name from a different module is reported on its own line, got ${JSON.stringify(conflicting)}`
);

const repeated = diagnosticsFor('repeated-import.crs');
assert(
  repeated.length === 1 &&
    repeated[0].severity === 'error' &&
    repeated[0].line === 2 &&
    /Import 'Thing' from 'a.crs' conflicts with 'Thing' already imported from 'a.crs'/.test(repeated[0].message),
  `repeated-import.crs: importing the same name twice is reported, got ${JSON.stringify(repeated)}`
);

const importVsLocal = diagnosticsFor('import-vs-local.crs');
assert(
  importVsLocal.length === 1 &&
    importVsLocal[0].severity === 'error' &&
    importVsLocal[0].line === 1 &&
    /Import 'Library' from 'lib.crs' conflicts with the top-level declaration 'Library' in 'import-vs-local.crs'/.test(importVsLocal[0].message),
  `import-vs-local.crs: an import clashing with a local declaration is reported, got ${JSON.stringify(importVsLocal)}`
);

const aliased = diagnosticsFor('aliased-ok.crs');
assert(aliased.length === 0, `aliased-ok.crs: an alias resolves a same-name import conflict, got ${JSON.stringify(aliased)}`);

const aliasedVsLocal = diagnosticsFor('aliased-vs-local-ok.crs');
assert(aliasedVsLocal.length === 0, `aliased-vs-local-ok.crs: an alias resolves a clash with a local declaration, got ${JSON.stringify(aliasedVsLocal)}`);

const unrelated = [diagnosticsFor('a.crs'), diagnosticsFor('b.crs')];
assert(
  unrelated.every((d) => d.length === 0),
  `a.crs and b.crs: the same name declared in two modules that are not imported together is fine, got ${JSON.stringify(unrelated)}`
);
