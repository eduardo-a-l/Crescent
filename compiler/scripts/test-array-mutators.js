const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { TaskList } = require(path.join(__dirname, '..', 'dist', 'gen', 'array_mutators.js'));

const root = document.getElementById('root');
root.appendChild(TaskList());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function items() {
  return Array.from(root.querySelectorAll('.item')).map((p) => p.textContent);
}

assert(
  items().join(',') === 'Buy milk,Walk dog',
  `initial list renders correctly, got ${JSON.stringify(items())}`
);

root.querySelector('.add-btn').dispatchEvent(new dom.window.Event('click'));
assert(
  items().join(',') === 'Buy milk,Walk dog,New task',
  `items.push(...) reactively appends to the rendered list, got ${JSON.stringify(items())}`
);

root.querySelector('.remove-btn').dispatchEvent(new dom.window.Event('click'));
assert(
  items().join(',') === 'Buy milk,New task',
  `items.remove(...) reactively removes the matching element, got ${JSON.stringify(items())}`
);

root.querySelector('.pop-btn').dispatchEvent(new dom.window.Event('click'));
assert(items().join(',') === 'Buy milk', `items.pop() reactively removes the last element, got ${JSON.stringify(items())}`);

root.querySelector('.clear-btn').dispatchEvent(new dom.window.Event('click'));
assert(items().length === 0, `items.clear() reactively empties the rendered list, got ${JSON.stringify(items())}`);
