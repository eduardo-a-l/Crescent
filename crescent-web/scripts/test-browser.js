const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const compileHandler = require('../api/compile');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'app');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/api/compile') {
      compileHandler(req, res).catch((e) => {
        res.statusCode = 500;
        res.end(String(e));
      });
      return;
    }
    const relativePath = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(PUBLIC_DIR, relativePath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

async function typeMultilineSource(page) {
  await page.click('#editor');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');

  for (let i = 0; i < 30; i++) {
    await page.keyboard.type(`line ${i} of realistic length text here`, { delay: 15 });
    await page.keyboard.press('Enter');
  }
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 500 });
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });

    await typeMultilineSource(page);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const heights = await page.evaluate(() => {
      const editor = document.getElementById('editor');
      const highlightLayer = document.querySelector('.highlight-layer');
      return {
        editorScrollHeight: editor.scrollHeight,
        highlightScrollHeight: highlightLayer.scrollHeight,
        editorScrollTop: editor.scrollTop,
        highlightScrollTop: highlightLayer.scrollTop,
      };
    });

    assert(
      heights.editorScrollHeight === heights.highlightScrollHeight,
      `a multi-line source ending in a trailing newline gives the textarea and the highlight overlay the exact same scrollable height (this is the real cause behind text visually lining up against the wrong highlighted line), got ${JSON.stringify(heights)}`
    );
    assert(
      heights.editorScrollTop === heights.highlightScrollTop,
      `after typing enough to auto-scroll, the highlight overlay's scroll position exactly matches the textarea's, got ${JSON.stringify(heights)}`
    );

    const caretAlignment = await page.evaluate(() => {
      const editor = document.getElementById('editor');
      const highlightCode = document.getElementById('highlight-code');
      const editorRect = editor.getBoundingClientRect();

      function textareaCaretTop(ta, index) {
        const mirror = document.createElement('div');
        const style = getComputedStyle(ta);
        const props = ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'whiteSpace', 'wordWrap', 'tabSize'];
        for (const p of props) mirror.style[p] = style[p];
        mirror.style.position = 'absolute';
        mirror.style.visibility = 'hidden';
        mirror.style.top = '0';
        mirror.style.left = '-9999px';
        document.body.appendChild(mirror);
        mirror.textContent = ta.value.slice(0, index);
        const span = document.createElement('span');
        span.textContent = '|';
        mirror.appendChild(span);
        const top = span.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
        document.body.removeChild(mirror);
        return top + editorRect.top;
      }

      function highlightLineTop(text) {
        const walker = document.createTreeWalker(highlightCode, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const idx = node.textContent.indexOf(text);
          if (idx !== -1) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + text.length);
            return range.getBoundingClientRect().top;
          }
        }
        return null;
      }

      const value = editor.value;
      const marker = 'realistic';
      return {
        textareaTop: textareaCaretTop(editor, value.indexOf(marker)) - editor.scrollTop,
        highlightTop: highlightLineTop(marker),
      };
    });

    assert(
      Math.abs(caretAlignment.textareaTop - caretAlignment.highlightTop) < 1,
      `a specific line's position in the textarea matches its highlighted counterpart within a sub-pixel, got ${JSON.stringify(caretAlignment)}`
    );
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
