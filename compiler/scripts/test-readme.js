const fs = require('fs');
const path = require('path');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

const sourceFiles = fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'));
const missingSources = sourceFiles.filter((f) => !readme.includes(`src/${f}`));
assert(missingSources.length === 0, `README: every source file in src/ is described in the Structure section, missing ${JSON.stringify(missingSources)}`);

const testScripts = fs.readdirSync(path.join(__dirname)).filter((f) => /^test-.*\.js$/.test(f));
const missingTests = testScripts.filter((f) => !readme.includes(f));
assert(missingTests.length === 0, `README: every test script in scripts/ is mentioned, missing ${JSON.stringify(missingTests)}`);

const extraTools = ['fuzz.js', 'fuzz-harness.js', 'build-web.js'];
const missingTools = extraTools.filter((f) => !readme.includes(f));
assert(missingTools.length === 0, `README: the fuzzer and the web bundler are mentioned, missing ${JSON.stringify(missingTools)}`);

const named = new Set();
for (const match of readme.matchAll(/`((?:src|scripts|bench|examples|dist)\/[A-Za-z0-9_./-]+)`/g)) {
  const candidate = match[1].replace(/[.,;:]+$/, '');
  if (candidate.includes('*') || candidate.startsWith('dist/')) continue;
  named.add(candidate);
}
const nonexistent = Array.from(named).filter((p) => !fs.existsSync(path.join(root, p)));
assert(nonexistent.length === 0, `README: every file or directory path it names exists, checked ${named.size}, missing ${JSON.stringify(nonexistent)}`);

const mentionedTests = Array.from(new Set(Array.from(readme.matchAll(/\b(test-[a-z0-9-]+\.js)\b/g)).map((m) => m[1])));
const missingMentioned = mentionedTests.filter((f) => !fs.existsSync(path.join(__dirname, f)));
assert(missingMentioned.length === 0, `README: every test script it names exists, checked ${mentionedTests.length}, missing ${JSON.stringify(missingMentioned)}`);

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const wired = packageJson.scripts.test;
const unwired = testScripts.filter((f) => !wired.includes(`scripts/${f}`));
assert(unwired.length === 0, `package.json: every test script in scripts/ is run by npm test, missing ${JSON.stringify(unwired)}`);

const referencedCommands = Array.from(readme.matchAll(/`npm run ([a-z:]+)`/g)).map((m) => m[1]);
const unknownCommands = Array.from(new Set(referencedCommands)).filter((c) => !packageJson.scripts[c]);
assert(unknownCommands.length === 0, `README: every 'npm run' command it shows is defined in package.json, missing ${JSON.stringify(unknownCommands)}`);
