const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { NumberList } = require(path.join(__dirname, '..', 'dist', 'gen', 'array_mutators_native.js'));

const root = document.getElementById('root');
root.appendChild(NumberList());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function nums() {
  return Array.from(root.querySelectorAll('.num')).map((p) => p.textContent).join(',');
}

assert(nums() === '3,1,2', `initial list renders correctly, got "${nums()}"`);

root.querySelector('.shift-btn').dispatchEvent(new dom.window.Event('click'));
assert(nums() === '1,2', `items.shift() reactively removes the first element, got "${nums()}"`);

root.querySelector('.unshift-btn').dispatchEvent(new dom.window.Event('click'));
assert(nums() === '9,1,2', `items.unshift(9) reactively prepends, got "${nums()}"`);

root.querySelector('.splice-btn').dispatchEvent(new dom.window.Event('click'));
assert(nums() === '9,2', `items.splice(1, 1) reactively removes the element at that index, got "${nums()}"`);

root.querySelector('.sort-btn').dispatchEvent(new dom.window.Event('click'));
assert(nums() === '2,9', `items.sort() reactively re-renders in sorted order, got "${nums()}"`);

root.querySelector('.reverse-btn').dispatchEvent(new dom.window.Event('click'));
assert(nums() === '9,2', `items.reverse() reactively re-renders in reverse order, got "${nums()}"`);
