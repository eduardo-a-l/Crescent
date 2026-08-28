const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { Cart } = require(path.join(__dirname, '..', 'dist', 'gen', 'derived_and_lifecycle.js'));

const root = document.getElementById('root');
root.appendChild(Cart());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function totalText() {
  return root.querySelector('.total').textContent;
}
function logText() {
  return root.querySelector('.log').textContent;
}

assert(totalText() === 'Total: 20', `derived<int> total computes price * quantity on first read, got "${totalText()}"`);
assert(logText() === 'mounted', `on_mount ran once after the view was wired, got "${logText()}"`);

const button = root.querySelector('button');
button.dispatchEvent(new dom.window.Event('click'));

assert(totalText() === 'Total: 30', `derived<int> total recomputes when its dependency changes, got "${totalText()}"`);
assert(logText() === 'quantity changed to 3', `on_change(quantity) fired after a real change, got "${logText()}"`);

button.dispatchEvent(new dom.window.Event('click'));

assert(totalText() === 'Total: 40', `derived<int> total recomputes again, got "${totalText()}"`);
assert(logText() === 'quantity changed to 4', `on_change(quantity) fires on every subsequent change, got "${logText()}"`);
