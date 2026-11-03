const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
const ALLOWED_SECTIONS = new Set(['Added', 'Changed', 'Changed (breaking)', 'Deprecated', 'Removed', 'Fixed', 'Fixed (stricter)', 'Security']);

function compare(a, b) {
  const pa = VERSION.exec(a).slice(1, 4).map(Number);
  const pb = VERSION.exec(b).slice(1, 4).map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function checkChangelog(text, currentVersion) {
  const problems = [];
  const lines = text.split('\n');
  const releases = [];
  let unreleasedAt = -1;
  let firstReleaseAt = -1;
  lines.forEach((line, index) => {
    const release = /^## \[([^\]]+)\](?: - (.+))?$/.exec(line);
    if (release) {
      if (release[1] === 'Unreleased') {
        if (unreleasedAt !== -1) problems.push('there is more than one [Unreleased] section');
        unreleasedAt = index;
      } else {
        if (firstReleaseAt === -1) firstReleaseAt = index;
        if (!VERSION.test(release[1])) problems.push(`'${release[1]}' is not a MAJOR.MINOR.PATCH version`);
        const date = release[2];
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) problems.push(`release ${release[1]} has no valid date (YYYY-MM-DD)`);
        releases.push(release[1]);
      }
    } else if (/^## /.test(line)) {
      problems.push(`unrecognised heading '${line}'`);
    }
    const section = /^### (.+)$/.exec(line);
    if (section && !ALLOWED_SECTIONS.has(section[1])) problems.push(`'${section[1]}' is not one of the allowed section headings`);
  });
  if (unreleasedAt === -1) problems.push('there is no [Unreleased] section');
  if (unreleasedAt !== -1 && firstReleaseAt !== -1 && unreleasedAt > firstReleaseAt) problems.push('[Unreleased] must come before the releases');
  if (new Set(releases).size !== releases.length) problems.push('a version appears twice');
  const valid = releases.filter((v) => VERSION.test(v));
  for (let i = 1; i < valid.length; i++) {
    if (compare(valid[i - 1], valid[i]) <= 0) problems.push(`releases must be newest first, but ${valid[i - 1]} is listed before ${valid[i]}`);
  }
  if (valid.length > 0 && valid[0] !== currentVersion) problems.push(`the newest release is ${valid[0]} but compiler/package.json says ${currentVersion}`);
  if (valid.length === 0) problems.push('there is no released version in the changelog');
  return problems;
}

const packages = {
  compiler: 'compiler/package.json',
  'VS Code extension': 'editors/vscode/package.json',
  'crescent-web': 'crescent-web/package.json',
  playground: 'playground/package.json',
};
const versions = {};
for (const [name, file] of Object.entries(packages)) {
  versions[name] = JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8')).version;
  assert(VERSION.test(versions[name]), `${name}: version '${versions[name]}' has three parts (npm and the VS Code Marketplace reject anything else)`);
}

const changelog = fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8');
const real = checkChangelog(changelog, versions.compiler);
assert(real.length === 0, `CHANGELOG.md is well formed and its newest release is the compiler version ${versions.compiler}${real.length ? ': ' + real.join('; ') : ''}`);

const good = '## [Unreleased]\n\n### Added\n\n- x\n\n## [0.2.0] - 2026-01-02\n\n## [0.1.0] - 2026-01-01\n';
assert(checkChangelog(good, '0.2.0').length === 0, 'guard: a correct changelog has no problems');
assert(checkChangelog(good.replace('## [Unreleased]\n\n', ''), '0.2.0').some((p) => /no \[Unreleased\]/.test(p)), 'guard: a missing [Unreleased] section is found');
assert(checkChangelog(good, '0.3.0').some((p) => /newest release is 0\.2\.0/.test(p)), 'guard: a package version that is not the newest release is found');
assert(checkChangelog(good.replace('[0.2.0]', '[0.0.9]'), '0.0.9').some((p) => /newest first, but 0\.0\.9 is listed before 0\.1\.0/.test(p)), 'guard: releases out of order are found');
assert(checkChangelog(good.replace('[0.2.0] - 2026-01-02', '[0.2.0]'), '0.2.0').some((p) => /no valid date/.test(p)), 'guard: a release without a date is found');
assert(checkChangelog(good.replace('[0.2.0]', '[0.2]'), '0.2').some((p) => /not a MAJOR\.MINOR\.PATCH/.test(p)), 'guard: a two-part version is found');
assert(checkChangelog(good.replace('### Added', '### Features'), '0.2.0').some((p) => /allowed section/.test(p)), 'guard: an unknown section heading is found');
assert(checkChangelog(good.replace('## [0.1.0]', '## [0.2.0]'), '0.2.0').some((p) => /twice/.test(p)), 'guard: a duplicated version is found');
assert(checkChangelog('## [0.1.0] - 2026-01-01\n\n## [Unreleased]\n', '0.1.0').some((p) => /must come before/.test(p)), 'guard: [Unreleased] after a release is found');

const doc = fs.readFileSync(path.join(repo, 'docs', 'Crescent_Versioning.md'), 'utf8');
assert(/MAJOR\.MINOR\.PATCH/.test(doc) && /CHANGELOG\.md/.test(doc) && /compiler\/package\.json/.test(doc), 'docs/Crescent_Versioning.md names the scheme, the changelog and the source of truth');
