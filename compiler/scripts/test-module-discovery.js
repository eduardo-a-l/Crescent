const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkProject } = require(path.join(__dirname, '..', 'dist', 'project.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-discovery-'));
const valid = (name) => `component ${name} {\n    view {\n        <p>"${name}"</p>\n    }\n}\n`;
const invalid = 'component {{{';

function write(rel, text) {
  const abs = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

write('main.crs', valid('Main'));
write('sub/nested/deep.crs', valid('Deep'));
write('node_modules_like/kept.crs', valid('Kept'));
write('not_a_crescent_file.txt', invalid);
write('node_modules/pkg/ignored.crs', invalid);
write('sub/node_modules/pkg/ignored.crs', invalid);
write('.hidden/ignored.crs', invalid);
write('sub/.cache/ignored.crs', invalid);
write('.draft.crs', invalid);
write('sub/.draft.crs', invalid);

const result = checkProject(tmpRoot);
const found = Array.from(result.files.keys()).sort();

assert(result.ok && result.fatal === null, `discovery: files that would not parse inside node_modules, hidden directories or hidden files are never read, got ${JSON.stringify(result.fatal)}`);
assert(
  JSON.stringify(found) === JSON.stringify(['main.crs', 'node_modules_like/kept.crs', 'sub/nested/deep.crs']),
  `discovery: every other .crs file under the root is found at any depth, and a directory merely named like node_modules is kept, got ${JSON.stringify(found)}`
);

fs.rmSync(tmpRoot, { recursive: true, force: true });
