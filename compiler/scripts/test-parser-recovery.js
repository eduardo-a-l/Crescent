const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const dist = path.join(__dirname, '..', 'dist');
const { parseCrescent, parseCrescentRecovering, ParseError, MAX_SYNTAX_ERRORS } = require(path.join(dist, 'parser.js'));
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

function shape(errors) {
  return errors.map((e) => `${e instanceof LexError ? 'lex' : 'parse'}@${e.line}`).join(' ');
}

function expectErrors(label, source, expected) {
  const outcome = parseCrescentRecovering(source);
  assert(
    outcome.program === null && shape(outcome.errors) === expected,
    `${label}: expected '${expected}', got '${shape(outcome.errors)}'`
  );
  return outcome;
}

const base = (members, view = '<p/>') => `component A {\n    state<int> n = 0;\n${members}\n    view {\n        ${view}\n    }\n}\n`;

expectErrors('one bad statement is one error', base('    void f() {\n        int y = ;\n        n = 2;\n    }'), 'parse@4');
expectErrors('every bad statement in a function is reported', base('    void f() {\n        int y = ;\n        n = ;\n        if (n > ) {\n            n = 1;\n        }\n        n = 3;\n    }'), 'parse@4 parse@5 parse@6');
expectErrors('a bad for header is one error, not one per piece', base('    void f() {\n        for (int i = 0; i < ; i++) {\n            n = 1;\n        }\n        int z = ;\n    }'), 'parse@4 parse@7');
expectErrors('errors in nested blocks are all reported', base('    void f() {\n        if (n > 0) {\n            int a = ;\n            while (n < 3) {\n                n = ;\n            }\n        }\n    }'), 'parse@5 parse@7');
expectErrors('statements after a bad block statement are still checked', base('    void f() {\n        if (n > ) {\n            n = 1;\n        }\n        int y = ;\n    }'), 'parse@4 parse@7');
expectErrors('bad members are reported and the good ones skipped over', 'component A {\n    state n = 0;\n    state<int> m = 0;\n    derived<int> d = ;\n    void g() { m = 1; }\n    view {\n        <p/>\n    }\n}\n', 'parse@2 parse@4');
expectErrors('a bad function header does not swallow the next member', base('    void f( {\n        n = 1;\n    }\n    void g() {\n        int y = ;\n    }'), 'parse@3 parse@7');
expectErrors('bad declarations are all reported', 'component {\n}\ncomponent B {\n    view {\n        <p/>\n    }\n}\nstruct {\n}\ncomponent C {\n    state n = 1;\n}\n', 'parse@1 parse@8 parse@11');
expectErrors('a stray closing brace is one error and the next declaration is still read', '}\ncomponent A {\n    state n = 1;\n}\n', 'parse@1 parse@3');
expectErrors('an error in a view and one after it', base('    void f() { int a = ; }', '<div>\n            <p>{n +}</p>\n        </div>'), 'parse@3 parse@6');
expectErrors('a lex error ends the list but keeps the earlier errors', base('    void f() {\n        int a = ;\n        int b = 1 # 2;\n        int c = ;\n    }'), 'parse@4 lex@5');
expectErrors('an error in a style block ends the list but keeps the earlier errors', 'component A {\n    void f() { int a = ; }\n    view { <p/> }\n    style {\n        p { color red; }\n    }\n    void h() { int b = ; }\n}\n', 'parse@2 parse@5');
expectErrors('a missing closing brace is reported where it shows up, plus one more where the structure breaks, not a pile', base('    void f() {\n        n = 1;\n') + '\ncomponent B {\n    view {\n        <p/>\n    }\n}\n', 'parse@6 parse@11');
expectErrors('the end of the file inside a statement is one error', 'component A {\n    void f() {\n        int y = ', 'parse@3');
expectErrors('an unterminated string is a lex error and the only one', base('    state<string> s = "abc;\n    void f() { int a = ; }'), 'lex@3');

const viewOf = (body) => `component A {\n    state<int> n = 0;\n    state<int[]> xs = [1];\n    view {\n${body}\n    }\n}\n`;

