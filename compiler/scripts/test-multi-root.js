const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { Header, ItemGrid } = require(path.join(__dirname, '..', 'dist', 'gen', 'multi_root.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const root = document.getElementById('root');
root.appendChild(Header());

assert(root.querySelector('h1').textContent === 'Dashboard', 'multi-root view block renders its first root node');
assert(root.querySelector('button').textContent === 'Toggle subtitle', 'multi-root view block renders its last root node');
assert(
  root.querySelectorAll('.subtitle, .hint').length === 2,
  'a multi-root if-branch (2 nodes) renders both nodes'
);

root.querySelector('button').dispatchEvent(new dom.window.Event('click'));

assert(
  root.querySelectorAll('.subtitle').length === 1 && root.querySelectorAll('.hint').length === 0,
  'switching to a single-root else-branch does not leave stray nodes from the multi-root consequent behind'
);
assert(root.querySelector('.subtitle').textContent === 'Subtitle hidden', 'the single-root else-branch renders correctly');
assert(root.querySelector('h1').textContent === 'Dashboard', 'sibling root nodes outside the if-block are unaffected by the toggle');

const gridRoot = document.createElement('div');
gridRoot.appendChild(ItemGrid());

const tags = Array.from(gridRoot.querySelectorAll('.tag')).map((n) => n.textContent);
const separators = gridRoot.querySelectorAll('.separator');
assert(tags.join(',') === 'A,B', `a multi-root for-loop body renders one full root-set per item, got ${JSON.stringify(tags)}`);
assert(separators.length === 2, 'each iteration of a multi-root for-loop body renders every one of its root nodes');
