const path = require('path');
const { spawnSync } = require('child_process');
const { checkProject } = require(path.join(__dirname, '..', 'dist', 'project.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const fixturesDir = path.join(__dirname, 'fixtures', 'module-errors');

function errorsFor(name) {
  const result = checkProject(path.join(fixturesDir, name));
  const errors = [];
  for (const [file, diagnostics] of result.diagnosticsByFile) {
    for (const d of diagnostics) {
      if (d.severity === 'error') errors.push({ file, line: d.line, message: d.message });
    }
  }
  return { result, errors };
}

function describe(value) {
  return JSON.stringify(value);
}

const missingModule = errorsFor('missing-module');
assert(
  missingModule.result.ok &&
    missingModule.result.fatal === null &&
    missingModule.errors.length === 1 &&
    missingModule.errors[0].file === 'main.crs' &&
    missingModule.errors[0].line === 3 &&
    /Cannot find module 'nothere\.crs'/.test(missingModule.errors[0].message),
  `missing-module: a use of a module that does not exist is an error on its own use line and not a fatal one, got ${describe(missingModule.errors)}`
);

const missingExport = errorsFor('missing-export');
assert(
  missingExport.result.ok &&
    missingExport.result.fatal === null &&
    missingExport.errors.length === 1 &&
    missingExport.errors[0].file === 'main.crs' &&
    missingExport.errors[0].line === 3 &&
    /'Ghost' is not defined at the top level of 'lib\.crs'/.test(missingExport.errors[0].message),
  `missing-export: a use of a name the target does not define is an error on its own use line, got ${describe(missingExport.errors)}`
);

const superAboveRoot = errorsFor('super-above-root');
assert(
  superAboveRoot.result.ok &&
    superAboveRoot.result.fatal === null &&
    superAboveRoot.errors.length === 1 &&
    superAboveRoot.errors[0].file === 'main.crs' &&
    superAboveRoot.errors[0].line === 3 &&
    /'super' cannot go above the project root/.test(superAboveRoot.errors[0].message),
  `super-above-root: a use that climbs above the project root is an error on its own use line, got ${describe(superAboveRoot.errors)}`
);

const cycle = errorsFor('cycle');
const chain = cycle.errors.length ? cycle.errors[0].message.replace(/^Circular import: /, '').split(' -> ') : [];
assert(
  cycle.result.ok &&
    cycle.result.fatal === null &&
    cycle.errors.length === 1 &&
    chain.length === 3 &&
    chain[0] === chain[2] &&
    cycle.errors[0].file === chain[1] &&
    cycle.errors[0].line === 3,
  `cycle: an import cycle is one error on the use that closes it, got ${describe(cycle.errors)}`
);

const selfImport = errorsFor('self-import');
assert(
  selfImport.result.ok &&
    selfImport.result.fatal === null &&
    selfImport.errors.length === 1 &&
    selfImport.errors[0].file === 'main.crs' &&
    selfImport.errors[0].line === 3 &&
    /Circular import: main\.crs -> main\.crs/.test(selfImport.errors[0].message),
  `self-import: a file importing itself is an error on that use line, got ${describe(selfImport.errors)}`
);

const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'dist', 'cli.js'), 'check', path.join(fixturesDir, 'missing-export')], {
  encoding: 'utf8',
});
assert(
  cli.status === 1 && cli.stdout.startsWith("main.crs:3 [error] file 'main.crs': 'Ghost' is not defined at the top level of 'lib.crs'"),
  `cli check: a module error is printed like any other diagnostic with its file and line and exit code 1, got status ${cli.status} and ${JSON.stringify(cli.stdout.split('\n')[0])}`
);
