const fs = require('fs');
const path = require('path');
const { toHtml, escapeHtml, unescapeHtml } = require('../public/app/highlight.js');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function stripToPlainText(html) {
  return unescapeHtml(html.replace(/<[^>]+>/g, ''));
}

const EXAMPLES_DIR = path.join(__dirname, '..', '..', 'compiler', 'examples');
const COUNTER_SOURCE = fs.readFileSync(path.join(EXAMPLES_DIR, 'counter.crs'), 'utf-8');

function main() {
  const exampleFiles = fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.crs'));
  for (const file of exampleFiles) {
    const source = fs.readFileSync(path.join(EXAMPLES_DIR, file), 'utf-8');
    const html = toHtml(source);
    assert(stripToPlainText(html) === source, `highlighting ${file} is lossless (stripping markup reproduces the original source)`);
  }

  const html = toHtml(COUNTER_SOURCE);
  assert(html.includes('<span class="tok-keyword">component</span>'), 'the "component" keyword is highlighted');
  assert(html.includes('<span class="tok-type">int</span>'), 'the "int" type is highlighted');
  assert(
    html.includes('<span class="tok-string">"Current Count: "</span>'),
    'a plain string literal is highlighted as a whole'
  );

  const interpolated = toHtml('"Hello {name}!"');
  assert(
    interpolated ===
      '<span class="tok-string">"Hello </span>' +
        '<span class="tok-punct-interp">{</span>name<span class="tok-punct-interp">}</span>' +
        '<span class="tok-string">!"</span>',
    `an embedded {expr} interpolation inside a string is highlighted distinctly, got ${JSON.stringify(interpolated)}`
  );

  const nested = '"outer {a + { x: 1 }.x} tail"';
  assert(
    stripToPlainText(toHtml(nested)) === nested,
    'a nested object literal inside a string interpolation still round-trips losslessly'
  );

  const lineComment = toHtml('int x = 1; // a note');
  assert(lineComment.includes('<span class="tok-comment">// a note</span>'), 'a line comment is highlighted');

  const blockComment = toHtml('/* multi\nline */ int x;');
  assert(
    blockComment.includes('<span class="tok-comment">/* multi\nline */</span>'),
    'a block comment spanning multiple lines is highlighted as one token'
  );

  assert(escapeHtml('<div>') === '&lt;div&gt;', 'escapeHtml escapes angle brackets');
  assert(unescapeHtml('&lt;div&gt;') === '<div>', 'unescapeHtml reverses escapeHtml');
}

main();
