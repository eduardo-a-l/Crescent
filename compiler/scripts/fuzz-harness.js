const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { parseCrescent } = require(path.join(root, 'dist', 'parser.js'));
const { LexError } = require(path.join(root, 'dist', 'lexer.js'));
const { ParseError } = require(path.join(root, 'dist', 'parser.js'));
const { CodegenError, generateProgram } = require(path.join(root, 'dist', 'codegen.js'));
const { checkFile } = require(path.join(root, 'dist', 'checker.js'));
const { resolveFileImportsLenient } = require(path.join(root, 'dist', 'modules.js'));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collectSeeds() {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.crs')) found.push(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(path.join(root, 'examples'));
  walk(path.join(root, 'scripts', 'fixtures'));
  return found;
}

const DICTIONARY = [
  '{', '}', '(', ')', '[', ']', '<', '>', '</', '/>', '<>', '</>', '"', "'", '`', '${', '{{', '}}', '$', '\\', ';', ',', '.', '..', '...', '::', ':', '?', '??', '?.', '!', '!=', '==', '=', '=>', '->', '+', '-', '*', '/', '%', '&&', '||', '++', '--',
  'component', 'view', 'state', 'derived', 'const', 'provide', 'inject', 'struct', 'use', 'super', 'as', 'if', 'else', 'for', 'in', 'while', 'do', 'break', 'continue', 'return', 'async', 'await', 'void', 'int', 'float', 'string', 'bool', 'null', 'true', 'false',
  'on_mount', 'on_change', 'key', 'style', 'slot', 'state<', 'derived<', '<>', '<><><>', 'view {', 'component {{', '0', '1.5', '1e999', '0x', '""', '"unterminated', '/*', '*/', '//', '\n', '\t', ' ',
  '\u0000', '\u202e', '\ud83d', 'é', '日本', '\u{1F600}',
];

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

function between(rand, lo, hi) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function mutateOnce(rand, source) {
  if (source.length === 0) return pick(rand, DICTIONARY);
  const kind = between(rand, 0, 8);
  const at = between(rand, 0, source.length);
  switch (kind) {
    case 0:
      return source.slice(0, at);
    case 1: {
      const len = between(rand, 1, 12);
      return source.slice(0, at) + source.slice(at + len);
    }
    case 2:
      return source.slice(0, at) + pick(rand, DICTIONARY) + source.slice(at);
    case 3: {
      const len = between(rand, 1, 30);
      return source.slice(0, at) + source.slice(at, at + len) + source.slice(at);
    }
    case 4: {
      const lines = source.split('\n');
      const i = between(rand, 0, lines.length - 1);
      lines.splice(i, 1);
      return lines.join('\n');
    }
    case 5: {
      const lines = source.split('\n');
      const i = between(rand, 0, lines.length - 1);
      const j = between(rand, 0, lines.length - 1);
      [lines[i], lines[j]] = [lines[j], lines[i]];
      return lines.join('\n');
    }
    case 6: {
      const len = between(rand, 1, 6);
      let noise = '';
      for (let i = 0; i < len; i++) noise += String.fromCharCode(between(rand, 0, 0x2fff));
      return source.slice(0, at) + noise + source.slice(at);
    }
    case 7: {
      const len = between(rand, 1, 20);
      return source.slice(0, at) + source.slice(at + len, at + len + between(rand, 0, 20)) + source.slice(at);
    }
    default: {
      const word = source.slice(at).match(/^\w+/);
      if (!word) return source.slice(0, at) + pick(rand, DICTIONARY) + source.slice(at);
      return source.slice(0, at) + pick(rand, DICTIONARY) + source.slice(at + word[0].length);
    }
  }
}

function mutate(rand, source) {
  let out = source;
  const rounds = between(rand, 1, 4);
  for (let i = 0; i < rounds; i++) out = mutateOnce(rand, out);
  return out;
}

function tokenSoup(rand) {
  const count = between(rand, 1, 60);
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(pick(rand, DICTIONARY));
  return parts.join(rand() < 0.5 ? ' ' : '');
}