expectErrors('view: bad nodes on different lines are all reported', viewOf('        <p>{n +}</p>\n        <b>"ok"</b>\n        <i>{n *}</i>'), 'parse@5 parse@7');
expectErrors('view: an open tag without its > does not swallow its siblings', viewOf('        <p class="a"\n        <b>"ok"</b>\n        <i>{n *}</i>'), 'parse@6 parse@7');
expectErrors('view: a garbled closing tag name ends its element and the next error is found', viewOf('        <div>\n            <p>"a"</bu>\n            <b>{n +}</b>\n        </div>'), 'parse@6 parse@7');
expectErrors('view: a closing tag without its < ends its element and the next error is found', viewOf('        <div>\n            <p>"a"/p>\n            <b>{n +}</b>\n        </div>'), 'parse@6 parse@7');
expectErrors('view: a stray closing tag is one error and the next one is found', viewOf('        <p>"a"</p>\n        </div>\n        <b>{n +}</b>'), 'parse@6 parse@7');
expectErrors('view: an element that is never closed is one error', viewOf('        <div>\n            <p>"a"</p>\n    '), 'parse@8');
expectErrors('view: a closing tag of an enclosing element ends the unclosed one inside it', viewOf('        <div>\n            <p>"a"\n        </div>\n        <b>{n *}</b>'), 'parse@7 parse@8');
expectErrors('view: a bad attribute expression and bad nodes around it', viewOf('        <p class={n +}>"a"</p>\n        <b>"ok"</b>\n        <i>{n *}</i>'), 'parse@5 parse@7');
expectErrors('view: an error in an if header skips its body and else, the next node is checked', viewOf('        if (n > ) {\n            <p>"a"</p>\n        } else {\n            <b>"b"</b>\n        }\n        <i>{n *}</i>'), 'parse@5 parse@10');
expectErrors('view: errors in the if body, the else body and a for body are all found', viewOf('        if (n > 0) {\n            <p>{n +}</p>\n            <b>{n *}</b>\n        } else {\n            <i>{n /}</i>\n        }\n        for (int x in xs key x) {\n            <u>{x +}</u>\n        }'), 'parse@6 parse@7 parse@9 parse@12');
expectErrors('view: errors in nested elements are all found', viewOf('        <div>\n            <section>\n                <p>{n +}</p>\n            </section>\n            <p>{n *}</p>\n        </div>'), 'parse@7 parse@9');
expectErrors('view: two errors on one line are one error', viewOf('        <p>{n +}</p><b>{n *}</b>'), 'parse@5');
expectErrors('view: an error in the view and one in a member after it', 'component A {\n    state<int> n = 0;\n    view {\n        <p>{n +}</p>\n        <b>{n *}</b>\n    }\n    void f() { int a = ; }\n}\n', 'parse@4 parse@5 parse@7');

const clean = parseCrescentRecovering(base('    void f() {\n        n = 2;\n    }'));
assert(clean.errors.length === 0 && clean.program && JSON.stringify(clean.program) === JSON.stringify(parseCrescent(base('    void f() {\n        n = 2;\n    }'))), 'a valid program has no errors and the same tree as parseCrescent');

const many = parseCrescentRecovering(base('    void f() {\n' + '        int y = ;\n'.repeat(MAX_SYNTAX_ERRORS * 3) + '    }'));
assert(many.errors.length === MAX_SYNTAX_ERRORS, `the number of reported errors is capped at ${MAX_SYNTAX_ERRORS}, got ${many.errors.length}`);

const manyBraces = parseCrescentRecovering(base('    void f() {\n' + '        n = ;\n'.repeat(5) + '    }\n' + '    void g() {\n' + '        n = ;\n'.repeat(5) + '    }'));
assert(manyBraces.errors.length === 10, `errors in two functions are all reported, got ${manyBraces.errors.length}`);

let seed = 12345;
function random(n) {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % n;
}
const inserts = ['}', '{', ';', '(', ')', '<', '>', '"', '=', 'state', 'view', ',', '[', ']', '/', 'int', 'if (', 'for ('];
const examplesDir = path.join(__dirname, '..', 'examples');
const sources = [];
(function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name.endsWith('.crs')) sources.push(fs.readFileSync(full, 'utf8'));
  }
})(examplesDir);

function mutate(source) {
  let out = source;
  const edits = 1 + random(3);
  for (let i = 0; i < edits; i++) {
    const at = random(out.length + 1);
    const kind = random(3);
    if (kind === 0) out = out.slice(0, at) + out.slice(at + 1 + random(12));
    else if (kind === 1) out = out.slice(0, at) + inserts[random(inserts.length)] + out.slice(at);
    else out = out.slice(0, at) + out.slice(at + 1 + random(40));
  }
  return out;
}

