const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { App, DeepNestedWidget } = require(path.join(__dirname, '..', 'dist', 'gen', 'provide_inject.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const root = document.getElementById('root');
root.appendChild(App());

const div = root.querySelector('div');
assert(
  div !== null && div.className === 'dark-theme',
  `provide<ThemeState> in App resolves through the non-providing intermediate Dashboard down to DeepNestedWidget's inject<ThemeState>, got "${div && div.className}"`
);
assert(
  root.querySelector('p').textContent === 'Context Resolved!',
  'the deeply nested component renders correctly using the injected context value'
);

let threw = false;
try {
  DeepNestedWidget();
} catch (e) {
  threw = e instanceof TypeError;
}
assert(threw, 'calling a component with inject<T> directly, with no providing ancestor, fails with a clear runtime TypeError rather than silently rendering wrong content');
