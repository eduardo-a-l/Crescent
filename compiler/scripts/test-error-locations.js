const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const dist = path.join(__dirname, '..', 'dist');
const { parseCrescent, ParseError, MAX_NESTING } = require(path.join(dist, 'parser.js'));
const { LexError } = require(path.join(dist, 'lexer.js'));
const { checkProject } = require(path.join(dist, 'project.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function wrap(members, view = '<p/>', style = '') {
  return `component A {\n${members}\n    view {\n${view}\n    }\n${style}}\n`;
}

function failure(source) {
  try {
    parseCrescent(source);
  } catch (e) {
    return e;
  }
  return null;
}

function expectError(label, source, ErrorClass, line, messagePattern) {
  const e = failure(source);
  assert(
    e instanceof ErrorClass && e.line === line && messagePattern.test(e.message) && !/\bline \d+/.test(e.message),
    `${label}: ${ErrorClass.name} on line ${line} with the line kept out of the message, got ${e && e.constructor.name} line=${e && e.line} '${e && e.message}'`
  );
}

expectError('expression', wrap('    state<int> n = 0;\n    void f() {\n        int y = ;\n    }'), ParseError, 4, /^Expected an expression \(got SEMI/);
expectError('expect()', 'component A {\n    state n = 1;\n}\n', ParseError, 2, /^Expected token LT but got IDENTIFIER/);
expectError('interpolation in a view node', wrap('    state<int> n = 0;', '        <p>\n            <b>{n +}</b>\n        </p>'), ParseError, 5, /^Expected an expression/);
expectError('interpolation in a string, not relative to the string', wrap('    state<int> n = 0;\n', '        <p>"a {n +} b"</p>'), ParseError, 5, /^Expected an expression/);
expectError('interpolation in a string on a later line', wrap('\n\n\n\n    state<int> n = 0;', '        <p>"a {n +} b"</p>'), ParseError, 8, /^Expected an expression/);
expectError('interpolation in a style value', 'component A {\n    view { <p/> }\n    style {\n\n        p { color: {1 +}; }\n    }\n}\n', ParseError, 5, /^Expected an expression/);
expectError('style property without a colon', 'component A {\n    view { <p/> }\n    style {\n\n        p { color red; }\n    }\n}\n', ParseError, 5, /^Expected ':' after style property/);
expectError('style property without a value', 'component A {\n    view { <p/> }\n    style {\n        p {\n            color:;\n        }\n    }\n}\n', ParseError, 5, /^Expected a value for style property/);
expectError('unterminated style rule', 'component A {\n    view { <p/> }\n    style {\n        p { color: red;\n', ParseError, 5, /^Unterminated style rule/);
expectError('unterminated style block', 'component A {\n    view { <p/> }\n    style {\n', ParseError, 4, /^Unterminated style block/);
expectError('use without a module path', '\n\nuse card;\ncomponent A { view { <p/> } }\n', ParseError, 3, /^'use' must reference a module path/);
expectError('use without a module path, several segments elsewhere', 'use a::b::c;\nuse d;\n', ParseError, 2, /^'use' must reference a module path/);
expectError('unterminated string reports where it started', wrap('    state<string> s = "abc;\n    state<int> n = 0;'), LexError, 2, /^Unterminated string literal$/);
expectError('stray ampersand', wrap('\n\n    void f() { int a = 1 & 2; }'), LexError, 4, /^Unexpected character '&'$/);
expectError('stray pipe', wrap('    void f() { int a = 1 | 2; }'), LexError, 2, /^Unexpected character '\|'$/);
expectError('unexpected character', wrap('\n    state<int> n = 0 # 1;'), LexError, 3, /^Unexpected character '#'$/);
expectError('unterminated interpolation reports where it started', 'component A {\n    view {\n        <p>"a\n b {n', LexError, 4, /^Unterminated interpolation$/);

const deep = failure(wrap('    state<int> n = 0;\n    void f() {\n        int y = ' + '('.repeat(MAX_NESTING + 5) + '1' + ')'.repeat(MAX_NESTING + 5) + ';\n    }'));
assert(deep instanceof ParseError && deep.line === 4 && /^Nesting is too deep/.test(deep.message), `nesting limit: reported on the line it was hit, got line=${deep && deep.line}`);

const ok = failure(wrap('    state<int> n = 0;', '        <p>"a {n} b"</p>'));
assert(ok === null, 'a valid interpolation still parses');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-error-locations-'));
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

const good = 'component Good {\n    view {\n        <p>"ok"</p>\n    }\n}\n';

const parseProject = makeProject({ 'good.crs': good, 'sub/bad.crs': wrap('    state<int> n = 0;\n    void f() {\n        int y = ;\n    }') });
const parseResult = checkProject(parseProject);
const parseDiagnostics = parseResult.diagnosticsByFile.get('sub/bad.crs') || [];
assert(
  !parseResult.ok &&
    parseResult.unparsed.join() === 'sub/bad.crs' &&
    parseDiagnostics.length === 1 &&
    parseDiagnostics[0].severity === 'error' &&
    parseDiagnostics[0].line === 4 &&
    !/\bline \d+/.test(parseDiagnostics[0].message),
  `checkProject: a parse error is an error diagnostic on its file with its line, got ${JSON.stringify(parseDiagnostics)}`
);

const lexProject = makeProject({ 'bad.crs': wrap('\n\n    void f() { int a = 1 & 2; }') });
const lexResult = checkProject(lexProject);
assert(
  !lexResult.ok && (lexResult.diagnosticsByFile.get('bad.crs') || [])[0].line === 4,
  `checkProject: a lex error is reported the same way, got ${JSON.stringify(lexResult.diagnosticsByFile.get('bad.crs'))}`
);

const cli = path.join(dist, 'cli.js');
const run = spawnSync(process.execPath, [cli, 'check', parseProject], { encoding: 'utf8' });
assert(
  run.status === 1 && run.stdout.trim().split('\n')[0] === "sub/bad.crs:4 [error] file 'sub/bad.crs': Expected an expression (got SEMI ';')" && /^1 error\(s\), 0 warning\(s\) in 2 file\(s\)\.$/m.test(run.stdout),
  `crescent check: prints file:line once in the ordinary diagnostic format and counts the unparsed file, got ${JSON.stringify(run.stdout)}`
);

const lexRun = spawnSync(process.execPath, [cli, 'check', lexProject], { encoding: 'utf8' });
assert(
  lexRun.status === 1 && lexRun.stdout.split('\n')[0] === "bad.crs:4 [error] file 'bad.crs': Unexpected character '&'",
  `crescent check: a lex error is printed the same way, got ${JSON.stringify(lexRun.stdout)}`
);

const mixedProject = makeProject({
  'bad.crs': 'component A {\n    state n = 1;\n}\n',
  'main.crs': 'use good::Ghost;\n\n' + good.replace('Good', 'Main'),
  'good.crs': good,
});
const mixedRun = spawnSync(process.execPath, [cli, 'check', mixedProject], { encoding: 'utf8' });
assert(
  mixedRun.status === 1 && /^bad\.crs:2 \[error\]/m.test(mixedRun.stdout) && /^main\.crs:1 \[error\].*'Ghost' is not defined/m.test(mixedRun.stdout),
  `crescent check: a parse error and an error in another file are both reported, got ${JSON.stringify(mixedRun.stdout)}`
);

const buildOut = path.join(tmpRoot, 'build-out');
const buildRun = spawnSync(process.execPath, [cli, 'build', mixedProject, '--out-dir', buildOut], { encoding: 'utf8' });
assert(
  buildRun.status === 1 && fs.existsSync(path.join(buildOut, 'gen', 'good.js')) && /bad\.crs: codegen skipped: it has a syntax error/.test(buildRun.stdout),
  `crescent build: the files that parse still build next to one that does not, got ${JSON.stringify(buildRun.stdout)}`
);

const Module = require('module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const prefix = 'crescent-compiler/dist/';
  return resolveFilename.call(this, request.startsWith(prefix) ? path.join(dist, request.slice(prefix.length)) : request, ...rest);
};
const { compileToPreview } = require(path.join(__dirname, '..', '..', 'playground', 'lib', 'compileToPreview.js'));
const { compileToPreview: compileToPreviewWeb } = require(path.join(__dirname, '..', '..', 'crescent-web', 'lib', 'compileToPreview.js'));
(async () => {
  for (const [name, fn] of [['playground', compileToPreview], ['crescent-web', compileToPreviewWeb]]) {
    const result = await fn(wrap('    state<int> n = 0;\n    void f() {\n        int y = ;\n    }'));
    assert(
      result.ok === false &&
        !('fatal' in result) &&
        result.diagnostics.length === 1 &&
        result.diagnostics[0].severity === 'error' &&
        result.diagnostics[0].line === 4 &&
        result.diagnostics[0].message === "Expected an expression (got SEMI ';')",
      `${name} preview: the parse error arrives as an ordinary diagnostic with its line, got ${JSON.stringify(result.diagnostics)}`
    );
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
})();
