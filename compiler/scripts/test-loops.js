const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { parseCrescent } = require(path.join(__dirname, '..', 'dist', 'parser.js'));
const { generateProgram, CodegenError } = require(path.join(__dirname, '..', 'dist', 'codegen.js'));
const { LoopsDemo } = require(path.join(__dirname, '..', 'dist', 'gen', 'loops.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const root = document.getElementById('root');
root.appendChild(LoopsDemo());

function text(cls) {
  return root.querySelector('.' + cls).textContent;
}

assert(text('counting') === '01234', `C-style for loop counts 0..4, got "${text('counting')}"`);
assert(text('skipping') === '135', `break stops at 7 and continue skips evens, got "${text('skipping')}"`);
assert(text('doubling') === 'n=128 steps=7', `while loop doubles until n >= 100, got "${text('doubling')}"`);
assert(text('once') === 'ran d=11', `do-while runs its body once even when the test is initially false, got "${text('once')}"`);
assert(text('stateful') === '012 total=3', `a for header that assigns and increments a state<int> works, got "${text('stateful')}"`);
assert(text('pairs') === '00;01;20;21;', `break and continue affect only the innermost loop, got "${text('pairs')}"`);
assert(text('each') === 'ab', `break and continue also work inside a for-each loop, got "${text('each')}"`);

const source = fs.readFileSync(path.join(__dirname, 'fixtures', 'unsupported-loop-clause.crs'), 'utf8');
try {
  generateProgram(parseCrescent(source));
  assert(false, 'a for-loop clause that expands to several JS statements should have thrown a CodegenError');
} catch (err) {
  assert(err instanceof CodegenError, `threw CodegenError, got ${err.constructor.name}: ${err.message}`);
  assert(
    /for-loop initializer that expands to multiple statements/.test(err.message),
    `error message names the unsupported for-loop clause, got "${err.message}"`
  );
}

function parseFails(src) {
  try {
    parseCrescent(src);
    return null;
  } catch (err) {
    return err;
  }
}

const doWhileNoSemi = parseFails('component C { state<int> n = 0; void f() { do { n++; } while (n < 3) } view { <p>"x"</p> } }');
assert(doWhileNoSemi !== null, `a do-while without its trailing semicolon is a parse error, got ${doWhileNoSemi && doWhileNoSemi.message}`);

const bareBreak = parseFails('component C { void f() { for (int i = 0; i < 3; i++) { break } } view { <p>"x"</p> } }');
assert(bareBreak !== null, `a break without a semicolon is a parse error, got ${bareBreak && bareBreak.message}`);
