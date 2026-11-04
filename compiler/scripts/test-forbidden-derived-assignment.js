const fs = require('fs');
const path = require('path');
const { parseCrescent } = require(path.join(__dirname, '..', 'dist', 'parser.js'));
const { generateProgram, CodegenError } = require(path.join(__dirname, '..', 'dist', 'codegen.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const source = fs.readFileSync(path.join(__dirname, 'fixtures', 'forbidden-derived-assignment.crs'), 'utf8');
const program = parseCrescent(source);

try {
  generateProgram(program);
  assert(false, 'assignment to a derived<T> should have thrown a CodegenError');
} catch (err) {
  assert(err instanceof CodegenError, `threw CodegenError, got ${err.constructor.name}: ${err.message}`);
  assert(
    /cannot assign to derived 'total'/.test(err.message),
    `error message names the offending derived value, got "${err.message}"`
  );
}
