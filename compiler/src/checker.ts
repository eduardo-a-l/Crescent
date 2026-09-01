import * as AST from './ast';
import { FileImports, LoadedFile } from './modules';

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  where: string;
  line: number;
}

interface SymbolInfo {
  kind: 'component' | 'struct';
  decl: AST.ComponentDecl | AST.StructDecl;
}

const BUILTIN_GLOBALS = new Set([
  'fetch',
  'console',
  'Math',
  'Date',
  'JSON',
  'Promise',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
]);

function err(message: string, where: string, line: number): Diagnostic {
  return { severity: 'error', message, where, line };
}

function warn(message: string, where: string, line: number): Diagnostic {
  return { severity: 'warning', message, where, line };
}

function typeIsResolvable(type: AST.CrescentType, scope: Map<string, SymbolInfo>): boolean {
  switch (type.kind) {
    case 'PrimitiveType':
      return true;
    case 'NamedType':
      return scope.has(type.name);
    case 'GenericType':
      return scope.has(type.name) && typeIsResolvable(type.typeArg, scope);
    case 'NullableType':
      return typeIsResolvable(type.inner, scope);
    case 'ArrayType':
      return typeIsResolvable(type.inner, scope);
    default:
      return true;
  }
}

export function typeToString(type: AST.CrescentType): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name;
    case 'NamedType':
      return type.name;
    case 'GenericType':
      return `${type.name}<${typeToString(type.typeArg)}>`;
    case 'NullableType':
      return `${typeToString(type.inner)}?`;
    case 'ArrayType':
      return `${typeToString(type.inner)}[]`;
    default:
      return '?';
  }
}

function inferLiteralType(expr: AST.Expr): AST.CrescentType | null {
  switch (expr.kind) {
    case 'IntLiteral':
      return { kind: 'PrimitiveType', name: 'int' };
    case 'FloatLiteral':
      return { kind: 'PrimitiveType', name: 'float' };
    case 'StringLiteral':
      return { kind: 'PrimitiveType', name: 'string' };
    case 'BoolLiteral':
      return { kind: 'PrimitiveType', name: 'bool' };
    case 'StructLiteral':
      return { kind: 'NamedType', name: expr.typeName };
    case 'ArrayLiteral': {
      if (expr.elements.length === 0) return null;
      const inner = inferLiteralType(expr.elements[0]);
      if (!inner) return null;
      return { kind: 'ArrayType', inner };
    }
    default:
      return null;
  }
}

function literalTypeMatches(declared: AST.CrescentType, actual: AST.CrescentType): boolean {
  if (declared.kind === 'NullableType') return literalTypeMatches(declared.inner, actual);
  if (declared.kind === 'PrimitiveType' && actual.kind === 'PrimitiveType') {
    if (declared.name === actual.name) return true;
    return declared.name === 'float' && actual.name === 'int';
  }
  if (declared.kind === 'NamedType' && actual.kind === 'NamedType') return declared.name === actual.name;
  if (declared.kind === 'ArrayType' && actual.kind === 'ArrayType') return literalTypeMatches(declared.inner, actual.inner);
  return false;
}

function checkLiteralTypeMatch(declared: AST.CrescentType, init: AST.Expr, where: string, line: number, diagnostics: Diagnostic[]): void {
  if (init.kind === 'NullLiteral') {
    if (declared.kind !== 'NullableType') {
      diagnostics.push(err(`'null' assigned to non-nullable type '${typeToString(declared)}'`, where, line));
    }
    return;
  }
  const actual = inferLiteralType(init);
  if (!actual) return;
  if (!literalTypeMatches(declared, actual)) {
    diagnostics.push(
      err(`Type mismatch: declared as '${typeToString(declared)}' but initialized with a '${typeToString(actual)}' value`, where, line)
    );
  }
}

interface NarrowState {
  nullable: Map<string, AST.CrescentType>;
  narrowed: Set<string>;
}

