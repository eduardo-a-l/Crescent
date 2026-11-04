const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { DestructuringDemo } = require(path.join(__dirname, '..', 'dist', 'gen', 'struct_destructuring.js'));

const root = document.getElementById('root');
root.appendChild(DestructuringDemo());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const summaryText = root.querySelector('p').textContent;
assert(
  summaryText === 'x is 0, y is 0',
  `struct destructuring (Point { x, y } = origin;) reads both fields out of a state<Point> value, got "${summaryText}"`
);
