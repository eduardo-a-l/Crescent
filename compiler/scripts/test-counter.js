const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { Counter } = require(path.join(__dirname, '..', 'dist', 'gen', 'counter.js'));

const root = document.getElementById('root');
root.appendChild(Counter());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const h1 = root.querySelector('h1');
assert(h1.textContent === 'Current Count: 0', `initial text is "${h1.textContent}"`);
assert(root.querySelector('p').textContent === 'Count is normal.', 'starts in normal state');

const addButton = root.querySelectorAll('button')[0];
for (let i = 0; i < 11; i++) addButton.dispatchEvent(new dom.window.Event('click'));

assert(h1.textContent === 'Current Count: 11', `after 11 clicks text is "${h1.textContent}"`);
assert(root.querySelector('p').textContent === 'Count is getting high!', 'switches to warning state');
assert(root.querySelector('p.warning') !== null, 'warning class applied');

const resetButton = root.querySelectorAll('button')[1];
resetButton.dispatchEvent(new dom.window.Event('click'));

assert(h1.textContent === 'Current Count: 0', 'reset returns to 0');
assert(root.querySelector('p').textContent === 'Count is normal.', 'reset returns to normal state');
