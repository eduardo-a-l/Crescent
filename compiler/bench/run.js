const fs = require('fs');
const os = require('os');
const path = require('path');
const { single, projectFiles } = require('./shapes.js');

const root = path.join(__dirname, '..');
const { Lexer } = require(path.join(root, 'dist', 'lexer.js'));
const { parseCrescent } = require(path.join(root, 'dist', 'parser.js'));
const { checkFile } = require(path.join(root, 'dist', 'checker.js'));
const { generateProgram } = require(path.join(root, 'dist', 'codegen.js'));
const { resolveFileImportsLenient } = require(path.join(root, 'dist', 'modules.js'));
const { checkProject, buildProject } = require(path.join(root, 'dist', 'project.js'));

function now() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function timed(fn) {
  const started = now();
  const value = fn();
  return { ms: now() - started, value };
}

function best(runs, fn) {
  let min = Infinity;
  for (let i = 0; i < runs; i++) min = Math.min(min, timed(fn).ms);
  return min;
}

function calibrate() {
  const workload = () => {
    let acc = 0;
    const values = [];
    for (let i = 0; i < 300000; i++) values.push((i * 2654435761) % 1000003);
    values.sort((a, b) => a - b);
    for (let i = 0; i < values.length; i += 7) acc += values[i];
    let text = '';
    for (let i = 0; i < 20000; i++) text += String(i % 97);
    return acc + text.length;
  };
  workload();
  return best(7, workload);
}

function measureSingle(source, runs) {
  const lexMs = best(runs, () => {
    const lexer = new Lexer(source);
    let token;
    do {
      token = lexer.nextToken();
    } while (token.type !== 'EOF');
  });
  const parseMs = best(runs, () => parseCrescent(source));
  const program = parseCrescent(source);
  const file = { relPath: 'bench.crs', program };
  const files = new Map([[file.relPath, file]]);
  const checkMs = best(runs, () => {
    const resolved = resolveFileImportsLenient(file, files);
    return checkFile(file, files, resolved.imports, resolved.unresolved);
  });
  const genMs = best(runs, () => generateProgram(program));
  return { lexMs, parseMs, checkMs, genMs };
}

function measureProject(count, runs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crescent-bench-'));
  let bytes = 0;
  for (const [rel, text] of Object.entries(projectFiles(count))) {
    fs.writeFileSync(path.join(dir, rel), text);
    bytes += text.length;
  }
  const checkMs = best(runs, () => checkProject(dir));
  const buildMs = best(Math.max(1, runs - 1), () => buildProject(dir, path.join(dir, 'out')));
  fs.rmSync(dir, { recursive: true, force: true });
  return { files: count, bytes, checkMs, buildMs };
}

function parseArgs(argv) {
  const options = { quick: false, json: null, compare: null, threshold: 2, shapes: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--quick') options.quick = true;
    else if (arg === '--json') options.json = argv[++i];
    else if (arg === '--compare') options.compare = argv[++i];
    else if (arg === '--threshold') options.threshold = Number(argv[++i]);
    else if (arg === '--shapes') options.shapes = argv[++i].split(',');
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument '${arg}'`);
  }
  return options;
}

function usage() {
  return [
    'node bench/run.js [--quick] [--shapes a,b] [--json file] [--compare baseline.json] [--threshold 2]',
    '',
    'Times lex, parse, check and codegen for synthetic inputs of doubling size, and checkProject and',
    'buildProject for multi-file projects. Times are the best of several runs, in milliseconds, and are',
    'also stored divided by a calibration workload so that a baseline from another machine can be',
    'compared. --compare exits with status 1 when a stage is more than --threshold times slower than',
    'the baseline after normalisation and takes more than 5 ms.',
  ].join('\n');
}

function fixed(value, width) {
  return value.toFixed(1).padStart(width);
}

function run(options) {
  const calibrationMs = calibrate();
  const sizes = options.quick ? [200, 400] : [500, 1000, 2000, 4000, 8000];
  const projectSizes = options.quick ? [10, 20] : [20, 100, 500];
  const runs = options.quick ? 2 : 4;
  const shapeNames = options.shapes || Object.keys(single);
  const results = { meta: { node: process.version, platform: `${process.platform}-${process.arch}`, calibrationMs, quick: options.quick }, single: [], projects: [] };

  console.log(`calibration ${calibrationMs.toFixed(2)} ms on node ${process.version} (${results.meta.platform})`);
  for (const shape of shapeNames) {
    if (!single[shape]) throw new Error(`Unknown shape '${shape}'`);
    console.log(`\n${shape}\n  n       bytes     lex   parse   check     gen   total  x prev`);
    let previous = null;
    for (const n of sizes.map((size) => (shape === 'functions' ? size / 2 : size))) {
      const source = single[shape](n);
      const m = measureSingle(source, runs);
      const total = m.parseMs + m.checkMs + m.genMs;
      const growth = previous === null ? '     -' : (total / previous).toFixed(2).padStart(6);
      console.log(`  ${String(n).padEnd(7)} ${String(source.length).padEnd(8)} ${fixed(m.lexMs, 6)} ${fixed(m.parseMs, 7)} ${fixed(m.checkMs, 7)} ${fixed(m.genMs, 7)} ${fixed(total, 7)} ${growth}`);
      results.single.push({ shape, n, bytes: source.length, ...m });
      previous = total;
    }
  }

  console.log('\nprojects\n  files   bytes     check   build');
  for (const count of projectSizes) {
    const m = measureProject(count, runs);
    console.log(`  ${String(count).padEnd(7)} ${String(m.bytes).padEnd(8)} ${fixed(m.checkMs, 7)} ${fixed(m.buildMs, 7)}`);
    results.projects.push(m);
  }

  return results;
}

function compare(current, baseline, threshold) {
  const regressions = [];
  const note = (label, stage, now, then) => {
    const nowNorm = now / current.meta.calibrationMs;
    const thenNorm = then / baseline.meta.calibrationMs;
    if (now > 5 && nowNorm > thenNorm * threshold) {
      regressions.push({ label, stage, ratio: nowNorm / thenNorm, now, then });
    }
  };
  for (const row of current.single) {
    const old = baseline.single.find((b) => b.shape === row.shape && b.n === row.n);
    if (!old) continue;
    for (const stage of ['lexMs', 'parseMs', 'checkMs', 'genMs']) note(`${row.shape} n=${row.n}`, stage, row[stage], old[stage]);
  }
  for (const row of current.projects) {
    const old = baseline.projects.find((b) => b.files === row.files);
    if (!old) continue;
    for (const stage of ['checkMs', 'buildMs']) note(`project files=${row.files}`, stage, row[stage], old[stage]);
  }
  return regressions;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const results = run(options);
  if (options.json) {
    fs.writeFileSync(options.json, JSON.stringify(results, null, 2) + '\n');
    console.log(`\nwrote ${options.json}`);
  }
  if (options.compare) {
    const baseline = JSON.parse(fs.readFileSync(options.compare, 'utf8'));
    const regressions = compare(results, baseline, options.threshold);
    if (regressions.length === 0) {
      console.log(`\nno stage is more than ${options.threshold}x slower than ${options.compare} (normalised by calibration)`);
    } else {
      console.log(`\nregressions against ${options.compare}:`);
      for (const r of regressions) console.log(`  ${r.label} ${r.stage}: ${r.then.toFixed(1)} ms -> ${r.now.toFixed(1)} ms (${r.ratio.toFixed(2)}x after normalisation)`);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) main();

module.exports = { measureSingle, compare, parseArgs };
