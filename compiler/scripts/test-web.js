const { JSDOM } = require('jsdom');
const path = require('path');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

async function main() {
  const htmlPath = path.join(__dirname, '..', 'web', 'index.html');
  const dom = await JSDOM.fromFile(htmlPath, {
    runScripts: 'dangerously',
    resources: 'usable',
  });

  await new Promise((resolve) => {
    dom.window.addEventListener('load', resolve);
  });

  const document = dom.window.document;

  const counterRoot = document.getElementById('counter-root');
  assert(counterRoot && counterRoot.querySelector('h1') !== null, 'counter mounted into the page');
  assert(
    counterRoot.querySelector('h1').textContent === 'Current Count: 0',
    `counter shows initial text, got "${counterRoot.querySelector('h1').textContent}"`
  );

  const addButton = counterRoot.querySelectorAll('button')[0];
  addButton.dispatchEvent(new dom.window.Event('click'));
  assert(
    counterRoot.querySelector('h1').textContent === 'Current Count: 1',
    `counter increments on real click, got "${counterRoot.querySelector('h1').textContent}"`
  );

  const dayPickerRoot = document.getElementById('day-picker-root');
  assert(dayPickerRoot && dayPickerRoot.querySelectorAll('.day').length === 3, 'day picker mounted with 3 days');

  const nextButton = dayPickerRoot.querySelector('button');
  const selectedText = () => dayPickerRoot.querySelector('p').textContent;
  assert(selectedText() === 'Selected: Mon', `day picker starts on Mon, got "${selectedText()}"`);

  nextButton.dispatchEvent(new dom.window.Event('click'));
  assert(selectedText() === 'Selected: Tue', `day picker advances on real click, got "${selectedText()}"`);

  dom.window.close();
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
});
