const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { compileToPreview } = require('../lib/compileToPreview');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const highlightSource = fs.readFileSync(path.join(PUBLIC_DIR, 'highlight.js'), 'utf-8');
const appSource = fs.readFileSync(path.join(PUBLIC_DIR, 'app.js'), 'utf-8');

function buildHarness() {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div class="editor-wrap">
        <pre class="highlight-layer"><code id="highlight-code"></code></pre>
        <textarea id="editor"></textarea>
      </div>
      <div id="diagnostics"></div>
      <button id="run-btn"></button>
      <button id="share-btn"></button>
      <span id="share-status"></span>
      <iframe id="preview"></iframe>
    </body></html>`,
    { runScripts: 'dangerously', url: 'http://localhost/playground/' }
  );

  const { window } = dom;
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.requestAnimationFrame = () => 0;
  window.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const result = await compileToPreview(body.source);
    return { json: async () => result };
  };

  window.eval(highlightSource);
  window.eval(appSource);

  return dom;
}

async function testRealCounterRunsEndToEnd() {
  const dom = buildHarness();
  const { window } = dom;

  const COUNTER_SOURCE = `component Counter {
    state<int> count = 0;

    void increment() {
        count++;
    }

    view {
        <div class="counter-card">
            <h1>"Current Count: " {count}</h1>
            <button onclick={increment}>"Add"</button>
        </div>
    }
}
`;

  window.document.getElementById('editor').value = COUNTER_SOURCE;
  window.document.getElementById('run-btn').dispatchEvent(new window.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 50));

  const preview = window.document.getElementById('preview');
  assert(typeof preview.srcdoc === 'string' && preview.srcdoc.length > 0, 'clicking Run sets a non-empty srcdoc on the preview iframe');
  assert(!preview.srcdoc.includes('Nothing to preview'), 'a valid component does not fall back to the empty-preview placeholder');

  const diagnosticsEl = window.document.getElementById('diagnostics');
  assert(diagnosticsEl.children.length === 0, 'a clean component leaves the diagnostics panel empty');

  const previewDom = new JSDOM(preview.srcdoc, { runScripts: 'dangerously', resources: 'usable' });
  await new Promise((resolve) => previewDom.window.addEventListener('load', resolve));
  const root = previewDom.window.document.querySelector('[data-crescent-component="Counter"]');
  assert(root !== null, 'the srcdoc produced by a real Run click actually mounts the Counter component when loaded fresh');
  assert(
    root.querySelector('h1').textContent === 'Current Count: 0',
    `the freshly-mounted component shows its real initial state, got "${root.querySelector('h1') && root.querySelector('h1').textContent}"`
  );

  root.querySelector('button').dispatchEvent(new previewDom.window.Event('click'));
  assert(
    root.querySelector('h1').textContent === 'Current Count: 1',
    `clicking inside the real, end-to-end-produced preview actually updates state, got "${root.querySelector('h1').textContent}"`
  );

  dom.window.close();
  previewDom.window.close();
}

async function testBrokenCodeShowsDiagnosticsThroughRealUI() {
  const dom = buildHarness();
  const { window } = dom;

  window.document.getElementById('editor').value = 'component Broken {{{ oops';
  window.document.getElementById('run-btn').dispatchEvent(new window.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 50));

  const diagnosticsEl = window.document.getElementById('diagnostics');
  assert(diagnosticsEl.children.length > 0, 'a syntax error produces at least one diagnostic entry in the real UI, not a silent failure');
  assert(
    diagnosticsEl.textContent.length > 0 && !diagnosticsEl.textContent.includes('undefined'),
    `the fatal error message is real text, not an "undefined" leaking through, got ${JSON.stringify(diagnosticsEl.textContent)}`
  );

  dom.window.close();
}

async function testRunButtonReflectsInFlightState() {
  const dom = buildHarness();
  const { window } = dom;

  window.document.getElementById('editor').value = 'component Empty { view { <p>"hi"</p> } }';
  const runBtn = window.document.getElementById('run-btn');
  runBtn.dispatchEvent(new window.Event('click'));

  assert(runBtn.disabled === true, 'the Run button disables itself immediately while a compile is in flight');
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert(runBtn.disabled === false, 'the Run button re-enables itself once the compile finishes');

  dom.window.close();
}

async function testStaleResponseDoesNotOverwriteNewerResult() {
  const dom = buildHarness();
  const { window } = dom;

  const resolvers = [];
  window.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    return new Promise((resolve) => {
      resolvers.push(async () => {
        const result = await compileToPreview(body.source);
        resolve({ json: async () => result });
      });
    });
  };

  window.document.getElementById('editor').value = 'component First { view { <p>"first"</p> } }';
  window.document.getElementById('run-btn').dispatchEvent(new window.Event('click'));

  window.document.getElementById('editor').value = 'component Second { view { <p>"second"</p> } }';
  window.document.getElementById('run-btn').dispatchEvent(new window.Event('click'));

  assert(resolvers.length === 2, `both overlapping Run clicks actually issued a request, got ${resolvers.length}`);

  await resolvers[1]();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await resolvers[0]();
  await new Promise((resolve) => setTimeout(resolve, 10));

  const preview = window.document.getElementById('preview');
  assert(
    preview.srcdoc.includes('data-crescent-component="Second"') && !preview.srcdoc.includes('data-crescent-component="First"'),
    'when an older request resolves after a newer one, the newer result stays on screen instead of being overwritten by the stale response'
  );

  dom.window.close();
}

async function main() {
  await testRealCounterRunsEndToEnd();
  await testBrokenCodeShowsDiagnosticsThroughRealUI();
  await testRunButtonReflectsInFlightState();
  await testStaleResponseDoesNotOverwriteNewerResult();
}

main();
