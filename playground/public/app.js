(function () {
  const DEFAULT_SOURCE = `component Counter {
    state<int> count = 0;

    void increment() {
        count++;
    }

    void reset() {
        count = 0;
    }

    view {
        <div class="counter-card">
            <h1>"Current Count: " {count}</h1>

            if (count > 10) {
                <p class="warning">"Count is getting high!"</p>
            } else {
                <p>"Count is normal."</p>
            }

            <button onclick={increment}>"Add"</button>
            <button onclick={reset}>"Reset"</button>
        </div>
    }
}
`;

  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const diagnosticsEl = document.getElementById('diagnostics');
  const runBtn = document.getElementById('run-btn');
  const shareBtn = document.getElementById('share-btn');
  const shareStatus = document.getElementById('share-status');

  function encodeSource(source) {
    const bytes = new TextEncoder().encode(source);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeSource(encoded) {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '==='.slice((padded.length + 3) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function sourceFromHash() {
    const hash = window.location.hash;
    const match = hash.match(/^#code=(.+)$/);
    if (!match) return null;
    try {
      return decodeSource(match[1]);
    } catch (e) {
      console.warn('Crescent playground: could not decode shared code from the URL, using the default example instead.', e);
      return null;
    }
  }

  function renderDiagnostics(result) {
    diagnosticsEl.innerHTML = '';

    if (result.error) {
      const el = document.createElement('div');
      el.className = 'diagnostic fatal';
      el.textContent = result.error;
      diagnosticsEl.appendChild(el);
      return;
    }

    if (result.fatal) {
      const el = document.createElement('div');
      el.className = 'diagnostic fatal';
      el.textContent = result.fatal;
      diagnosticsEl.appendChild(el);
      return;
    }

    for (const d of result.diagnostics || []) {
      const el = document.createElement('div');
      el.className = `diagnostic ${d.severity}`;
      const location = d.line > 0 ? `line ${d.line}` : d.file;
      el.textContent = `[${d.severity}] ${location}: ${d.message}`;
      diagnosticsEl.appendChild(el);
    }

    for (const b of result.bundleErrors || []) {
      const el = document.createElement('div');
      el.className = 'diagnostic fatal';
      el.textContent = `bundling failed: ${b.message}`;
      diagnosticsEl.appendChild(el);
    }
  }

  async function run() {
    runBtn.disabled = true;
    runBtn.textContent = 'Compiling…';
    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: editor.value }),
      });
      const result = await response.json();
      renderDiagnostics(result);
      preview.srcdoc = result.html || '<p style="font-family: sans-serif; color: #888; padding: 1rem;">Nothing to preview.</p>';
    } catch (e) {
      renderDiagnostics({ error: `Could not reach the compiler: ${e.message}` });
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = 'Run ▶';
    }
  }

  function share() {
    const encoded = encodeSource(editor.value);
    const url = `${window.location.origin}${window.location.pathname}#code=${encoded}`;
    window.location.hash = `code=${encoded}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        shareStatus.textContent = 'Link copied!';
        setTimeout(() => (shareStatus.textContent = ''), 2000);
      })
      .catch(() => {
        shareStatus.textContent = 'Could not copy — select the URL bar to copy it manually.';
      });
  }

  editor.value = sourceFromHash() || DEFAULT_SOURCE;
  runBtn.addEventListener('click', run);
  shareBtn.addEventListener('click', share);

  run();
})();
