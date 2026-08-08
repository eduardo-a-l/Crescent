const { JSDOM } = require('jsdom');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

const { DayPicker } = require(path.join(__dirname, '..', 'dist', 'gen', 'day_picker.js'));

const root = document.getElementById('root');
root.appendChild(DayPicker());

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const dayLabels = () => Array.from(root.querySelectorAll('.day')).map((el) => el.textContent);
assert(
  JSON.stringify(dayLabels()) === JSON.stringify(['Mon', 'Tue', 'Wed']),
  `renders all three days, got ${JSON.stringify(dayLabels())}`
);

const selectedLabel = () => root.querySelector('p').textContent;
assert(selectedLabel() === 'Selected: Mon', `initial selection is "${selectedLabel()}"`);

const nextButton = root.querySelector('button');
nextButton.dispatchEvent(new dom.window.Event('click'));
assert(selectedLabel() === 'Selected: Tue', `after 1 click selection is "${selectedLabel()}"`);

nextButton.dispatchEvent(new dom.window.Event('click'));
assert(selectedLabel() === 'Selected: Wed', `after 2 clicks selection is "${selectedLabel()}"`);

nextButton.dispatchEvent(new dom.window.Event('click'));
assert(selectedLabel() === 'Selected: Mon', `wraps around after 3 clicks, got "${selectedLabel()}"`);

assert(
  JSON.stringify(dayLabels()) === JSON.stringify(['Mon', 'Tue', 'Wed']),
  `day list still renders correctly after clicks, got ${JSON.stringify(dayLabels())}`
);
