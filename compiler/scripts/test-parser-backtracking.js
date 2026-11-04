const path = require('path');
const { parseCrescent, parseStats, ParseError } = require(path.join(__dirname, '..', 'dist', 'parser.js'));
const { checkFile } = require(path.join(__dirname, '..', 'dist', 'checker.js'));

function assert(cond, message) {
  if (!cond) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('PASS:', message);
  }
}

const wrap = (body) =>
  `struct Point {\n    int x;\n    int y;\n}\n\ncomponent C {\n    state<int> n = 0;\n    state<int[]> values = [1];\n    state<Point> p = Point { x: 1, y: 2 };\n    void f() {\n${body}\n    }\n    view {\n        <p>"x"</p>\n    }\n}\n`;

function backtracks(body) {
  parseStats.backtracks = 0;
  parseCrescent(wrap(body));
  return parseStats.backtracks;
}

function firstStatement(body) {
  const program = parseCrescent(wrap(body));
  const component = program.declarations.find((d) => d.kind === 'ComponentDecl');
  const fn = component.members.find((m) => m.kind === 'FunctionDecl');
  return fn.body[0];
}

const noBacktrack = {
  'assignments, calls and increments': 'n = n + 1;\nconsole.log(n);\nf();\nn++;',
  'primitive declarations': 'int a = 1;\nstring s = "x";',
  'a declaration with a named type': 'Point q = Point { x: 1, y: 2 };',
  'nullable, array and generic declarations': 'string? m = null;\nint[] xs = [1];\nPoint[] ps = [];\nList<int> l = [];',
  'an index assignment': 'values[0] = 5;',
  'a nested index assignment': 'values[values[0]] = 1;',
  'a member assignment': 'p.x = 1;',
  'a struct destructure': 'Point { x, y } = p;',
  'a for-each loop with a named item type': 'for (Point q in values) { n = n + 1; }',
  'a C-style for loop with an identifier initializer': 'int i = 0;\nfor (i = 0; i < 3; i++) { n = n + i; }',
  'a C-style for loop initializing an index': 'for (values[0] = 0; n < 3; n++) { n = n + 1; }',
  'a struct literal': 'Point q = Point { x: 1, y: 2 };\nn = n + q.x;',
};
for (const [label, body] of Object.entries(noBacktrack)) {
  const count = backtracks(body);
  assert(count === 0, `backtracking: ${label} parses without trying and abandoning another form, got ${count} backtracks`);
}

const typedForCount = backtracks('for (int i = 0; i < 3; i++) { n = n + i; }');
assert(typedForCount === 1, `backtracking: a C-style for loop with a typed initializer costs one backtrack per loop, got ${typedForCount}`);

const many = Array.from({ length: 2000 }, (_, i) => [`n = n + ${i};`, 'console.log(n);', `int a${i} = ${i};`, `values[${i % 3}] = ${i};`, `Point { x } = p;`][i % 5]).join('\n');
const manyCount = backtracks(many);
assert(manyCount === 0, `backtracking: 2000 ordinary statements cause no backtracks at all, which is what keeps parsing fast, got ${manyCount}`);

const forms = {
  'an index assignment': ['values[0] = 5;', (s) => s.kind === 'Assignment' && s.target.kind === 'Index' && s.op === '='],
  'a declaration with an array type': ['Point[] ps = [];', (s) => s.kind === 'VarDecl' && s.type.kind === 'ArrayType' && s.name === 'ps'],
  'a declaration with a generic type': ['List<int> l = [];', (s) => s.kind === 'VarDecl' && s.type.kind === 'GenericType'],
  'a declaration with a nullable type': ['Point? q = null;', (s) => s.kind === 'VarDecl' && s.type.kind === 'NullableType'],
  'a declaration with a named type': ['Point q = p;', (s) => s.kind === 'VarDecl' && s.type.kind === 'NamedType' && s.name === 'q'],
  'a struct destructure': ['Point { x, y } = p;', (s) => s.kind === 'StructDestructure' && s.typeName === 'Point' && s.fields.join() === 'x,y'],
  'a comparison used as a statement': ['n < 3;', (s) => s.kind === 'ExprStatement' && s.expr.kind === 'Binary' && s.expr.op === '<'],
  'a ternary used as a statement': ['n ? 1 : 2;', (s) => s.kind === 'ExprStatement' && s.expr.kind === 'Ternary'],
  'a call used as a statement': ['f();', (s) => s.kind === 'ExprStatement' && s.expr.kind === 'Call'],
  'a member assignment': ['p.x = 1;', (s) => s.kind === 'Assignment' && s.target.kind === 'Member'],
  'a compound assignment': ['n += 2;', (s) => s.kind === 'Assignment' && s.op === '+='],
  'a postfix increment': ['n++;', (s) => s.kind === 'PostfixStmt' && s.op === '++'],
};
for (const [label, [body, matches]] of Object.entries(forms)) {
  let statement;
  try {
    statement = firstStatement(body);
  } catch (e) {
    statement = { kind: 'error: ' + e.message };
  }
  assert(matches(statement), `dispatch: ${label} is parsed as the right kind of statement, got ${JSON.stringify(statement).slice(0, 120)}`);
}

for (const body of ['x y;', 'values[] z;', 'Point { x ;']) {
  let error = null;
  try {
    parseCrescent(wrap(body));
  } catch (e) {
    error = e;
  }
  assert(error instanceof ParseError, `dispatch: '${body}' is still a controlled parse error, got ${error && error.constructor.name}`);
}

function undefinedIdentifierLine(body) {
  const program = parseCrescent(wrap(body));
  const file = { relPath: 'x.crs', program };
  const diagnostics = checkFile(file, new Map([['x.crs', file]]), []);
  const found = diagnostics.find((d) => /Undefined identifier 'nope'/.test(d.message));
  return found ? found.line : null;
}

const lineCases = {
  'a multi-line index assignment': 'values[\n            0\n        ] = 5;\nconsole.log(nope);',
  'a typed for initializer split over lines, which does backtrack': 'for (int i\n            = 0; i < 3; i++) {\n            n = n + 1;\n        }\nconsole.log(nope);',
  'a destructure split over lines': 'Point {\n            x,\n            y\n        } = p;\nconsole.log(nope);',
  'a generic declaration split over lines': 'List<\n            int\n        > l = [];\nconsole.log(nope);',
  'a struct literal split over lines': 'Point q = Point {\n            x: 1,\n            y: 2\n        };\nconsole.log(nope);',
};
for (const [label, body] of Object.entries(lineCases)) {
  const expected = wrap(body).split('\n').findIndex((l) => l.includes('nope')) + 1;
  const line = undefinedIdentifierLine(body);
  assert(line === expected, `line numbers: after ${label} an error is reported on its true line ${expected}, got ${line}`);
}
