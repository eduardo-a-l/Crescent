const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkProject, buildProject } = require(path.join(__dirname, '..', 'dist', 'project.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-semantics-'));
let counter = 0;

function makeProject(files) {
  const dir = path.join(tmpRoot, `project-${counter++}`);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

function component(name, uses = [], body = `        <p>"${name}"</p>\n`) {
  const header = uses.length ? uses.map((u) => `use ${u};\n`).join('') + '\n' : '';
  return `${header}component ${name} {\n    view {\n${body}    }\n}\n`;
}

const shapes = 'struct Point {\n    int x;\n    int y;\n}\n\ncomponent Badge(Point p) {\n    view {\n        <p>{p.x}</p>\n    }\n}\n';

function describe(value) {
  return JSON.stringify(value);
}

function errorsIn(result, file) {
  return (result.diagnosticsByFile.get(file) || []).filter((d) => d.severity === 'error');
}

const midSuper = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'sub/other.crs': component('Other'),
    'main.crs': component('Main', ['sub::super::lib::Lib'], '        <Lib />\n'),
  })
);
assert(
  midSuper.ok && Array.from(midSuper.diagnosticsByFile.values()).every((d) => d.length === 0),
  `path resolution: super may appear in the middle of a path and removes the segment before it, got ${describe(midSuper.fatal)}`
);

const useAfterDeclaration = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': 'component Main {\n    view {\n        <Lib />\n    }\n}\n\nuse lib::Lib;\n',
  })
);
assert(
  useAfterDeclaration.ok && Array.from(useAfterDeclaration.diagnosticsByFile.values()).every((d) => d.length === 0),
  `syntax: a use may follow the declarations of its file, because order at the top level is not significant, got ${describe(useAfterDeclaration.fatal)}`
);

const sharedNamespace = checkProject(
  makeProject({
    'dup.crs': 'component Main {\n    view {\n        <p>"a"</p>\n    }\n}\n\nstruct Main {\n    int x;\n}\n',
  })
);
const sharedNamespaceDiagnostics = sharedNamespace.diagnosticsByFile.get('dup.crs');
assert(
  sharedNamespaceDiagnostics.length === 1 &&
    sharedNamespaceDiagnostics[0].severity === 'error' &&
    sharedNamespaceDiagnostics[0].line === 7 &&
    /Duplicate top-level declaration 'Main'/.test(sharedNamespaceDiagnostics[0].message),
  `scope: components and structs share one namespace per file, got ${describe(sharedNamespaceDiagnostics)}`
);

const bareSingle = checkProject(makeProject({ 'lib.crs': component('Lib'), 'main.crs': component('Main', ['lib']) }));
assert(
  !bareSingle.ok && bareSingle.fatal.stage === 'parse' && bareSingle.fatal.file === 'main.crs' && /module path before the imported item/.test(bareSingle.fatal.message),
  `syntax: a use with a single segment is rejected because it names no item, got ${describe(bareSingle.fatal)}`
);

const emptyBraces = checkProject(makeProject({ 'lib.crs': component('Lib'), 'main.crs': 'use lib::{};\n\n' + component('Main') }));
assert(
  !emptyBraces.ok && emptyBraces.fatal.stage === 'parse' && emptyBraces.fatal.file === 'main.crs',
  `syntax: a braced import list must name at least one item, got ${describe(emptyBraces.fatal)}`
);

const hyphenOk = checkProject(makeProject({ 'my-lib.crs': component('Lib'), 'main.crs': component('Main') }));
assert(
  hyphenOk.ok && hyphenOk.files.has('my-lib.crs'),
  `file names: a file whose name is not an identifier is still part of the project, got ${describe(hyphenOk.fatal)}`
);
const hyphenUse = checkProject(makeProject({ 'my-lib.crs': component('Lib'), 'main.crs': component('Main', ['my-lib::Lib']) }));
assert(
  !hyphenUse.ok && hyphenUse.fatal.stage === 'parse' && hyphenUse.fatal.file === 'main.crs',
  `file names: but it cannot be imported, because every path segment is an identifier, got ${describe(hyphenUse.fatal)}`
);

