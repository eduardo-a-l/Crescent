const path = require('path');
const os = require('os');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { buildPreviewHtml } = require('../dist/webPreview');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

async function main() {
  const root = path.join(__dirname, '..', 'examples');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-preview-'));

  const result = await buildPreviewHtml(root, outDir);

  assert(result.ok, 'buildPreviewHtml succeeds against examples/');
  assert(typeof result.html === 'string' && result.html.length > 0, 'buildPreviewHtml returns non-empty html');
  assert(result.bundleErrors.length === 0, `no bundling errors, got ${JSON.stringify(result.bundleErrors)}`);

  const expectedRoots = [
    'Counter',
    'DayPicker',
    'ThemeToggle',
    'App',
    'TaskBoard',
    'Cart',
    'TodoList',
    'TaskList',
    'NumberList',
    'Header',
  ];
  for (const name of expectedRoots) {
    assert(result.mounts.some((m) => m.componentName === name), `preview mounts include ${name}`);
  }

  assert(
    !result.mounts.some((m) => m.relPath === 'composition.crs' && m.componentName === 'Greeting'),
    'preview does not mount the prop-taking Greeting(string name)'
  );
  assert(
    !result.mounts.some((m) => m.relPath === path.join('modules', 'components', 'card.crs') && m.componentName === 'Card'),
    'preview does not mount the prop-taking Card(Point origin)'
  );

  const dom = new JSDOM(result.html, { runScripts: 'dangerously', resources: 'usable' });
  await new Promise((resolve) => {
    dom.window.addEventListener('load', resolve);
  });

  const document = dom.window.document;
  const counterMount = result.mounts.find((m) => m.componentName === 'Counter');
  const counterRoot = document.getElementById(counterMount.rootId);
  assert(counterRoot && counterRoot.querySelector('h1') !== null, 'Counter mounted into the preview page');
  assert(
    counterRoot.querySelector('h1').textContent === 'Current Count: 0',
    `Counter shows initial text, got "${counterRoot.querySelector('h1').textContent}"`
  );

  const addButton = counterRoot.querySelectorAll('button')[0];
  addButton.dispatchEvent(new dom.window.Event('click'));
  assert(
    counterRoot.querySelector('h1').textContent === 'Current Count: 1',
    `Counter increments on a real click in the preview page, got "${counterRoot.querySelector('h1').textContent}"`
  );

  const deepNestedMount = result.mounts.find((m) => m.componentName === 'DeepNestedWidget');
  const deepNestedEl = deepNestedMount && document.getElementById(deepNestedMount.rootId);
  assert(
    deepNestedEl && deepNestedEl.classList.contains('crs-preview-mount-error'),
    'a component that needs an ancestor provide<T> (inject<T> with no provider) reports an inline mount error instead of crashing the page'
  );
  assert(
    counterRoot.querySelector('h1').textContent === 'Current Count: 1',
    'a failed mount elsewhere on the page does not prevent other roots from working'
  );

  dom.window.close();

  // A project whose only files fail semantic checking should still produce a
  // usable (if empty) preview rather than throwing, since buildProject()
  // already skips codegen per-file for exactly this case.
  const brokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-preview-broken-'));
  fs.writeFileSync(path.join(brokenDir, 'broken.crs'), 'component App {\n  state<int> count = "not a number";\n  view {\n    <p>{count}</p>\n  }\n}\n');
  const brokenOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-preview-broken-out-'));
  const brokenResult = await buildPreviewHtml(brokenDir, brokenOutDir);
  assert(brokenResult.ok, 'buildPreviewHtml still succeeds when every file has semantic errors');
  assert(brokenResult.mounts.length === 0, 'no mounts are produced for a project with only semantic errors');
  assert(
    brokenResult.build.builds.some((b) => b.outFile === null),
    'the broken file is reported as skipped rather than silently dropped'
  );
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
});
