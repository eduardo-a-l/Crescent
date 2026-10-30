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

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-recovery-'));
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

function component(name, uses = [], body = `        <p>"${name}"</p>\n`, members = '') {
  const header = uses.length ? uses.map((u) => `use ${u};\n`).join('') + '\n' : '';
  return `${header}component ${name} {\n${members}    view {\n${body}    }\n}\n`;
}

function diagnosticsIn(result, file, severity) {
  return (result.diagnosticsByFile.get(file) || [])
    .filter((d) => d.severity === severity)
    .map((d) => ({ line: d.line, message: d.message }));
}

function show(value) {
  return JSON.stringify(value);
}

const broken = 'void run() {\n        console.log(nope);\n    }\n\n';

const twoFiles = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': component('Main', ['lib::Ghost']),
    'other.crs': `component Other {\n    ${broken}    view {\n        <p>"o"</p>\n    }\n}\n`,
  })
);
assert(
  twoFiles.ok && diagnosticsIn(twoFiles, 'main.crs', 'error').length === 1 && diagnosticsIn(twoFiles, 'other.crs', 'error').length === 1,
  `recovery: a module error in one file no longer hides an unrelated error in another, got ${show([...twoFiles.diagnosticsByFile])}`
);

const sameFile = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': `use lib::Ghost;\n\ncomponent Main {\n    ${broken}    view {\n        <p>"m"</p>\n    }\n}\n`,
  })
);
const sameFileErrors = diagnosticsIn(sameFile, 'main.crs', 'error');
assert(
  sameFile.ok && sameFileErrors.length === 2 && sameFileErrors[0].line === 1 && /'Ghost' is not defined/.test(sameFileErrors[0].message),
  `recovery: the module error and an ordinary error in the same file are both reported, module error first, got ${show(sameFileErrors)}`
);

const several = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': 'use nothere::Foo;\n\nuse lib::Ghost;\n\nuse super::x::Y;\n\n' + component('Main'),
  })
);
const severalErrors = diagnosticsIn(several, 'main.crs', 'error');
assert(
  several.ok &&
    severalErrors.length === 3 &&
    severalErrors.map((e) => e.line).join(',') === '1,3,5' &&
    /Cannot find module 'nothere\.crs'/.test(severalErrors[0].message) &&
    /'Ghost' is not defined/.test(severalErrors[1].message) &&
    /'super' cannot go above/.test(severalErrors[2].message),
  `recovery: every bad use in a file is reported, in line order, not only the first, got ${show(severalErrors)}`
);

const cascading = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs':
      'use lib::Ghost;\n\n' +
      component('Main', [], '        <Ghost />\n', '    state<Ghost> g = Ghost { x: 1 };\n    state<Ghost[]> gs = [];\n    state<Ghost?> maybe = null;\n'),
  })
);
assert(
  cascading.ok && diagnosticsIn(cascading, 'main.crs', 'error').length === 1 && diagnosticsIn(cascading, 'main.crs', 'warning').length === 0,
  `recovery: uses of a name whose import failed (a tag, a struct literal, a state type, an array type, a nullable type) add no follow-on errors, got ${show(diagnosticsIn(cascading, 'main.crs', 'error'))}`
);

const unrelated = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': 'use lib::Ghost;\n\n' + component('Main', [], '        <Ghost />\n        <Other />\n'),
  })
);
const unrelatedErrors = diagnosticsIn(unrelated, 'main.crs', 'error');
assert(
  unrelatedErrors.length === 2 && /'Ghost' is not defined/.test(unrelatedErrors[0].message) && /Unknown component '<Other>'/.test(unrelatedErrors[1].message),
  `recovery: only the failed name is silenced, a genuinely unknown component beside it is still reported, got ${show(unrelatedErrors)}`
);

const aliased = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': 'use lib::{Ghost as G};\n\n' + component('Main', [], '        <G />\n'),
  })
);
assert(
  diagnosticsIn(aliased, 'main.crs', 'error').length === 1,
  `recovery: the alias of a failed import is what gets silenced, got ${show(diagnosticsIn(aliased, 'main.crs', 'error'))}`
);

const partial = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': 'use lib::{Lib, Ghost};\n\n' + component('Main', [], '        <Lib />\n'),
  })
);
assert(
  diagnosticsIn(partial, 'main.crs', 'error').length === 1 &&
    /'Ghost' is not defined/.test(diagnosticsIn(partial, 'main.crs', 'error')[0].message) &&
    diagnosticsIn(partial, 'main.crs', 'warning').length === 0,
  `recovery: the names of a braced import that do resolve still work when a sibling fails, got ${show([...partial.diagnosticsByFile])}`
);

