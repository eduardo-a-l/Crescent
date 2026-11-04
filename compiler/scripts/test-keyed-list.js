const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { TodoList } = require(path.join(__dirname, '..', 'dist', 'gen', 'keyed_list.js'));

const root = document.getElementById('root');
root.appendChild(TodoList());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function todoNodes() {
  return Array.from(root.querySelectorAll('.todo'));
}

const initial = todoNodes();
assert(
  initial.map((n) => n.textContent).join(',') === 'Buy milk,Walk dog',
  `initial list renders in order, got ${JSON.stringify(initial.map((n) => n.textContent))}`
);

const nodeA = initial[0];
const nodeB = initial[1];

root.querySelector('.swap-btn').dispatchEvent(new dom.window.Event('click'));
const afterSwap = todoNodes();
assert(
  afterSwap.map((n) => n.textContent).join(',') === 'Walk dog,Buy milk',
  `swap reorders the visible content, got ${JSON.stringify(afterSwap.map((n) => n.textContent))}`
);
assert(afterSwap[1] === nodeA, 'reordering reuses the same DOM node object for an unchanged item (item A moved, not recreated)');
assert(afterSwap[0] === nodeB, 'reordering reuses the same DOM node object for an unchanged item (item B moved, not recreated)');

root.querySelector('.grow-btn').dispatchEvent(new dom.window.Event('click'));
const afterGrow = todoNodes();
assert(
  afterGrow.map((n) => n.textContent).join(',') === 'Walk dog,Buy milk,Write code',
  `growing the list appends a new item without disturbing the rest, got ${JSON.stringify(afterGrow.map((n) => n.textContent))}`
);
assert(afterGrow[0] === nodeB && afterGrow[1] === nodeA, 'growing the list does not recreate the existing items\' DOM nodes');

root.querySelector('.shrink-btn').dispatchEvent(new dom.window.Event('click'));
const afterShrink = todoNodes();
assert(
  afterShrink.map((n) => n.textContent).join(',') === 'Walk dog',
  `shrinking the list removes the dropped items, got ${JSON.stringify(afterShrink.map((n) => n.textContent))}`
);
assert(afterShrink[0] === nodeB, 'shrinking the list preserves the DOM node identity of the item that remains');
