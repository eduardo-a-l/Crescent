const path = require('path');
const { loadAllPrograms, resolveFileImports } = require(path.join(__dirname, '..', 'dist', 'modules.js'));
const { checkFile } = require(path.join(__dirname, '..', 'dist', 'checker.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const fixturesDir = path.join(__dirname, 'fixtures', 'checker');
const files = loadAllPrograms(fixturesDir);

function diagnosticsFor(relPath) {
  const file = files.get(relPath);
  const imports = resolveFileImports(file, files);
  return checkFile(file, files, imports);
}

function hasDiagnostic(diagnostics, severity, pattern) {
  return diagnostics.some((d) => d.severity === severity && pattern.test(d.message));
}

const cases = [
  {
    file: 'undefined-identifier.crs',
    severity: 'error',
    pattern: /Undefined identifier 'message'/,
    label: 'an undefined identifier used in an assignment target',
  },
  {
    file: 'missing-struct-field.crs',
    severity: 'error',
    pattern: /Missing field 'age' in struct literal 'User'/,
    label: 'a struct literal missing a required field',
  },
  {
    file: 'unknown-struct-field.crs',
    severity: 'error',
    pattern: /Unknown field 'nickname' on struct 'User'/,
    label: 'a struct literal with an unknown field',
  },
  {
    file: 'missing-prop.crs',
    severity: 'error',
    pattern: /Missing prop 'name' passed to <Greeting>/,
    label: 'a component call missing a required prop',
  },
  {
    file: 'type-mismatch.crs',
    severity: 'error',
    pattern: /declared as 'int' but initialized with a 'string' value/,
    label: 'a state<int> initialized with a string literal',
  },
  {
    file: 'unguarded-nullable.crs',
    severity: 'warning',
    pattern: /'user_name' is nullable \(string\?\) and is accessed here without a null check/,
    label: 'a nullable value accessed without a narrowing guard',
  },
  {
    file: 'unknown-generic-type.crs',
    severity: 'error',
    pattern: /Unknown type 'Response<int>' referenced by variable 'pending'/,
    label: 'a local variable declared with an unresolvable generic type name',
  },
  {
    file: 'unknown-return-and-for-types.crs',
    severity: 'error',
    pattern: /Unknown type 'Response<int>' referenced by return type of function 'load'/,
    label: 'an unresolvable function return type',
  },
  {
    file: 'unknown-return-and-for-types.crs',
    severity: 'error',
    pattern: /Unknown type 'Entry' referenced by for-loop item 'entry'/,
    label: 'an unresolvable statement for-loop item type',
  },
  {
    file: 'unknown-return-and-for-types.crs',
    severity: 'error',
    pattern: /Unknown type 'Row' referenced by template for-loop item 'row'/,
    label: 'an unresolvable template for-loop item type',
  },
  {
    file: 'unknown-function-param-type.crs',
    severity: 'error',
    pattern: /Unknown type 'BogusType' referenced by param 'x'/,
    label: 'a function param declared with an unresolvable type',
  },
  {
    file: 'wrong-arg-count.crs',
    severity: 'error',
    pattern: /Function 'add' expects 2 argument\(s\) but received 1/,
    label: 'a call to a local function with too few arguments',
  },
  {
    file: 'wrong-arg-type.crs',
    severity: 'error',
    pattern: /argument 'b' of function 'add' expects 'int' but received a 'string' value/,
    label: 'a call to a local function with a mismatched argument type',
  },
  {
    file: 'wrong-prop-type.crs',
    severity: 'error',
    pattern: /prop 'name' expects 'string' but received a 'int' value/,
    label: 'a component prop passed an expr literal of the wrong type',
  },
  {
    file: 'wrong-prop-type-string-attr.crs',
    severity: 'error',
    pattern: /prop 'value' expects 'int' but received a 'string' value/,
    label: 'a component prop passed a plain string attribute for a non-string param',
  },
];

for (const c of cases) {
  const diagnostics = diagnosticsFor(c.file);
  assert(hasDiagnostic(diagnostics, c.severity, c.pattern), `${c.file}: flags ${c.label}`);
}

const guardedDiagnostics = diagnosticsFor('guarded-nullable-ok.crs');
assert(guardedDiagnostics.length === 0, `guarded-nullable-ok.crs: an if (x != null) guard suppresses the nullable-access warning, got ${JSON.stringify(guardedDiagnostics)}`);

const correctCallDiagnostics = diagnosticsFor('correct-call-ok.crs');
assert(correctCallDiagnostics.length === 0, `correct-call-ok.crs: a call with the right argument count and types produces no diagnostics, got ${JSON.stringify(correctCallDiagnostics)}`);

const correctPropDiagnostics = diagnosticsFor('correct-prop-type-ok.crs');
assert(correctPropDiagnostics.length === 0, `correct-prop-type-ok.crs: correctly-typed literal and non-literal props produce no diagnostics, got ${JSON.stringify(correctPropDiagnostics)}`);

const exampleFiles = loadAllPrograms(path.join(__dirname, '..', 'examples'));
let totalExampleDiagnostics = 0;
for (const [relPath, file] of exampleFiles) {
  const imports = resolveFileImports(file, exampleFiles);
  totalExampleDiagnostics += checkFile(file, exampleFiles, imports).length;
}
assert(totalExampleDiagnostics === 0, `all real examples pass the semantic checker cleanly, got ${totalExampleDiagnostics} diagnostic(s)`);
