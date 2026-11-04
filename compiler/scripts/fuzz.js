const fs = require('fs');
const { runFuzz } = require('./fuzz-harness.js');

const traceFile = process.env.FUZZ_TRACE || '/tmp/fuzz-last.txt';

const seed = Number(process.argv[2] || 1);
const iterations = Number(process.argv[3] || 3000);
const pathological = process.argv[4] === 'deep';

const started = Date.now();
const result = runFuzz({
  seed,
  iterations,
  includePathological: pathological,
  onBefore: (source, label) => fs.writeFileSync(traceFile, label + '\n' + source),
});
console.log(`seed=${seed} runs=${result.runs} seeds=${result.seeds} crash-signatures=${result.crashes.length} elapsed=${Date.now() - started}ms slowest=${result.slowest.ms}ms (${result.slowest.label})`);
for (const c of result.crashes) {
  console.log('\n--- ' + c.signature + '  [' + c.count + 'x, ' + c.label + ', ' + c.source.length + ' chars]');
  console.log(JSON.stringify(c.source.length > 300 ? c.source.slice(0, 300) + '...' : c.source));
}
process.exitCode = result.crashes.length > 0 ? 1 : 0;
