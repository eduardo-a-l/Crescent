const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { StringInterpolation } = require(path.join(__dirname, '..', 'dist', 'gen', 'string_interpolation.js'));

const root = document.getElementById('root');
root.appendChild(StringInterpolation());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const greeting = root.querySelector('.greeting');
assert(
  greeting.textContent === "Hello, Ada! You've clicked 0 times.",
  `initial interpolated text is "${greeting.textContent}"`
);

const card = root.querySelector('.interp-card');
assert(card.getAttribute('title') === 'Greeting for Ada', `initial interpolated attribute is "${card.getAttribute('title')}"`);

const escaped = root.querySelector('.escaped');
assert(escaped.textContent === 'Literal braces: {not interpolated}', `escaped braces render literally as "${escaped.textContent}"`);

const button = root.querySelector('button');
for (let i = 0; i < 3; i++) button.dispatchEvent(new dom.window.Event('click'));

assert(
  greeting.textContent === "Hello, Ada! You've clicked 3 times.",
  `interpolated text updates reactively to "${greeting.textContent}"`
);