function pathological() {
  const cases = [];
  for (const n of [1000, 5000, 20000, 100000]) {
    cases.push({ name: `parens x${n}`, source: `component C {\n    state<int> x = ${'('.repeat(n)}1${')'.repeat(n)};\n    view {\n        <p>"x"</p>\n    }\n}\n` });
    cases.push({ name: `brackets x${n}`, source: `component C {\n    state<int> x = ${'['.repeat(n)}1${']'.repeat(n)};\n    view {\n        <p>"x"</p>\n    }\n}\n` });
    cases.push({ name: `nested elements x${n}`, source: `component C {\n    view {\n${'<div>'.repeat(n)}"x"${'</div>'.repeat(n)}\n    }\n}\n` });
    cases.push({ name: `unclosed elements x${n}`, source: `component C {\n    view {\n${'<div>'.repeat(n)}\n    }\n}\n` });
    cases.push({ name: `nested blocks x${n}`, source: `component C {\n    void f() {\n${'if (true) {'.repeat(n)}${'}'.repeat(n)}\n    }\n    view {\n        <p>"x"</p>\n    }\n}\n` });
    cases.push({ name: `unary x${n}`, source: `component C {\n    state<int> x = ${'- '.repeat(n)}1;\n    view {\n        <p>"x"</p>\n    }\n}\n` });
    cases.push({ name: `binary chain x${n}`, source: `component C {\n    state<int> x = 1${' + 1'.repeat(n)};\n    view {\n        <p>"x"</p>\n    }\n}\n` });
    cases.push({ name: `ternary chain x${n}`, source: `component C {\n    state<int> x = ${'true ? 1 : '.repeat(n)}2;\n    view {\n        <p>"x"</p>\n    }\n}\n` });
    cases.push({ name: `member chain x${n}`, source: `component C {\n    state<int> x = a${'.b'.repeat(n)};\n    view {\n        <p>"x"</p>\n    }\n}\n` });
    cases.push({ name: `nested types x${n}`, source: `component C {\n    state<${'int[]'.repeat(1)}${'?'.repeat(1)}> x = 1;\n    state<${'Map<'.repeat(n)}int${'>'.repeat(n)}> y = 1;\n    view {\n        <p>"x"</p>\n    }\n}\n` });
  }
  cases.push({ name: 'long identifier', source: `component ${'A'.repeat(1000000)} {\n    view {\n        <p>"x"</p>\n    }\n}\n` });
  cases.push({ name: 'long string', source: `component C {\n    state<string> s = "${'a'.repeat(1000000)}";\n    view {\n        <p>"x"</p>\n    }\n}\n` });
  cases.push({ name: 'many statements', source: `component C {\n    void f() {\n${'        console.log(1);\n'.repeat(200000)}    }\n    view {\n        <p>"x"</p>\n    }\n}\n` });
  cases.push({ name: 'empty', source: '' });
  cases.push({ name: 'only whitespace', source: ' \n\t\n ' });
  cases.push({ name: 'only nul', source: '\u0000'.repeat(100) });
  return cases;
}

function runPipeline(source) {
  let program;
  try {
    program = parseCrescent(source);
  } catch (e) {
    if (e instanceof LexError || e instanceof ParseError) return { controlled: true };
    return { crash: { stage: 'parse', error: e } };
  }

  const file = { relPath: 'fuzz.crs', program };
  const files = new Map([[file.relPath, file]]);
  let diagnostics;
  try {
    const resolved = resolveFileImportsLenient(file, files);
    diagnostics = checkFile(file, files, resolved.imports, resolved.unresolved);
  } catch (e) {
    return { crash: { stage: 'check', error: e } };
  }

  if (diagnostics.some((d) => d.severity === 'error')) return { controlled: true };

  try {
    generateProgram(program);
  } catch (e) {
    if (e instanceof CodegenError) return { controlled: true };
    return { crash: { stage: 'codegen', error: e } };
  }
  return { controlled: true };
}

function signatureOf(stage, error) {
  const name = error && error.constructor ? error.constructor.name : typeof error;
  const message = String((error && error.message) || error).split('\n')[0].slice(0, 80);
  const stack = String((error && error.stack) || '').split('\n');
  const frame = stack.find((l) => l.includes('/dist/')) || stack[1] || '';
  const where = frame.trim().replace(/^at /, '').replace(/.*\/dist\//, 'dist/').replace(/\)$/, '');
  return `${stage}: ${name}: ${message} @ ${where}`;
}

function runFuzz({ seed = 1, iterations = 2000, includePathological = false, onProgress, onBefore } = {}) {
  const rand = mulberry32(seed);
  const seeds = collectSeeds();
  const crashes = new Map();
  let slowest = { ms: 0, source: '' };
  let runs = 0;

  const record = (source, label) => {
    runs++;
    if (onBefore) onBefore(source, label);
    const started = Date.now();
    const result = runPipeline(source);
    const elapsed = Date.now() - started;
    if (elapsed > slowest.ms) slowest = { ms: elapsed, source: source.slice(0, 200), label };
    if (result.crash) {
      const signature = signatureOf(result.crash.stage, result.crash.error);
      const existing = crashes.get(signature);
      if (!existing || source.length < existing.source.length) {
        crashes.set(signature, { signature, source, label, count: existing ? existing.count + 1 : 1 });
      } else {
        existing.count++;
      }
    }
  };

  for (const s of seeds) record(s, 'seed');

  for (let i = 0; i < iterations; i++) {
    const roll = rand();
    if (roll < 0.1) record(tokenSoup(rand), 'soup');
    else record(mutate(rand, pick(rand, seeds)), 'mutation');
    if (onProgress && i % 500 === 0) onProgress(i, crashes.size);
  }

  if (includePathological) {
    for (const c of pathological()) record(c.source, c.name);
  }

  return { runs, seeds: seeds.length, crashes: Array.from(crashes.values()), slowest };
}

module.exports = { runFuzz, runPipeline, signatureOf, mulberry32, pathological };
