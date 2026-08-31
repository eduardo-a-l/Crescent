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

  const themeToggleRoot = document.getElementById('theme-toggle-root');
  const box = themeToggleRoot && themeToggleRoot.querySelector('.box');
  assert(box !== null, 'theme toggle mounted into the page');
  assert(
    document.head.querySelector('style[data-crs-style="data-crs-themetoggle"]') !== null,
    'theme toggle scoped stylesheet injected into real page head'
  );
  const toggleButton = themeToggleRoot.querySelector('button');
  const bgBefore = box.style.getPropertyValue('--crs-0');
  toggleButton.dispatchEvent(new dom.window.Event('click'));
  assert(box.style.getPropertyValue('--crs-0') !== bgBefore, 'theme toggle CSS var updates on real click');

  const compositionRoot = document.getElementById('composition-root');
  assert(compositionRoot && compositionRoot.querySelector('.card') !== null, 'composition example mounted into the page');
  assert(
    compositionRoot.querySelector('.greeting') !== null &&
      compositionRoot.querySelector('.greeting').textContent === 'Hello, World!',
    'composition example resolves nested component-as-element and slot content in a real page'
  );

  const reactiveListRoot = document.getElementById('reactive-list-root');
  assert(reactiveListRoot && reactiveListRoot.querySelectorAll('p').length === 2, 'reactive list example mounted both tasks');
  const firstTaskBefore = reactiveListRoot.querySelector('p').className;
  reactiveListRoot.querySelector('button').dispatchEvent(new dom.window.Event('click'));
  const firstTaskAfter = reactiveListRoot.querySelector('p').className;
  assert(
    firstTaskBefore === 'pending' && firstTaskAfter === 'done',
    `reactive array-index assignment updates the real page, got "${firstTaskBefore}" -> "${firstTaskAfter}"`
  );

  const derivedRoot = document.getElementById('derived-lifecycle-root');
  assert(derivedRoot && derivedRoot.querySelector('.total').textContent === 'Total: 20', 'derived/lifecycle example mounted with correct initial total');
  assert(derivedRoot.querySelector('.log').textContent === 'mounted', 'derived/lifecycle example ran on_mount in a real page');
  derivedRoot.querySelector('button').dispatchEvent(new dom.window.Event('click'));
  assert(
    derivedRoot.querySelector('.total').textContent === 'Total: 30' &&
      derivedRoot.querySelector('.log').textContent === 'quantity changed to 3',
    'derived/lifecycle example recomputes derived value and fires on_change on a real click'
  );

  const modulesRoot = document.getElementById('modules-root');
  assert(modulesRoot && modulesRoot.querySelector('.card') !== null, 'cross-file module example mounted into the page');
  assert(
    modulesRoot.querySelector('.origin') !== null &&
      modulesRoot.querySelector('.origin').textContent === 'Origin: (0, 0)' &&
      modulesRoot.querySelector('.point') !== null &&
      modulesRoot.querySelector('.point').textContent === '(3, 4)',
    'cross-file module example resolves use/super::/braced imports correctly in a real page'
  );

  const keyedListRoot = document.getElementById('keyed-list-root');
  const initialTodos = keyedListRoot && Array.from(keyedListRoot.querySelectorAll('.todo'));
  assert(initialTodos && initialTodos.length === 2, 'keyed list example mounted into the page');
  const firstNode = initialTodos[0];
  keyedListRoot.querySelector('.swap-btn').dispatchEvent(new dom.window.Event('click'));
  const afterSwap = Array.from(keyedListRoot.querySelectorAll('.todo'));
  assert(
    afterSwap[1] === firstNode && afterSwap.map((n) => n.textContent).join(',') === 'Walk dog,Buy milk',
    'keyed list reconciliation reuses DOM nodes on reorder in a real page'
  );

  const mutatorsRoot = document.getElementById('array-mutators-root');
  assert(mutatorsRoot && mutatorsRoot.querySelectorAll('.item').length === 2, 'array mutators example mounted into the page');
  mutatorsRoot.querySelector('.add-btn').dispatchEvent(new dom.window.Event('click'));
  assert(
    Array.from(mutatorsRoot.querySelectorAll('.item')).map((n) => n.textContent).join(',') === 'Buy milk,Walk dog,New task',
    'items.push(...) reactively updates a real page'
  );

  const mutatorsNativeRoot = document.getElementById('array-mutators-native-root');
  assert(mutatorsNativeRoot && mutatorsNativeRoot.querySelectorAll('.num').length === 3, 'native array mutators example mounted into the page');
  mutatorsNativeRoot.querySelector('.reverse-btn').dispatchEvent(new dom.window.Event('click'));
  assert(
    Array.from(mutatorsNativeRoot.querySelectorAll('.num')).map((n) => n.textContent).join(',') === '2,1,3',
    'items.reverse() reactively updates a real page'
  );

  const provideInjectRoot = document.getElementById('provide-inject-root');
  assert(
    provideInjectRoot &&
      provideInjectRoot.querySelector('div') !== null &&
      provideInjectRoot.querySelector('div').className === 'dark-theme',
    'provide<T>/inject<T> context threads correctly through a real page'
  );

  dom.window.close();
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
});
