const path = require('path');
const { spawnSync } = require('child_process');
const { runPipeline, signatureOf } = require('./fuzz-harness.js');
const { parseCrescent, ParseError, MAX_NESTING, MAX_AST_DEPTH } = require(path.join(__dirname, '..', 'dist', 'parser.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const parseChild = `
const fs = require('fs');
const { parseCrescent, ParseError } = require(${JSON.stringify(path.join(__dirname, '..', 'dist', 'parser.js'))});
const { LexError } = require(${JSON.stringify(path.join(__dirname, '..', 'dist', 'lexer.js'))});
try {
  parseCrescent(fs.readFileSync(0, 'utf8'));
  console.log('parsed');
} catch (e) {
  console.log(e instanceof ParseError || e instanceof LexError ? e.constructor.name + ': ' + e.message : 'CRASH ' + e.constructor.name + ': ' + e.message);
}
`;

function parseIsolated(source) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=200', '-e', parseChild], { input: source, encoding: 'utf8', timeout: 10000 });
  if (r.error && r.error.code === 'ETIMEDOUT') return 'HANG';
  if (r.status !== 0 || r.signal) return `DIED (status ${r.status}, signal ${r.signal})`;
  return r.stdout.trim();
}

function parseOutcome(source) {
  try {
    parseCrescent(source);
    return { kind: 'parsed' };
  } catch (e) {
    if (e instanceof ParseError) return { kind: 'ParseError', message: e.message };
    return { kind: 'crash', message: `${e.constructor.name}: ${e.message}` };
  }
}

function pipelineOutcome(source) {
  const parsed = parseOutcome(source);
  if (parsed.kind !== 'parsed') return parsed.kind === 'ParseError' ? `ParseError: ${parsed.message}` : `crash ${parsed.message}`;
  const r = runPipeline(source);
  return r.crash ? `crash ${signatureOf(r.crash.stage, r.crash.error)}` : 'ok';
}

const wrap = (members, view = '<p>"x"</p>') => `component C {\n    state<int> n = 1;\n${members}\n    view {\n        ${view}\n    }\n}\n`;

const unterminatedStyle = {
  'style block with nothing after it': 'component C {\n    style {',
  'style rule that never opens': 'component C {\n    style {\n        .box',
  'style rule that never closes': 'component C {\n    style {\n        .box {\n            color: red;',
  'style value in the middle of a property name': 'component C {\n    style {\n        .box {\n            col',
};
for (const [label, source] of Object.entries(unterminatedStyle)) {
  const outcome = parseIsolated(source);
  assert(
    /^ParseError: (Unterminated style (block|rule)|Expected '\{' after style selector|Expected ':' after style property)/.test(outcome),
    `fuzz regression: ${label} is a controlled parse error instead of an endless loop, got ${outcome}`
  );
}

function nestedStringInterpolation(depth) {
  let value = 'n';
  for (let i = 0; i < depth; i++) value = `"{${value}}"`;
  return value;
}

const tooDeep = {
  'nested parentheses': wrap(`    state<int> x = ${'('.repeat(5000)}n${')'.repeat(5000)};`),
  'nested array literals': wrap(`    state<int> x = ${'['.repeat(5000)}1${']'.repeat(5000)};`),
  'chained ternaries': wrap(`    state<int> x = ${'n > 0 ? 1 : '.repeat(5000)}2;`),
  'chained unary operators': wrap(`    state<int> x = ${'- '.repeat(5000)}n;`),
  'nested blocks': wrap(`    void f() {\n${'if (n > 0) {\n'.repeat(5000)}n = 2;\n${'}\n'.repeat(5000)}    }`),
  'nested elements': wrap('', `${'<div>'.repeat(5000)}"x"${'</div>'.repeat(5000)}`),
  'nested string interpolations': wrap(`    state<string> s = ${nestedStringInterpolation(5000)};`),
  'nested generic types': wrap(`    state<${'Map<'.repeat(5000)}int${'>'.repeat(5000)}> y = 1;`),
};
for (const [label, source] of Object.entries(tooDeep)) {
  const outcome = pipelineOutcome(source);
  assert(
    /^ParseError: Nesting is too deep: more than 256 levels/.test(outcome),
    `deep input: ${label} nested 5000 deep is a controlled error and not a stack overflow, got ${outcome}`
  );
}

const tooLong = {
  'binary operator chain': wrap(`    state<int> x = n${' + n'.repeat(5000)};`),
  'member access chain': wrap(`    state<int> x = n${'.b'.repeat(5000)};`),
  'call chain': wrap(`    state<int> x = n${'()'.repeat(5000)};`),
  'index chain': wrap(`    state<int> x = n${'[0]'.repeat(5000)};`),
};
for (const [label, source] of Object.entries(tooLong)) {
  const outcome = pipelineOutcome(source);
  assert(
    /^ParseError: Expression or statement is too long/.test(outcome),
    `deep input: a ${label} of 5000 links is rejected before the checker can overflow on it, got ${outcome}`
  );
}

const nearLimit = MAX_NESTING - 10;
const accepted = {
  'nested parentheses': wrap(`    state<int> x = ${'('.repeat(nearLimit)}n${')'.repeat(nearLimit)};`),
  'nested array literals': wrap(`    state<int> x = ${'['.repeat(nearLimit)}1${']'.repeat(nearLimit)};`),
  'chained ternaries': wrap(`    state<int> x = ${'n > 0 ? 1 : '.repeat(nearLimit)}2;`),
  'nested blocks': wrap(`    void f() {\n${'if (n > 0) {\n'.repeat(nearLimit)}n = 2;\n${'}\n'.repeat(nearLimit)}    }`),
  'nested elements': wrap('', `${'<div>'.repeat(nearLimit)}"x"${'</div>'.repeat(nearLimit)}`),
  'binary operator chain': wrap(`    state<int> x = n${' + n'.repeat(MAX_AST_DEPTH - 30)};`),
  'member access chain': wrap(`    state<int> x = n${'.b'.repeat(MAX_AST_DEPTH - 30)};`),
  'call chain': wrap(`    state<int> x = n${'()'.repeat(MAX_AST_DEPTH - 30)};`),
};
for (const [label, source] of Object.entries(accepted)) {
  const outcome = pipelineOutcome(source);
  assert(
    !/^crash/.test(outcome) && !/Nesting is too deep|is too long/.test(outcome),
    `deep input: a ${label} just inside the limits still gets through parsing, checking and code generation without crashing, got ${outcome}`
  );
}

const boundedFuzz = spawnSync(process.execPath, ['--max-old-space-size=400', path.join(__dirname, 'fuzz.js'), '1', '3000'], { encoding: 'utf8', timeout: 120000 });
assert(
  boundedFuzz.status === 0 && /crash-signatures=0/.test(boundedFuzz.stdout),
  `fuzz: 3000 seeded mutations of the example and fixture programs, plus token soup, never raise an uncontrolled exception or hang, got status ${boundedFuzz.status} ${boundedFuzz.error ? boundedFuzz.error.code : ''} ${(boundedFuzz.stdout || '').split('\n').find((l) => l.startsWith('seed=')) || ''}`
);

const deepFuzz = spawnSync(process.execPath, ['--max-old-space-size=1500', path.join(__dirname, 'fuzz.js'), '7', '0', 'deep'], { encoding: 'utf8', timeout: 180000 });
assert(
  deepFuzz.status === 0 && /crash-signatures=0/.test(deepFuzz.stdout),
  `fuzz: the pathological inputs (deep nesting up to 100000 levels, a million-character identifier and string, 200000 statements) never raise an uncontrolled exception or exhaust memory, got status ${deepFuzz.status} ${deepFuzz.error ? deepFuzz.error.code : ''} ${(deepFuzz.stdout || '').split('\n').find((l) => l.startsWith('seed=')) || ''}`
);