const cycles = checkProject(
  makeProject({
    'a.crs': 'use b::B;\n\ncomponent A {\n    ' + broken + '    view {\n        <B />\n    }\n}\n',
    'b.crs': component('B', ['a::A'], '        <A />\n'),
    'c.crs': component('C', ['d::D'], '        <D />\n'),
    'd.crs': component('D', ['c::C'], '        <C />\n'),
  })
);
const allCycleErrors = [...cycles.diagnosticsByFile].flatMap(([file, ds]) => ds.filter((d) => /^Circular import/.test(d.message)).map((d) => ({ file, message: d.message })));
assert(
  cycles.ok && allCycleErrors.length === 2,
  `recovery: independent cycles are each reported, not only the first one found, got ${show(allCycleErrors)}`
);
assert(
  diagnosticsIn(cycles, 'a.crs', 'error').some((e) => /nope/.test(e.message)),
  'recovery: a file that is part of a cycle is still checked, so its ordinary errors are reported too'
);

const parseFatal = checkProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': component('Main', ['lib::Ghost']),
    'syntax.crs': 'component {{{',
  })
);
assert(
  !parseFatal.ok && parseFatal.fatal.stage === 'parse' && parseFatal.fatal.file === 'syntax.crs' && parseFatal.diagnosticsByFile.size === 0,
  `recovery: a parse error is still fatal and still reports nothing else, got ${show(parseFatal.fatal)}`
);

const built = buildProject(
  makeProject({
    'lib.crs': component('Lib'),
    'main.crs': component('Main', ['lib::Ghost']),
    'fine.crs': component('Fine', ['lib::Lib'], '        <Lib />\n'),
  }),
  path.join(tmpRoot, 'out')
);
const byFile = Object.fromEntries(built.builds.map((b) => [b.relPath, b]));
assert(
  built.check.ok && byFile['fine.crs'].outFile && byFile['lib.crs'].outFile && byFile['main.crs'].outFile === null && /error/.test(byFile['main.crs'].skippedReason),
  `build: a file with a module error is skipped while the files without errors still build, got ${show(built.builds.map((b) => [b.relPath, !!b.outFile, b.skippedReason]))}`
);

const unsupportedLoop = fs.readFileSync(path.join(__dirname, 'fixtures', 'unsupported-loop-clause.crs'), 'utf8');
const dependents = buildProject(
  makeProject({
    'lib.crs': component('Lib', [], '        <p>"l"</p>\n', '    void run() {\n        console.log(nope);\n    }\n\n'),
    'middle.crs': component('Middle', ['lib::Lib'], '        <Lib />\n'),
    'top.crs': component('Top', ['middle::Middle'], '        <Middle />\n'),
    'free.crs': component('Free'),
    'shapes.crs': 'struct Point {\n    int x;\n    int y;\n}\n\ncomponent Bad {\n    void run() {\n        console.log(nope);\n    }\n\n    view {\n        <p>"b"</p>\n    }\n}\n',
    'uses_struct.crs': component('UsesStruct', ['shapes::Point'], '        <p>{origin.x}</p>\n', '    state<Point> origin = Point { x: 1, y: 2 };\n'),
    'codegen_fails.crs': unsupportedLoop,
    'after_codegen.crs': component('After', ['codegen_fails::Broken'], '        <Broken />\n'),
  }),
  path.join(tmpRoot, 'out-dependents')
);
const dependentsByFile = Object.fromEntries(dependents.builds.map((b) => [b.relPath, b]));
assert(
  !dependentsByFile['lib.crs'].outFile &&
    !dependentsByFile['middle.crs'].outFile &&
    !dependentsByFile['top.crs'].outFile &&
    /'lib\.crs', which it imports, was not built/.test(dependentsByFile['middle.crs'].skippedReason) &&
    /'middle\.crs', which it imports, was not built/.test(dependentsByFile['top.crs'].skippedReason) &&
    dependentsByFile['free.crs'].outFile,
  `build: a file that imports a skipped file is skipped too, through any number of levels, so no emitted file requires a missing one, got ${show(dependents.builds.map((b) => [b.relPath, !!b.outFile, b.skippedReason]))}`
);
assert(
  !dependentsByFile['shapes.crs'].outFile && dependentsByFile['uses_struct.crs'].outFile,
  `build: a file that imports only structs from a skipped file still builds, because it emits no require for it, got ${show([dependentsByFile['shapes.crs'], dependentsByFile['uses_struct.crs']])}`
);
assert(
  !dependentsByFile['codegen_fails.crs'].outFile && !dependentsByFile['after_codegen.crs'].outFile && /which it imports/.test(dependentsByFile['after_codegen.crs'].skippedReason),
  `build: a code generation failure blocks the files that import it just as an error does, got ${show([dependentsByFile['codegen_fails.crs'], dependentsByFile['after_codegen.crs']])}`
);
const emittedRequires = dependents.builds
  .filter((b) => b.outFile)
  .every((b) => {
    const js = fs.readFileSync(b.outFile, 'utf8');
    return Array.from(js.matchAll(/require\('\.\/([^']+)'\)/g)).every((m) => fs.existsSync(path.join(dependents.genDir, m[1] + '.js')));
  });
assert(emittedRequires, 'build: every relative require in every emitted file points at a file that was emitted');

fs.rmSync(tmpRoot, { recursive: true, force: true });
