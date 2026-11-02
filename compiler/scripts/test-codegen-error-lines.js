const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const dist = path.join(__dirname, '..', 'dist');
const { parseCrescent } = require(path.join(dist, 'parser.js'));
const { generateProgram, CodegenError } = require(path.join(dist, 'codegen.js'));
const { buildProject } = require(path.join(dist, 'project.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function failure(source) {
  const program = parseCrescent(source);
  try {
    generateProgram(program);
  } catch (e) {
    return e;
  }
  return null;
}

function expectCodegenError(label, source, line, messagePattern) {
  const e = failure(source);
  assert(
    e instanceof CodegenError && e.line === line && messagePattern.test(e.message),
    `${label}: CodegenError on line ${line}, got ${e && e.constructor.name} line=${e && e.line} '${e && e.message}'`
  );
}

expectCodegenError(
  'component without a view',
  'struct P {\n    int x;\n}\n\ncomponent A {\n    state<int> n = 0;\n}\n',
  5,
  /component without a view block/
);
expectCodegenError(
  'second view block',
  'component A {\n    state<int> n = 0;\n    view {\n        <p/>\n    }\n\n    view {\n        <b/>\n    }\n}\n',
  7,
  /multiple view blocks/
);
expectCodegenError(
  'view with no root nodes',
  'component A {\n    state<int> n = 0;\n\n    view {\n    }\n}\n',
  4,
  /view block with no root nodes/
);
expectCodegenError(
  'assignment to a derived value, not the line of the assignment before it',
  'component A {\n    state<int> n = 0;\n    derived<int> d = n + 1;\n    void f() {\n        n = 2;\n        d = 5;\n    }\n    view {\n        <p/>\n    }\n}\n',
  6,
  /cannot assign to derived 'd'/
);
expectCodegenError(
  'postfix on a derived value, nested in an if',
  'component A {\n    state<int> n = 0;\n    derived<int> d = n + 1;\n    void f() {\n        if (n > 0) {\n            d++;\n        }\n    }\n    view {\n        <p/>\n    }\n}\n',
  6,
  /cannot assign to derived 'd'/
);
expectCodegenError(
  'derived assignment inside onChange',
  'component A {\n    state<int> n = 0;\n    derived<int> d = n + 1;\n\n    on_change(n) {\n        d = 1;\n    }\n    view {\n        <p/>\n    }\n}\n',
  6,
  /cannot assign to derived 'd'/
);
expectCodegenError(
  'if block with no root nodes',
  'component A {\n    state<int> n = 0;\n    view {\n        <p/>\n        if (n > 0) {\n        }\n    }\n}\n',
  5,
  /if-block with no root nodes/
);
expectCodegenError(
  'else block with no root nodes, after children were generated',
  'component A {\n    state<int> n = 0;\n    view {\n        <p/>\n        if (n > 0) {\n            <b/>\n            <i/>\n        } else {\n        }\n    }\n}\n',
  5,
  /else-block with no root nodes/
);
expectCodegenError(
  'for block with no root nodes',
  'component A {\n    state<int[]> xs = [1];\n    view {\n        <p/>\n\n        for (int x in xs key x) {\n        }\n    }\n}\n',
  6,
  /for-loop with no root nodes/
);
expectCodegenError(
  'an empty if nested in an element',
  'component A {\n    state<int> n = 0;\n    view {\n        <div>\n            <p/>\n            <section>\n                if (n > 0) {\n                }\n            </section>\n        </div>\n    }\n}\n',
  7,
  /if-block with no root nodes/
);
expectCodegenError(
  'for-loop update that expands to several statements',
  'component A {\n    state<int[]> xs = [1];\n    void f() {\n        for (int i = 0; i < 3; xs.push(i)) {\n        }\n    }\n    view {\n        <p/>\n    }\n}\n',
  4,
  /for-loop update that expands to multiple statements/
);

const afterFailure = (() => {
  failure('component A {\n    state<int> n = 0;\n}\n');
  try {
    return generateProgram(parseCrescent('component B {\n    view {\n        <p/>\n    }\n}\n'));
  } catch (e) {
    return e;
  }
})();
assert(typeof afterFailure === 'string', 'a failure does not leave state behind that breaks the next generation');

const lateFailure = (() => {
  const program = parseCrescent('component Good {\n    view {\n        <p/>\n    }\n}\n\ncomponent Bad {\n    state<int> n = 0;\n}\n');
  try {
    generateProgram(program);
  } catch (e) {
    return e;
  }
  return null;
})();
assert(lateFailure instanceof CodegenError && lateFailure.line === 7, `the line is the one of the failing component, not of an earlier one, got ${lateFailure && lateFailure.line}`);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-codegen-lines-'));
const project = path.join(tmpRoot, 'project');
fs.mkdirSync(project);
fs.writeFileSync(path.join(project, 'good.crs'), 'component Good {\n    view {\n        <p>"ok"</p>\n    }\n}\n');
fs.writeFileSync(
  path.join(project, 'loop.crs'),
  'component Loop {\n    state<int[]> xs = [1];\n\n    void f() {\n        for (int i = 0; i < 3; xs.push(i)) {\n        }\n    }\n\n    view {\n        <p/>\n    }\n}\n'
);
fs.writeFileSync(
  path.join(project, 'user.crs'),
  'use loop::Loop;\n\ncomponent User {\n    view {\n        <Loop />\n    }\n}\n'
);

const built = buildProject(project, path.join(tmpRoot, 'out'));
const byFile = Object.fromEntries(built.builds.map((b) => [b.relPath, b]));
assert(
  built.check.ok &&
    Object.values(built.check.diagnosticsByFile).length === 0 &&
    byFile['loop.crs'].outFile === null &&
    byFile['loop.crs'].line === 5 &&
    /for-loop update that expands to multiple statements/.test(byFile['loop.crs'].skippedReason),
  `buildProject: a codegen failure is a skip that records its line, got ${JSON.stringify(byFile['loop.crs'])}`
);
assert(
  byFile['good.crs'].outFile && byFile['good.crs'].line === null && byFile['user.crs'].outFile === null && byFile['user.crs'].line === null,
  `buildProject: the importer is skipped without a line of its own and the unrelated file still builds, got ${JSON.stringify([byFile['good.crs'], byFile['user.crs']])}`
);

const cli = path.join(dist, 'cli.js');
const run = spawnSync(process.execPath, [cli, 'build', project, '--out-dir', path.join(tmpRoot, 'cli-out')], { encoding: 'utf8' });
assert(
  /^loop\.crs:5: codegen skipped: Codegen: 'for-loop update that expands to multiple statements' is not yet supported/m.test(run.stdout) &&
    /^user\.crs: codegen skipped: 'loop\.crs', which it imports, was not built$/m.test(run.stdout),
  `crescent build: prints file:line for a codegen skip and no line for a skipped importer, got ${JSON.stringify(run.stdout)}`
);

fs.rmSync(tmpRoot, { recursive: true, force: true });
