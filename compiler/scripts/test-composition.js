const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { App, Greeting } = require(path.join(__dirname, '..', 'dist', 'gen', 'composition.js'));

const root = document.getElementById('root');
root.appendChild(App());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const card = root.querySelector('.card');
assert(card !== null, 'Card component rendered its own markup');

const h1 = card.querySelector('h1');
assert(h1 !== null && h1.textContent === 'Card Title', `slot passed through first child, got "${h1 && h1.textContent}"`);

const greeting = card.querySelector('.greeting');
assert(
  greeting !== null && greeting.textContent === 'Hello, World!',
  `slot passed through a nested component-as-element child, got "${greeting && greeting.textContent}"`
);

const standaloneRoot = document.createElement('div');
standaloneRoot.appendChild(Greeting({ name: 'Crescent' }));
assert(
  standaloneRoot.querySelector('.greeting').textContent === 'Hello, Crescent!',
  'component called directly with a prop renders that prop'
);
