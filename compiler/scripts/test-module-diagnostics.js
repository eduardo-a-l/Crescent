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

function fatalFor(name) {
  const result = checkProject(path.join(fixturesDir, name));
  return { result, fatal: result.fatal };
}

function describe(fatal) {
  return JSON.stringify(fatal);
}

const missingModule = fatalFor('missing-module');
assert(
  !missingModule.result.ok &&
    missingModule.fatal.stage === 'module' &&
    missingModule.fatal.file === 'main.crs' &&
    missingModule.fatal.line === 3 &&
    /Cannot find module 'nothere\.crs'/.test(missingModule.fatal.message),
  `missing-module: a use of a module that does not exist is attributed to its own use line, got ${describe(missingModule.fatal)}`
);

const missingExport = fatalFor('missing-export');
assert(
  !missingExport.result.ok &&
    missingExport.fatal.stage === 'module' &&
    missingExport.fatal.file === 'main.crs' &&
    missingExport.fatal.line === 3 &&
    /'Ghost' is not defined at the top level of 'lib\.crs'/.test(missingExport.fatal.message),
  `missing-export: a use of a name the target does not define is attributed to its own use line, got ${describe(missingExport.fatal)}`
);

const superAboveRoot = fatalFor('super-above-root');
assert(
  !superAboveRoot.result.ok &&
    superAboveRoot.fatal.stage === 'module' &&
    superAboveRoot.fatal.file === 'main.crs' &&
    superAboveRoot.fatal.line === 3 &&
    /'super' cannot go above the project root/.test(superAboveRoot.fatal.message),
  `super-above-root: a use that climbs above the project root is attributed to its own use line, got ${describe(superAboveRoot.fatal)}`
);

const cycle = fatalFor('cycle');
const chain = cycle.fatal ? cycle.fatal.message.replace(/^Circular import: /, '').split(' -> ') : [];
assert(
  !cycle.result.ok &&
    cycle.fatal.stage === 'module' &&
    chain.length === 3 &&
    chain[0] === chain[2] &&
    cycle.fatal.file === chain[1] &&
    cycle.fatal.line === 3,
  `cycle: an import cycle is attributed to the use that closes it, got ${describe(cycle.fatal)}`
);

const selfImport = fatalFor('self-import');
assert(
  !selfImport.result.ok &&
    selfImport.fatal.stage === 'module' &&
    selfImport.fatal.file === 'main.crs' &&
    selfImport.fatal.line === 3 &&
    /Circular import: main\.crs -> main\.crs/.test(selfImport.fatal.message),
  `self-import: a file importing itself is attributed to that use line, got ${describe(selfImport.fatal)}`
);

const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'dist', 'cli.js'), 'check', path.join(fixturesDir, 'missing-export')], {
  encoding: 'utf8',
});
assert(
  cli.status === 1 && cli.stderr.startsWith("main.crs:3: 'Ghost' is not defined at the top level of 'lib.crs'"),
  `cli check: a module error is printed as file:line: message with exit code 1, got status ${cli.status} and ${JSON.stringify(cli.stderr)}`
);