const caseMismatch = checkProject(makeProject({ 'lib.crs': component('Lib'), 'main.crs': component('Main', ['Lib::Lib']) }));
const caseErrors = errorsIn(caseMismatch, 'main.crs');
assert(
  caseMismatch.ok && caseErrors.length === 1 && caseErrors[0].line === 1 && /Cannot find module 'Lib\.crs'/.test(caseErrors[0].message),
  `path resolution: module lookup is case-sensitive on every platform, got ${describe(caseErrors)}`
);

const reexport = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'mid.crs': component('Mid', ['lib::Lib'], '        <Lib />\n'),
    'main.crs': component('Main', ['mid::Lib']),
  })
);
const reexportErrors = errorsIn(reexport, 'main.crs');
assert(
  reexport.ok && reexportErrors.length === 1 && reexportErrors[0].line === 1 && /'Lib' is not defined at the top level of 'mid\.crs'/.test(reexportErrors[0].message),
  `visibility: a name that a module only imports is not importable from it, got ${describe(reexportErrors)}`
);

const compiled = buildProject(
  makeProject({
    'shapes.crs': shapes,
    'aliased.crs': component('Aliased', ['shapes::{Point, Badge as B}'], '        <B p={origin} />\n').replace('component Aliased {', 'component Aliased {\n    state<Point> origin = Point { x: 1, y: 2 };\n'),
    'structs-only.crs': component('StructsOnly', ['shapes::Point'], '        <p>{origin.x}</p>\n').replace('component StructsOnly {', 'component StructsOnly {\n    state<Point> origin = Point { x: 1, y: 2 };\n'),
    'merged.crs': component('Merged', ['shapes::Badge', 'shapes::Point'], '        <Badge p={origin} />\n').replace('component Merged {', 'component Merged {\n    state<Point> origin = Point { x: 1, y: 2 };\n'),
  }),
  path.join(tmpRoot, 'out-compiled')
);
const generated = (rel) => fs.readFileSync(path.join(compiled.genDir, rel), 'utf8');
const requireCount = (js) => (js.match(/require\('\.\/shapes'\)/g) || []).length;
assert(
  compiled.check.ok && compiled.builds.every((b) => b.outFile),
  `compile model: every file builds, got ${describe(compiled.check.fatal || compiled.builds.filter((b) => !b.outFile))}`
);
assert(
  generated('aliased.js').includes("const { Badge: B } = require('./shapes');"),
  'compile model: an imported component becomes a CommonJS require that binds the alias'
);
assert(
  requireCount(generated('structs-only.js')) === 0 && !/Point/.test(generated('shapes.js').replace(/\/\*[\s\S]*?\*\//g, '')),
  'compile model: a struct produces no code, so importing only structs adds no require and the struct is absent from the output'
);
assert(
  requireCount(generated('merged.js')) === 1,
  `compile model: several use lines from one module become a single require, got ${requireCount(generated('merged.js'))}`
);

const mixed = buildProject(
  makeProject({
    'main.crs': component('Main'),
    'orphan.crs': component('Orphan'),
    'broken.crs': 'component Broken {\n    void run() {\n        console.log(nope);\n    }\n\n    view {\n        <p>"b"</p>\n    }\n}\n',
  }),
  path.join(tmpRoot, 'out-mixed')
);
const byFile = Object.fromEntries(mixed.builds.map((b) => [b.relPath, b]));
assert(
  mixed.check.ok && byFile['main.crs'].outFile && byFile['orphan.crs'].outFile,
  `build: every file in the project is built, including one nothing imports, got ${describe(mixed.builds)}`
);
assert(
  mixed.check.diagnosticsByFile.get('broken.crs').some((d) => d.severity === 'error') &&
    byFile['broken.crs'].outFile === null &&
    /semantic errors/.test(byFile['broken.crs'].skippedReason),
  `build: a file with a semantic error is skipped while the others still build, got ${describe(byFile['broken.crs'])}`
);

fs.rmSync(tmpRoot, { recursive: true, force: true });