let inputs = 0;
let invalid = 0;
let recoveredMore = 0;
let mismatches = [];
let overCap = 0;
let started = Date.now();
for (const source of sources) {
  for (let i = 0; i < 400; i++) {
    const input = mutate(source);
    inputs += 1;
    let thrown = null;
    let tree = null;
    try {
      tree = parseCrescent(input);
    } catch (e) {
      if (!(e instanceof ParseError || e instanceof LexError)) throw e;
      thrown = e;
    }
    const outcome = parseCrescentRecovering(input);
    if (outcome.errors.length > MAX_SYNTAX_ERRORS) overCap += 1;
    if (thrown === null) {
      if (outcome.errors.length !== 0 || JSON.stringify(outcome.program) !== JSON.stringify(tree)) mismatches.push(['valid', input]);
    } else {
      invalid += 1;
      const first = outcome.errors[0];
      if (!first || first.constructor !== thrown.constructor || first.message !== thrown.message || first.line !== thrown.line) mismatches.push(['first', input]);
      if (outcome.errors.length > 1) recoveredMore += 1;
    }
  }
}
const elapsed = Date.now() - started;
assert(mismatches.length === 0, `differential: on ${inputs} mutated programs (${invalid} invalid) the first recovered error is the one parseCrescent throws and valid inputs are unchanged, ${mismatches.length} mismatches${mismatches[0] ? ' e.g. ' + JSON.stringify(mismatches[0]) : ''}`);
assert(overCap === 0, 'differential: no input reports more errors than the cap');
assert(recoveredMore > invalid / 20, `differential: recovery finds a second error on a fair share of invalid inputs (${recoveredMore} of ${invalid})`);
assert(elapsed < 60000, `differential: finishes in reasonable time, took ${elapsed} ms`);

expectErrors('a stray semicolon splitting a member in two is one error, not one per half', 'component A {\n    state;<int> n = 0;\n    view {\n        <p/>\n    }\n}\n', 'parse@2');
expectErrors('a second error on the same line as the first is not reported, the next line is', base('    void f() {\n        int a = ; int b = ;\n        int c = ;\n    }'), 'parse@4 parse@5');

function singleErrorShare(edit) {
  let invalid = 0;
  let single = 0;
  for (const source of sources) {
    for (let i = 0; i < 250; i++) {
      const at = random(source.length + 1);
      const outcome = parseCrescentRecovering(edit(source, at));
      if (outcome.errors.length === 0) continue;
      invalid += 1;
      if (outcome.errors.length === 1) single += 1;
    }
  }
  return { invalid, share: single / invalid };
}
for (const [label, token] of [['a stray semicolon', ';'], ['a stray closing parenthesis', ')']]) {
  const { invalid, share } = singleErrorShare((source, at) => source.slice(0, at) + token + source.slice(at));
  assert(share >= 0.9, `quality: ${label} inserted anywhere in an example gives exactly one error at least 90% of the time (${(share * 100).toFixed(1)}% of ${invalid})`);
}

