const os = require('os');
const fs = require('fs');
const path = require('path');
const { buildPreviewHtml } = require('crescent-compiler/dist/webPreview');

const MAX_SOURCE_BYTES = 200 * 1024;

async function compileToPreview(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return { ok: false, error: 'No source provided.' };
  }

  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    return { ok: false, error: `Source too large (limit ${MAX_SOURCE_BYTES} bytes).` };
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-playground-'));
  const srcDir = path.join(tempRoot, 'src');
  const outDir = path.join(tempRoot, 'out');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'main.crs'), source, 'utf-8');

  try {
    const result = await buildPreviewHtml(srcDir, outDir);

    const diagnostics = [];
    for (const [relPath, diags] of result.build.check.diagnosticsByFile) {
      for (const d of diags) {
        diagnostics.push({ file: relPath, line: d.line, severity: d.severity, message: d.message });
      }
    }

    return {
      ok: result.ok,
      fatal: result.build.check.fatal ? result.build.check.fatal.message : null,
      diagnostics,
      html: result.html,
      bundleErrors: result.bundleErrors,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = { compileToPreview, MAX_SOURCE_BYTES };
