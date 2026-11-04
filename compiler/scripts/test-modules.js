const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { App } = require(path.join(__dirname, '..', 'dist', 'gen', 'modules', 'main.js'));

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
assert(card !== null, 'Card component (imported via super::shapes::Point from a nested directory) rendered');

const origin = card.querySelector('.origin');
assert(
  origin !== null && origin.textContent === 'Origin: (0, 0)',
  `Card renders the Point struct passed in as a prop across files, got "${origin && origin.textContent}"`
);

const point = card.querySelector('.point');
assert(
  point !== null && point.textContent === '(3, 4)',
  `PointBadge (imported via a braced multi-import "use shapes::{Point, PointBadge};") renders as slot content, got "${point && point.textContent}"`
);
