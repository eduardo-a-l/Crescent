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
    file: 'undefined-identifier-read.crs',
    severity: 'error',
    pattern: /Undefined identifier 'missing'/,
    label: 'an undefined identifier read in a view interpolation',
  },
  {
    file: 'interpolated-string-undefined-identifier.crs',
    severity: 'error',
    pattern: /Undefined identifier 'missing'/,
    label: 'an undefined identifier read inside a {...} string interpolation',
  },
  {
    file: 'interpolated-string-type-mismatch.crs',
    severity: 'error',
    pattern: /Type mismatch: declared as 'int' but initialized with a 'string' value/,
    label: 'a state<int> initialized with an interpolated string (always type string)',
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
    file: 'unknown-component.crs',
    severity: 'error',
    pattern: /Unknown component '<Missing>'/,
    label: 'a template element referencing a component that does not exist',
  },
  {
    file: 'struct-as-component.crs',
    severity: 'error',
    pattern: /'User' is a struct, not a component — it cannot be used as an element/,
    label: 'a template element referencing a struct name instead of a component',
  },
  {
    file: 'unknown-prop.crs',
    severity: 'error',
    pattern: /Unknown prop 'nickname' passed to <Greeting> \(not declared as a param\)/,
    label: 'a component call passing a prop the component does not declare',
  },
  {
    file: 'missing-view-block.crs',
    severity: 'error',
    pattern: /Component has no 'view' block/,
    label: 'a component with no view block at all',
  },
  {
    file: 'duplicate-view-block.crs',
    severity: 'error',
    pattern: /Component has more than one 'view' block/,
    label: 'a component with two view blocks',
  },
  {
    file: 'derived-assignment-forbidden.crs',
    severity: 'error',
    pattern: /Cannot assign to derived 'total'; reassign one of its dependencies instead/,
    label: 'a direct assignment to a derived<T> value',
  },
  {
    file: 'direct-property-write-forbidden.crs',
    severity: 'error',
    pattern: /Direct property write on state 'user' is forbidden; reassign the whole state instead/,
    label: 'a direct property write on a state<T> holding a struct',
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
    file: 'component-param-unknown-type.crs',
    severity: 'error',
    pattern: /Unknown type 'BogusType' referenced by param 'value'/,
    label: 'a component-level param (not a function param) declared with an unresolvable type',
  },
  {
    file: 'struct-field-unknown-type.crs',
    severity: 'error',
    pattern: /Unknown type 'BogusType' referenced by field 'value'/,
    label: 'a struct field declared with an unresolvable type',
  },
  {
    file: 'inject-unknown-type.crs',
    severity: 'error',
    pattern: /Unknown type 'BogusType' referenced by inject 'value'/,
    label: 'an inject<T> declared with an unresolvable type',
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
  {
    file: 'duplicate-top-level.crs',
    severity: 'error',
    pattern: /Duplicate top-level declaration 'Greeting'/,
    label: 'two top-level declarations sharing a name in the same file',
  },
  {
    file: 'duplicate-struct-field.crs',
    severity: 'error',
    pattern: /Duplicate field 'name' in struct 'User'/,
    label: 'a struct with two fields sharing a name',
  },
  {
    file: 'duplicate-component-member.crs',
    severity: 'error',
    pattern: /'count' is declared more than once in component 'Broken'/,
    label: 'a component with two members (a state and a function) sharing a name',
  },
  {
    file: 'duplicate-function-param.crs',
    severity: 'error',
    pattern: /Duplicate param 'a' in function 'add'/,
    label: 'a function with two params sharing a name',
  },
  {
    file: 'wrong-return-type.crs',
    severity: 'error',
    pattern: /function 'compute' declares return type 'int' but returns a 'string' value/,
    label: 'a function returning a literal of the wrong type',
  },
  {
    file: 'missing-return-value.crs',
    severity: 'error',
    pattern: /Function 'compute' must return a value of type 'int'/,
    label: 'a non-void function with a bare "return;" statement',
  },
  {
    file: 'void-return-with-value.crs',
    severity: 'error',
    pattern: /Function 'run' has a 'void' return type but returns a value/,
    label: 'a void function returning a value',
  },
  {
    file: 'null-return-not-nullable.crs',
    severity: 'error',
    pattern: /'null' returned from function 'compute', which is not nullable \('int'\)/,
    label: 'a non-nullable function returning null',
  },
  {
    file: 'wrong-array-element-type.crs',
    severity: 'error',
    pattern: /Type mismatch: array element at index 2 expects 'int' but received a 'string' value/,
    label: 'an array literal state initializer with a mismatched element type',
  },
  {
    file: 'null-array-element-not-nullable.crs',
    severity: 'error',
    pattern: /'null' at index 1 is not allowed because the element type 'int' is not nullable/,
    label: 'an array literal with a null element whose element type is not nullable',
  },
  {
    file: 'wrong-array-element-type-arg.crs',
    severity: 'error',
    pattern: /Type mismatch: element of argument 'values' of function 'sum' at index 2 expects 'int' but received a 'string' value/,
    label: 'a function call with an inline array-literal argument containing a mismatched element',
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

const noDuplicatesDiagnostics = diagnosticsFor('no-duplicates-ok.crs');
assert(noDuplicatesDiagnostics.length === 0, `no-duplicates-ok.crs: unique names across params, members, struct fields, and top-level decls produce no diagnostics, got ${JSON.stringify(noDuplicatesDiagnostics)}`);

const correctReturnDiagnostics = diagnosticsFor('correct-return-ok.crs');
assert(correctReturnDiagnostics.length === 0, `correct-return-ok.crs: correctly-typed returns (including a nullable return and a bare void "return;") produce no diagnostics, got ${JSON.stringify(correctReturnDiagnostics)}`);

const correctArrayElementsDiagnostics = diagnosticsFor('correct-array-elements-ok.crs');
assert(correctArrayElementsDiagnostics.length === 0, `correct-array-elements-ok.crs: correctly-typed array literals (including nullable elements and a nested array) produce no diagnostics, got ${JSON.stringify(correctArrayElementsDiagnostics)}`);

const exampleFiles = loadAllPrograms(path.join(__dirname, '..', 'examples'));
let totalExampleDiagnostics = 0;
for (const [relPath, file] of exampleFiles) {
  const imports = resolveFileImports(file, exampleFiles);
  totalExampleDiagnostics += checkFile(file, exampleFiles, imports).length;
}
assert(totalExampleDiagnostics === 0, `all real examples pass the semantic checker cleanly, got ${totalExampleDiagnostics} diagnostic(s)`);