function viewRanges(source) {
  const ranges = [];
  const pattern = /\bview\s*\{/g;
  let match;
  while ((match = pattern.exec(source))) {
    let depth = 1;
    let i = pattern.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    ranges.push([pattern.lastIndex, i - 1]);
  }
  return ranges;
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function viewSingleErrorShare(edit) {
  let invalid = 0;
  let single = 0;
  for (const source of sources) {
    const ranges = viewRanges(source);
    if (ranges.length === 0) continue;
    for (let i = 0; i < 200; i++) {
      const [lo, hi] = ranges[random(ranges.length)];
      const edited = edit(source, lo + random(Math.max(1, hi - lo)));
      if (edited === source) continue;
      const outcome = parseCrescentRecovering(edited);
      if (outcome.errors.length === 0) continue;
      invalid += 1;
      if (outcome.errors.length === 1) single += 1;
    }
  }
  return { invalid, share: single / invalid };
}

const deleteNext = (char) => (source, at) => {
  const index = source.indexOf(char, at);
  return index < 0 ? source : source.slice(0, index) + source.slice(index + 1);
};
for (const [label, edit] of [
  ['a stray semicolon', (source, at) => source.slice(0, at) + ';' + source.slice(at)],
  ['a stray closing parenthesis', (source, at) => source.slice(0, at) + ')' + source.slice(at)],
  ['a deleted <', deleteNext('<')],
  ['a deleted >', deleteNext('>')],
]) {
  const { invalid, share } = viewSingleErrorShare(edit);
  assert(share >= 0.94, `view quality: ${label} inside a view gives exactly one error at least 94% of the time (${(share * 100).toFixed(1)}% of ${invalid})`);
}

function viewPairRecall(edit) {
  let pairs = 0;
  let both = 0;
  for (const source of sources) {
    const ranges = viewRanges(source);
    if (ranges.length === 0) continue;
    for (let i = 0; i < 150; i++) {
      const [lo, hi] = ranges[random(ranges.length)];
      if (hi - lo < 200) continue;
      let first = lo + random(hi - lo);
      let second = lo + random(hi - lo);
      if (Math.abs(lineAt(source, first) - lineAt(source, second)) < 3) continue;
      if (first > second) [first, second] = [second, first];
      const onlyFirst = edit(source, first);
      const onlySecond = edit(source, second);
      if (parseCrescentRecovering(onlyFirst).errors.length === 0 || parseCrescentRecovering(onlySecond).errors.length === 0) continue;
      pairs += 1;
      if (parseCrescentRecovering(edit(edit(source, second), first)).errors.length >= 2) both += 1;
    }
  }
  return { pairs, share: both / pairs };
}
for (const [label, edit] of [
  ['a stray semicolon', (source, at) => source.slice(0, at) + ';' + source.slice(at)],
  ['a deleted >', deleteNext('>')],
]) {
  const { pairs, share } = viewPairRecall(edit);
  assert(share >= 0.75, `view recall: two separate mistakes (${label}) in one view are both reported at least 75% of the time (${(share * 100).toFixed(1)}% of ${pairs})`);
}

const garbage = [];
for (let i = 0; i < 300; i++) {
  let s = '';
  const len = random(300);
  for (let j = 0; j < len; j++) s += inserts[random(inserts.length)] + (random(4) === 0 ? '\n' : ' ');
  garbage.push(s);
}
let garbageOk = true;
for (const input of garbage) {
  const outcome = parseCrescentRecovering(input);
  if (outcome.program === null && outcome.errors.length === 0) garbageOk = false;
  if (outcome.errors.length > MAX_SYNTAX_ERRORS) garbageOk = false;
}
assert(garbageOk, 'token soup always ends with a program or at least one error, within the cap');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-parser-recovery-'));
const project = path.join(tmpRoot, 'project');
fs.mkdirSync(project);
fs.writeFileSync(path.join(project, 'broken.crs'), base('    void f() {\n        int y = ;\n        n = ;\n    }\n    state m = 1;'));
fs.writeFileSync(path.join(project, 'fine.crs'), 'component Fine {\n    view {\n        <p>"ok"</p>\n    }\n}\n');
fs.writeFileSync(path.join(project, 'user.crs'), 'use broken::A;\n\ncomponent User {\n    view {\n        <A />\n    }\n}\n');

const result = checkProject(project);
const brokenDiagnostics = result.diagnosticsByFile.get('broken.crs') || [];
assert(
  !result.ok &&
    result.unparsed.join() === 'broken.crs' &&
    brokenDiagnostics.map((d) => d.line).join() === '4,5,7' &&
    brokenDiagnostics.every((d) => d.severity === 'error' && d.where === "file 'broken.crs'"),
  `checkProject: every syntax error of a file is its own diagnostic with its line, got ${JSON.stringify(brokenDiagnostics.map((d) => d.line))}`
);
assert(
  (result.diagnosticsByFile.get('user.crs') || []).filter((d) => d.severity === 'error').length === 1 && (result.diagnosticsByFile.get('fine.crs') || []).length === 0,
  'checkProject: a file that imports from the broken one still gets one error, and an unrelated file is clean'
);

const run = spawnSync(process.execPath, [path.join(dist, 'cli.js'), 'check', project], { encoding: 'utf8' });
const reported = run.stdout.split('\n').filter((l) => l.startsWith('broken.crs:'));
assert(
  run.status === 1 && reported.length === 3 && reported[0].startsWith('broken.crs:4 [error]') && reported[1].startsWith('broken.crs:5 [error]') && reported[2].startsWith('broken.crs:7 [error]') && /^4 error\(s\), 0 warning\(s\) in 3 file\(s\)\.$/m.test(run.stdout),
  `crescent check: prints every syntax error of the file in order and counts them, got ${JSON.stringify(run.stdout)}`
);

fs.rmSync(tmpRoot, { recursive: true, force: true });