function narrowingTarget(test: AST.Expr, nullable: Map<string, AST.CrescentType>): string | null {
  if (test.kind === 'Identifier' && nullable.has(test.name)) return test.name;
  if (test.kind === 'Binary' && test.op === '!=') {
    if (test.left.kind === 'Identifier' && nullable.has(test.left.name) && test.right.kind === 'NullLiteral') return test.left.name;
    if (test.right.kind === 'Identifier' && nullable.has(test.right.name) && test.left.kind === 'NullLiteral') return test.right.name;
  }
  return null;
}

function checkExpr(
  expr: AST.Expr,
  scope: Set<string>,
  globalScope: Map<string, SymbolInfo>,
  narrow: NarrowState,
  where: string,
  line: number,
  diagnostics: Diagnostic[]
): void {
  switch (expr.kind) {
    case 'IntLiteral':
    case 'FloatLiteral':
    case 'StringLiteral':
    case 'BoolLiteral':
    case 'NullLiteral':
      return;
    case 'Identifier':
      if (!scope.has(expr.name) && !globalScope.has(expr.name) && !BUILTIN_GLOBALS.has(expr.name)) {
        diagnostics.push(err(`Undefined identifier '${expr.name}'`, where, line));
      }
      return;
    case 'StructLiteral': {
      const structInfo = globalScope.get(expr.typeName);
      if (!structInfo) {
        diagnostics.push(err(`Unknown struct type '${expr.typeName}'`, where, line));
      } else if (structInfo.kind !== 'struct') {
        diagnostics.push(err(`'${expr.typeName}' is a component, not a struct — it cannot be used as a struct literal`, where, line));
      } else {
        const structDecl = structInfo.decl as AST.StructDecl;
        const declaredFields = new Map(structDecl.fields.map((f) => [f.name, f.type]));
        const providedNames = new Set(expr.fields.map((f) => f.name));
        for (const f of structDecl.fields) {
          if (!providedNames.has(f.name)) {
            diagnostics.push(err(`Missing field '${f.name}' in struct literal '${expr.typeName}'`, where, line));
          }
        }
        for (const f of expr.fields) {
          if (!declaredFields.has(f.name)) {
            diagnostics.push(err(`Unknown field '${f.name}' on struct '${expr.typeName}'`, where, line));
          } else {
            checkLiteralTypeMatch(declaredFields.get(f.name)!, f.value, `${where}, field '${f.name}'`, line, diagnostics);
          }
        }
      }
      for (const f of expr.fields) checkExpr(f.value, scope, globalScope, narrow, where, line, diagnostics);
      return;
    }
    case 'ArrayLiteral':
      for (const el of expr.elements) checkExpr(el, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'Unary':
      checkExpr(expr.operand, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'Binary':
      checkExpr(expr.left, scope, globalScope, narrow, where, line, diagnostics);
      checkExpr(expr.right, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'Ternary':
      checkExpr(expr.test, scope, globalScope, narrow, where, line, diagnostics);
      checkExpr(expr.consequent, scope, globalScope, narrow, where, line, diagnostics);
      checkExpr(expr.alternate, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'Call':
      checkExpr(expr.callee, scope, globalScope, narrow, where, line, diagnostics);
      for (const a of expr.args) checkExpr(a, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'Member':
      if (expr.object.kind === 'Identifier' && narrow.nullable.has(expr.object.name) && !narrow.narrowed.has(expr.object.name)) {
        diagnostics.push(
          warn(`'${expr.object.name}' is nullable (${typeToString(narrow.nullable.get(expr.object.name)!)}) and is accessed here without a null check`, where, line)
        );
      }
      checkExpr(expr.object, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'Index':
      if (expr.object.kind === 'Identifier' && narrow.nullable.has(expr.object.name) && !narrow.narrowed.has(expr.object.name)) {
        diagnostics.push(
          warn(`'${expr.object.name}' is nullable (${typeToString(narrow.nullable.get(expr.object.name)!)}) and is accessed here without a null check`, where, line)
        );
      }
      checkExpr(expr.object, scope, globalScope, narrow, where, line, diagnostics);
      checkExpr(expr.index, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'Postfix':
      checkExpr(expr.operand, scope, globalScope, narrow, where, line, diagnostics);
      return;
  }
}

function checkAssignmentTarget(
  target: AST.Expr,
  scope: Set<string>,
  globalScope: Map<string, SymbolInfo>,
  derivedNames: Set<string>,
  where: string,
  line: number,
  diagnostics: Diagnostic[]
): void {
  if (target.kind === 'Identifier') {
    if (derivedNames.has(target.name)) {
      diagnostics.push(err(`Cannot assign to derived '${target.name}'; reassign one of its dependencies instead`, where, line));
    }
    return;
  }
  let root: AST.Expr = target;
  while (root.kind === 'Member' || root.kind === 'Index') root = root.object;
  if (root.kind === 'Identifier' && target.kind === 'Member' && target.object.kind === 'Identifier' && target.object.name === root.name) {
    diagnostics.push(
      err(`Direct property write on state '${root.name}' is forbidden; reassign the whole state instead (see design doc §13.2)`, where, line)
    );
  }
}

function checkStmts(
  stmts: AST.Stmt[],
  scope: Set<string>,
  globalScope: Map<string, SymbolInfo>,
  narrow: NarrowState,
  derivedNames: Set<string>,
  where: string,
  diagnostics: Diagnostic[]
): void {
  const localScope = new Set(scope);
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case 'VarDecl':
        checkExpr(stmt.init, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        if (!typeIsResolvable(stmt.type, globalScope)) {
          diagnostics.push(err(`Unknown type '${typeToString(stmt.type)}' referenced by variable '${stmt.name}'`, where, stmt.line));
        }
        localScope.add(stmt.name);
        break;
      case 'Assignment':
        checkExpr(stmt.value, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        checkExpr(stmt.target, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        checkAssignmentTarget(stmt.target, localScope, globalScope, derivedNames, where, stmt.line, diagnostics);
        break;
      case 'PostfixStmt':
        checkExpr(stmt.target, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        checkAssignmentTarget(stmt.target, localScope, globalScope, derivedNames, where, stmt.line, diagnostics);
        break;
      case 'ExprStatement':
        checkExpr(stmt.expr, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        break;
      case 'If': {
        checkExpr(stmt.test, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        const target = narrowingTarget(stmt.test, narrow.nullable);
        const consequentNarrow: NarrowState = {
          nullable: narrow.nullable,
          narrowed: target ? new Set(narrow.narrowed).add(target) : narrow.narrowed,
        };
        checkStmts(stmt.consequent, localScope, globalScope, consequentNarrow, derivedNames, where, diagnostics);
        if (stmt.alternate) checkStmts(stmt.alternate, localScope, globalScope, narrow, derivedNames, where, diagnostics);
        break;
      }
      case 'For': {
        checkExpr(stmt.iterable, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        const bodyScope = new Set(localScope);
        bodyScope.add(stmt.itemName);
        checkStmts(stmt.body, bodyScope, globalScope, narrow, derivedNames, where, diagnostics);
        break;
      }
      case 'Return':
        if (stmt.value) checkExpr(stmt.value, localScope, globalScope, narrow, where, stmt.line, diagnostics);
        break;
    }
  }
}

function checkTemplateNode(
  node: AST.TemplateNode,
  scope: Set<string>,
  globalScope: Map<string, SymbolInfo>,
  narrow: NarrowState,
  where: string,
  diagnostics: Diagnostic[]
): void {
  const line = node.line;
  switch (node.kind) {
    case 'Element': {
      if (node.isComponent) {
        const info = globalScope.get(node.tag);
        if (!info) {
          diagnostics.push(err(`Unknown component '<${node.tag}>'`, where, line));
        } else if (info.kind !== 'component') {
          diagnostics.push(err(`'${node.tag}' is a struct, not a component — it cannot be used as an element`, where, line));
        } else {
          const compDecl = info.decl as AST.ComponentDecl;
          const declaredParams = new Set(compDecl.params.map((p) => p.name));
          const providedNames = new Set(node.attributes.map((a) => a.name));
          for (const p of compDecl.params) {
            if (!providedNames.has(p.name)) {
              diagnostics.push(err(`Missing prop '${p.name}' passed to <${node.tag}>`, where, line));
            }
          }
          for (const a of node.attributes) {
            if (!declaredParams.has(a.name) && !a.name.startsWith('on')) {
              diagnostics.push(err(`Unknown prop '${a.name}' passed to <${node.tag}> (not declared as a param)`, where, line));
            }
          }
        }
      }
      for (const a of node.attributes) {
        if (a.isExpr && a.exprValue) checkExpr(a.exprValue, scope, globalScope, narrow, where, line, diagnostics);
      }
      for (const c of node.children) checkTemplateNode(c, scope, globalScope, narrow, where, diagnostics);
      return;
    }
    case 'TemplateIf': {
      checkExpr(node.test, scope, globalScope, narrow, where, line, diagnostics);
      const target = narrowingTarget(node.test, narrow.nullable);
      const consequentNarrow: NarrowState = {
        nullable: narrow.nullable,
        narrowed: target ? new Set(narrow.narrowed).add(target) : narrow.narrowed,
      };
      for (const c of node.consequent) checkTemplateNode(c, scope, globalScope, consequentNarrow, where, diagnostics);
      if (node.alternate) for (const c of node.alternate) checkTemplateNode(c, scope, globalScope, narrow, where, diagnostics);
      return;
    }
    case 'TemplateFor': {
      checkExpr(node.iterable, scope, globalScope, narrow, where, line, diagnostics);
      const bodyScope = new Set(scope);
      bodyScope.add(node.itemName);
      if (node.key) checkExpr(node.key, bodyScope, globalScope, narrow, where, line, diagnostics);
      for (const c of node.body) checkTemplateNode(c, bodyScope, globalScope, narrow, where, diagnostics);
      return;
    }
    case 'TextInterpolation':
      checkExpr(node.expr, scope, globalScope, narrow, where, line, diagnostics);
      return;
    case 'TextLiteral':
      return;
  }
}

function checkStructDecl(decl: AST.StructDecl, globalScope: Map<string, SymbolInfo>, diagnostics: Diagnostic[]): void {
  const where = `struct '${decl.name}'`;
  for (const f of decl.fields) {
    if (!typeIsResolvable(f.type, globalScope)) {
      diagnostics.push(err(`Unknown type '${typeToString(f.type)}' referenced by field '${f.name}'`, where, decl.line));
    }
  }
}

function checkComponentDecl(decl: AST.ComponentDecl, globalScope: Map<string, SymbolInfo>, diagnostics: Diagnostic[]): void {
  const where = `component '${decl.name}'`;
  const scope = new Set<string>();
  const nullable = new Map<string, AST.CrescentType>();

  for (const p of decl.params) {
    scope.add(p.name);
    if (p.type.kind === 'NullableType') nullable.set(p.name, p.type);
    if (!typeIsResolvable(p.type, globalScope)) {
      diagnostics.push(err(`Unknown type '${typeToString(p.type)}' referenced by param '${p.name}'`, where, decl.line));
    }
  }

  let viewCount = 0;
  for (const m of decl.members) {
    switch (m.kind) {
      case 'StateDecl':
      case 'DerivedDecl':
      case 'ProvideDecl':
      case 'ConstDecl':
      case 'InjectDecl':
        scope.add(m.name);
        if (m.type.kind === 'NullableType') nullable.set(m.name, m.type);
        break;
      case 'FunctionDecl':
        scope.add(m.name);
        break;
      case 'ViewBlockDecl':
        viewCount += 1;
        break;
    }
  }

  if (viewCount === 0) diagnostics.push(err(`Component has no 'view' block`, where, decl.line));
  if (viewCount > 1) diagnostics.push(err(`Component has more than one 'view' block`, where, decl.line));

  const derivedNames = new Set(
    decl.members.filter((m): m is AST.DerivedDecl => m.kind === 'DerivedDecl').map((m) => m.name)
  );
  const narrow: NarrowState = { nullable, narrowed: new Set() };

  for (const m of decl.members) {
    switch (m.kind) {
      case 'StateDecl':
      case 'DerivedDecl':
      case 'ProvideDecl':
      case 'ConstDecl':
        checkExpr(m.init, scope, globalScope, narrow, `${where}, '${m.name}'`, m.line, diagnostics);
        checkLiteralTypeMatch(m.type, m.init, `${where}, '${m.name}'`, m.line, diagnostics);
        break;
      case 'InjectDecl':
        if (!typeIsResolvable(m.type, globalScope)) {
          diagnostics.push(err(`Unknown type '${typeToString(m.type)}' referenced by inject '${m.name}'`, where, m.line));
        }
        break;
      case 'FunctionDecl': {
        const fnScope = new Set(scope);
        for (const p of m.params) fnScope.add(p.name);
        const fnWhere = `${where}, function '${m.name}'`;
        checkStmts(m.body, fnScope, globalScope, narrow, derivedNames, fnWhere, diagnostics);
        break;
      }
      case 'OnMountDecl':
        checkStmts(m.body, scope, globalScope, narrow, derivedNames, `${where}, on_mount`, diagnostics);
        break;
      case 'OnChangeDecl':
        for (const w of m.watched) {
          if (!scope.has(w)) diagnostics.push(err(`Undefined identifier '${w}' watched by on_change`, where, m.line));
        }
        checkStmts(m.body, scope, globalScope, narrow, derivedNames, `${where}, on_change(${m.watched.join(', ')})`, diagnostics);
        break;
      case 'ViewBlockDecl':
        for (const node of m.nodes) checkTemplateNode(node, scope, globalScope, narrow, `${where}, view`, diagnostics);
        break;
      case 'StyleBlockDecl':
        for (const rule of m.rules) {
          for (const d of rule.declarations) {
            for (const part of d.parts) {
              if (part.kind === 'expr') checkExpr(part.expr, scope, globalScope, narrow, `${where}, style`, m.line, diagnostics);
            }
          }
        }
        break;
    }
  }
}

export function checkFile(file: LoadedFile, files: Map<string, LoadedFile>, imports: FileImports[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const globalScope = new Map<string, SymbolInfo>();

  for (const decl of file.program.declarations) {
    if (decl.kind === 'ComponentDecl') globalScope.set(decl.name, { kind: 'component', decl });
    if (decl.kind === 'StructDecl') globalScope.set(decl.name, { kind: 'struct', decl });
  }

  for (const imp of imports) {
    const targetFile = files.get(imp.targetRelPath);
    if (!targetFile) continue;
    for (const n of imp.names) {
      const found = targetFile.program.declarations.find(
        (d): d is AST.ComponentDecl | AST.StructDecl =>
          (d.kind === 'ComponentDecl' || d.kind === 'StructDecl') && d.name === n.imported
      );
      if (found) globalScope.set(n.local, { kind: n.kind, decl: found });
    }
  }

  for (const decl of file.program.declarations) {
    if (decl.kind === 'StructDecl') checkStructDecl(decl, globalScope, diagnostics);
    if (decl.kind === 'ComponentDecl') checkComponentDecl(decl, globalScope, diagnostics);
  }

  return diagnostics;
}
