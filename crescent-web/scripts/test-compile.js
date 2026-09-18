const { JSDOM } = require('jsdom');
const { compileToPreview, MAX_SOURCE_BYTES } = require('../lib/compileToPreview');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

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

const NULLABLE_WARNING_SOURCE = `component Broken {
    state<string?> user_name = null;

    view {
        <p>{user_name.length}</p>
    }
}
`;

const SYNTAX_ERROR_SOURCE = `component {{{ broken`;

async function main() {
  const good = await compileToPreview(COUNTER_SOURCE);
  assert(
    good.ok === true,
    `a valid component compiles to a preview, got ${JSON.stringify({ ok: good.ok, fatal: good.fatal, diagnostics: good.diagnostics })}`
  );
  assert(typeof good.html === 'string' && good.html.length > 0, 'a valid component produces non-empty preview HTML');

  const dom = new JSDOM(good.html, { runScripts: 'dangerously', resources: 'usable' });
  await new Promise((resolve) => dom.window.addEventListener('load', resolve));
  const document = dom.window.document;

  const root = document.querySelector('[data-crescent-component="Counter"]');
  assert(root !== null, 'the Counter component actually mounted inside the compiled preview page');
  assert(
    root.querySelector('h1').textContent === 'Current Count: 0',
    `counter shows its initial state, got "${root.querySelector('h1') && root.querySelector('h1').textContent}"`
  );

  const button = root.querySelector('button');
  button.dispatchEvent(new dom.window.Event('click'));
  assert(
    root.querySelector('h1').textContent === 'Current Count: 1',
    `counter reacts to a real click dispatched inside the sandboxed preview, got "${root.querySelector('h1').textContent}"`
  );

  const warned = await compileToPreview(NULLABLE_WARNING_SOURCE);
  assert(warned.ok === true, 'a component with only a warning (not an error) still compiles to a preview');
  assert(
    warned.diagnostics.some((d) => d.severity === 'warning' && /user_name/.test(d.message)),
    `the nullable-access warning is surfaced in the diagnostics array, got ${JSON.stringify(warned.diagnostics)}`
  );

  const broken = await compileToPreview(SYNTAX_ERROR_SOURCE);
  assert(
    broken.ok === false && typeof broken.fatal === 'string' && broken.fatal.length > 0,
    `a syntax error surfaces as a fatal diagnostic instead of a crash, got ${JSON.stringify(broken)}`
  );

  const empty = await compileToPreview('');
  assert(empty.ok === false, 'empty source is rejected before it ever reaches the compiler');

  const tooBig = await compileToPreview('x'.repeat(MAX_SOURCE_BYTES + 1));
  assert(tooBig.ok === false, 'oversized source is rejected before it ever reaches the compiler');
}

main();
