const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function decodeUrlSafeBase64(encoded) {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = Buffer.from(padded, 'base64').toString('binary');
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return Buffer.from(bytes).toString('utf-8');
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'app');
const highlightSource = fs.readFileSync(path.join(PUBLIC_DIR, 'highlight.js'), 'utf-8');
const appSource = fs.readFileSync(path.join(PUBLIC_DIR, 'app.js'), 'utf-8');

async function main() {
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
  window.fetch = async () => ({ json: async () => ({ ok: true, diagnostics: [], html: '<p>ok</p>' }) });
  window.navigator.clipboard = { writeText: async (text) => { window.__copiedText = text; } };
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;

  window.eval(highlightSource);
  window.eval(appSource);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const editor = window.document.getElementById('editor');
  const highlightCode = window.document.getElementById('highlight-code');

  assert(editor.value.startsWith('component Counter'), 'the editor loads the default Counter example on first load');
  assert(
    highlightCode.innerHTML.includes('<span class="tok-keyword">component</span>'),
    'the highlight layer is populated with real syntax highlighting on first load'
  );

  editor.value = 'component Foo {}';
  editor.dispatchEvent(new window.Event('input'));
  assert(
    highlightCode.innerHTML.includes('Foo') && highlightCode.innerHTML.includes('tok-keyword'),
    're-highlighting happens live as the editor content changes'
  );

  editor.value = 'abcdefgh';
  editor.selectionStart = editor.selectionEnd = 4;
  const tabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
  editor.dispatchEvent(tabEvent);
  assert(tabEvent.defaultPrevented, 'pressing Tab is intercepted rather than moving focus out of the editor');
  assert(editor.value === 'abcd    efgh', `Tab inserts a 4-space indent at the cursor, got ${JSON.stringify(editor.value)}`);
  assert(editor.selectionStart === 8, 'the cursor lands right after the inserted indent');

  editor.value = 'component ShareMe {}';
  window.document.getElementById('share-btn').dispatchEvent(new window.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert(typeof window.__copiedText === 'string' && window.__copiedText.includes('#code='), 'sharing copies a URL containing the encoded source in its hash');
  const hashMatch = window.location.hash.match(/^#code=(.+)$/);
  assert(hashMatch !== null, 'sharing also updates the page URL hash in place');
  assert(
    decodeUrlSafeBase64(hashMatch[1]) === 'component ShareMe {}',
    'decoding the share-link hash reproduces the exact source that was shared'
  );
}

main();
