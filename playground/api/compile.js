const { compileToPreview } = require('../lib/compileToPreview');

// Vercel's Node.js function runtime parses a JSON request body into `req.body`
// automatically. Plain `http.Server` (used by scripts/dev-server.js for local
// development) does not, so this falls back to reading the raw stream itself —
// both environments share this same handler unmodified.
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed, use POST.' }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body.' }));
    return;
  }

  try {
    const result = await compileToPreview(body && body.source);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Internal compiler error.',
        message: e && e.message ? e.message : String(e),
      })
    );
  }
};
