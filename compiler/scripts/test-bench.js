const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { single, linearShapes } = require('../bench/shapes.js');
const { measureSingle, compare } = require('../bench/run.js');

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

function bestTotal(source, attempts) {
  let min = Infinity;
  for (let i = 0; i < attempts; i++) {
    const m = measureSingle(source, 1);
    min = Math.min(min, m.parseMs + m.checkMs + m.genMs);
  }
  return min;
}

const small = 4000;
const large = 16000;
for (const shape of linearShapes) {
  bestTotal(single[shape](small), 1);
  const ratio = bestTotal(single[shape](large), 3) / bestTotal(single[shape](small), 3);
  assert(
    ratio < 8,
    `scaling: '${shape}' input ${large / small} times larger takes ${ratio.toFixed(1)} times as long to parse, check and generate, and doubling is linear at ${large / small} and quadratic at ${(large / small) ** 2}`
  );
}

const baseline = {
  meta: { calibrationMs: 100 },
  single: [{ shape: 'statements', n: 1000, lexMs: 4, parseMs: 40, checkMs: 20, genMs: 10 }],
  projects: [{ files: 100, checkMs: 30, buildMs: 60 }],
};
const sameMachine = JSON.parse(JSON.stringify(baseline));
assert(compare(sameMachine, baseline, 2).length === 0, 'compare: identical timings are not reported');

const slowerMachine = JSON.parse(JSON.stringify(baseline));
slowerMachine.meta.calibrationMs = 200;
for (const row of slowerMachine.single) for (const key of ['lexMs', 'parseMs', 'checkMs', 'genMs']) row[key] *= 2;
for (const row of slowerMachine.projects) for (const key of ['checkMs', 'buildMs']) row[key] *= 2;
assert(compare(slowerMachine, baseline, 2).length === 0, 'compare: a machine that is twice as slow at everything, calibration included, is not reported');

const regressed = JSON.parse(JSON.stringify(baseline));
regressed.single[0].parseMs = 200;
regressed.projects[0].buildMs = 400;
const found = compare(regressed, baseline, 2);
assert(
  found.length === 2 && found.some((r) => r.stage === 'parseMs' && r.label === 'statements n=1000') && found.some((r) => r.stage === 'buildMs' && r.label === 'project files=100'),
  `compare: a stage that got five and almost seven times slower is reported along with where it happened, got ${JSON.stringify(found.map((r) => [r.label, r.stage]))}`
);

const tiny = JSON.parse(JSON.stringify(baseline));
tiny.single[0].lexMs = 4.9;
const tinyBaseline = JSON.parse(JSON.stringify(baseline));
tinyBaseline.single[0].lexMs = 0.1;
assert(compare(tiny, tinyBaseline, 2).length === 0, 'compare: a stage that stays under five milliseconds is never reported, however large the ratio');

const unmatched = JSON.parse(JSON.stringify(baseline));
unmatched.single[0].n = 5000;
unmatched.single[0].parseMs = 4000;
assert(compare(unmatched, baseline, 2).length === 0, 'compare: sizes that are not in the baseline are skipped');

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-bench-test-')), 'quick.json');
const smoke = spawnSync(process.execPath, [path.join(__dirname, '..', 'bench', 'run.js'), '--quick', '--json', out], { encoding: 'utf8', timeout: 120000 });
let written = null;
try {
  written = JSON.parse(fs.readFileSync(out, 'utf8'));
} catch (e) {
  written = null;
}
assert(
  smoke.status === 0 &&
    written !== null &&
    written.meta.calibrationMs > 0 &&
    written.single.length === Object.keys(single).length * 2 &&
    written.single.every((r) => r.parseMs > 0 && r.checkMs >= 0 && r.genMs >= 0 && r.bytes > 0) &&
    written.projects.length === 2 &&
    written.projects.every((r) => r.checkMs > 0 && r.buildMs > 0),
  `run: quick mode runs every shape at two sizes and two project sizes and writes complete JSON, got status ${smoke.status}`
);
const against = spawnSync(process.execPath, [path.join(__dirname, '..', 'bench', 'run.js'), '--quick', '--shapes', 'members', '--compare', out, '--threshold', '50'], { encoding: 'utf8', timeout: 120000 });
assert(against.status === 0 && /no stage is more than 50x slower/.test(against.stdout), `run: --compare against a baseline from the same machine passes with a generous threshold, got status ${against.status}`);
fs.rmSync(path.dirname(out), { recursive: true, force: true });
