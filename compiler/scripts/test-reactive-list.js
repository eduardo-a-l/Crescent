const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { TaskBoard } = require(path.join(__dirname, '..', 'dist', 'gen', 'reactive_list.js'));

const root = document.getElementById('root');
root.appendChild(TaskBoard());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function paragraphTexts() {
  return Array.from(root.querySelectorAll('p')).map((p) => `${p.className}:${p.textContent}`);
}

assert(
  paragraphTexts()[0] === 'pending:Write docs' && paragraphTexts()[1] === 'pending:Ship release',
  `both tasks start pending, got ${JSON.stringify(paragraphTexts())}`
);

root.querySelector('button').dispatchEvent(new dom.window.Event('click'));

assert(
  paragraphTexts()[0] === 'done:Write docs',
  `array-index assignment "tasks[0] = ..." updated only the first task in place, got ${JSON.stringify(paragraphTexts())}`
);
assert(
  paragraphTexts()[1] === 'pending:Ship release',
  `second task was left untouched, got ${JSON.stringify(paragraphTexts())}`
);
