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

function growthExponent(points) {
  const xs = points.map((p) => Math.log(p[0]));
  const ys = points.map((p) => Math.log(p[1]));
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY);
    variance += (xs[i] - meanX) ** 2;
  }
  return covariance / variance;
}

function bestCpuTime(fn, attempts) {
  let min = Infinity;
  for (let i = 0; i < attempts; i++) {
    const start = process.cpuUsage();
    fn();
    const used = process.cpuUsage(start);
    min = Math.min(min, (used.user + used.system) / 1000);
  }
  return min;
}

const MAX_EXPONENT = 1.5;
const EXPONENT_ATTEMPTS = 3;
const sizes = [2000, 4000, 8000, 16000];

function measureExponent(sources) {
  const points = sizes.map((size, i) => [size, bestTotal(sources[i], 5)]);
  return growthExponent(points);
}

for (const shape of linearShapes) {
  const sources = sizes.map((size) => single[shape](size));
  for (const source of sources) bestTotal(source, 1);
  let exponent = Infinity;
  for (let attempt = 0; attempt < EXPONENT_ATTEMPTS && !(exponent < MAX_EXPONENT); attempt++) {
    exponent = Math.min(exponent, measureExponent(sources));
  }
  assert(
    exponent < MAX_EXPONENT,
    `scaling: '${shape}' takes time proportional to size raised to ${exponent.toFixed(2)} from ${sizes[0]} to ${sizes[sizes.length - 1]} (1 is linear, 2 is quadratic, the limit is ${MAX_EXPONENT})`
  );
}

let sink = 0;
function syntheticExponent(work, workSizes) {
  for (const size of workSizes) work(size);
  return growthExponent(workSizes.map((size) => [size, bestCpuTime(() => work(size), 5)]));
}
const linearWork = (n) => {
  for (let i = 0; i < n * 4000; i++) sink += i & 7;
};
const quadraticWork = (n) => {
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sink += (i ^ j) & 7;
};
const syntheticSizes = [500, 1000, 2000, 4000];
function firstAccepted(measure, accept) {
  let value;
  for (let attempt = 0; attempt < 4; attempt++) {
    value = measure();
    if (accept(value)) return value;
  }
  return value;
}
const linearExponent = firstAccepted(() => syntheticExponent(linearWork, syntheticSizes), (value) => value < MAX_EXPONENT);
const quadraticExponent = firstAccepted(() => syntheticExponent(quadraticWork, syntheticSizes), (value) => value > MAX_EXPONENT);
assert(linearExponent < MAX_EXPONENT, `guard: a workload that is linear by construction measures ${linearExponent.toFixed(2)}, under the limit`);
assert(quadraticExponent > MAX_EXPONENT, `guard: a workload that is quadratic by construction measures ${quadraticExponent.toFixed(2)}, over the limit, so a real quadratic regression would be caught`);
assert(Math.abs(growthExponent([[1, 3], [2, 6], [4, 12], [8, 24]]) - 1) < 1e-9 && Math.abs(growthExponent([[1, 1], [2, 4], [4, 16]]) - 2) < 1e-9, 'guard: the exponent of exact linear and quadratic data is 1 and 2');
assert(sink >= 0, 'guard: the synthetic workloads ran');

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
