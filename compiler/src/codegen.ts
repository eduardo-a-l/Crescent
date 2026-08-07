import * as AST from './ast';

export class CodegenError extends Error {}

function unsupported(feature: string): never {
  throw new CodegenError(`Codegen: '${feature}' is not yet supported in v0.1`);
}

function indentBlock(code: string, levels: number): string {
  const prefix = '  '.repeat(levels);
  return code
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n');
}

export function generateProgram(program: AST.Program): string {
  const parts: string[] = [];
  parts.push(`const { state, effect, h, text, ifBlock } = require('../runtime');`);
  parts.push('');
  const componentNames: string[] = [];
  for (const decl of program.declarations) {
    if (decl.kind === 'StructDecl') continue;
    parts.push(generateComponent(decl));
    parts.push('');
    componentNames.push(decl.name);
  }
  parts.push(`module.exports = { ${componentNames.join(', ')} };`);
  return parts.join('\n');
}

function generateComponent(component: AST.ComponentDecl): string {
  const stateNames = new Set<string>();
  for (const member of component.members) {
    if (member.kind === 'StateDecl') stateNames.add(member.name);
  }

  const paramNames = component.params.map((p) => p.name);
  const signature = paramNames.length > 0 ? `{ ${paramNames.join(', ')} }` : '';

  const lines: string[] = [];
  lines.push(`function ${component.name}(${signature}) {`);

  const bodyLines: string[] = [];
  let viewExpr: string | null = null;

  for (const member of component.members) {
    switch (member.kind) {
      case 'StateDecl':
        bodyLines.push(`  const ${member.name} = state(${exprToJs(member.init, stateNames)});`);
        break;
      case 'ConstDecl':
        bodyLines.push(`  const ${member.name} = ${exprToJs(member.init, stateNames)};`);
        break;
      case 'FunctionDecl':
        bodyLines.push(indentBlock(generateFunction(member, stateNames), 1));
        break;
      case 'ViewBlockDecl':
        if (viewExpr !== null) unsupported('multiple view blocks');
        viewExpr = generateViewBlock(member, stateNames);
        break;
      case 'DerivedDecl':
        unsupported('derived<T>');
        break;
      case 'ProvideDecl':
        unsupported('provide<T>');
        break;
      case 'InjectDecl':
        unsupported('inject<T>');
        break;
      case 'OnMountDecl':
        unsupported('on_mount');
        break;
      case 'OnChangeDecl':
        unsupported('on_change');
        break;
      case 'StyleBlockDecl':
        unsupported('style block');
        break;
      default:
        unsupported((member as { kind: string }).kind);
    }
  }

  if (viewExpr === null) unsupported('component without a view block');

  lines.push(...bodyLines);
  lines.push(`  return ${viewExpr};`);
  lines.push('}');
  return lines.join('\n');
}

function generateFunction(fn: AST.FunctionDecl, stateNames: Set<string>): string {
  const params = fn.params.map((p) => p.name).join(', ');
  const asyncKeyword = fn.isAsync ? 'async ' : '';
  const lines: string[] = [];
  lines.push(`${asyncKeyword}function ${fn.name}(${params}) {`);
  for (const stmt of fn.body) {
    lines.push(indentBlock(stmtToJs(stmt, stateNames), 1));
  }
  lines.push('}');
  return lines.join('\n');
}

function stmtToJs(stmt: AST.Stmt, stateNames: Set<string>): string {
  switch (stmt.kind) {
    case 'VarDecl':
      return `let ${stmt.name} = ${exprToJs(stmt.init, stateNames)};`;
    case 'Assignment':
      return assignmentToJs(stmt, stateNames);
    case 'PostfixStmt':
      return postfixToJs(stmt, stateNames);
    case 'ExprStatement':
      return `${exprToJs(stmt.expr, stateNames)};`;
    case 'If': {
      const lines: string[] = [];
      lines.push(`if (${exprToJs(stmt.test, stateNames)}) {`);
      for (const s of stmt.consequent) lines.push(indentBlock(stmtToJs(s, stateNames), 1));
      lines.push('}');
      if (stmt.alternate) {
        lines.push('else {');
        for (const s of stmt.alternate) lines.push(indentBlock(stmtToJs(s, stateNames), 1));
        lines.push('}');
      }
      return lines.join('\n');
    }
    case 'For': {
      const lines: string[] = [];
      lines.push(`for (const ${stmt.itemName} of ${exprToJs(stmt.iterable, stateNames)}) {`);
      for (const s of stmt.body) lines.push(indentBlock(stmtToJs(s, stateNames), 1));
      lines.push('}');
      return lines.join('\n');
    }
    case 'Return':
      return stmt.value ? `return ${exprToJs(stmt.value, stateNames)};` : 'return;';
    default:
      unsupported((stmt as { kind: string }).kind);
  }
}

function assignmentToJs(stmt: Extract<AST.Stmt, { kind: 'Assignment' }>, stateNames: Set<string>): string {
  if (stmt.target.kind !== 'Identifier') {
    unsupported('assignment to non-identifier targets');
  }
  const name = stmt.target.name;
  const valueJs = exprToJs(stmt.value, stateNames);
  if (!stateNames.has(name)) {
    return `${name} ${stmt.op} ${valueJs};`;
  }
  if (stmt.op === '=') {
    return `${name}.set(${valueJs});`;
  }
  const binOp = stmt.op.slice(0, -1);
  return `${name}.set(${name}.get() ${binOp} ${valueJs});`;
}

function postfixToJs(stmt: Extract<AST.Stmt, { kind: 'PostfixStmt' }>, stateNames: Set<string>): string {
  if (stmt.target.kind !== 'Identifier') {
    unsupported('postfix on non-identifier targets');
  }
  const name = stmt.target.name;
  const delta = stmt.op === '++' ? '+ 1' : '- 1';
  if (!stateNames.has(name)) {
    return `${name}${stmt.op};`;
  }
  return `${name}.set(${name}.get() ${delta});`;
}

function exprToJs(expr: AST.Expr, stateNames: Set<string>): string {
  switch (expr.kind) {
    case 'IntLiteral':
    case 'FloatLiteral':
      return String(expr.value);
    case 'StringLiteral':
      return JSON.stringify(expr.value);
    case 'BoolLiteral':
      return expr.value ? 'true' : 'false';
    case 'NullLiteral':
      return 'null';
    case 'Identifier':
      return stateNames.has(expr.name) ? `${expr.name}.get()` : expr.name;
    case 'StructLiteral': {
      const fields = expr.fields.map((f) => `${f.name}: ${exprToJs(f.value, stateNames)}`);
      return `{ ${fields.join(', ')} }`;
    }
    case 'ArrayLiteral':
      return `[${expr.elements.map((e) => exprToJs(e, stateNames)).join(', ')}]`;
    case 'Unary': {
      const operand = exprToJs(expr.operand, stateNames);
      if (expr.op === 'await') return `await ${operand}`;
      return `${expr.op}${operand}`;
    }
    case 'Binary':
      return `(${exprToJs(expr.left, stateNames)} ${expr.op} ${exprToJs(expr.right, stateNames)})`;
    case 'Ternary':
      return `(${exprToJs(expr.test, stateNames)} ? ${exprToJs(expr.consequent, stateNames)} : ${exprToJs(expr.alternate, stateNames)})`;
    case 'Call':
      return `${exprToJs(expr.callee, stateNames)}(${expr.args.map((a) => exprToJs(a, stateNames)).join(', ')})`;
    case 'Member':
      return `${exprToJs(expr.object, stateNames)}.${expr.property}`;
    case 'Index':
      return `${exprToJs(expr.object, stateNames)}[${exprToJs(expr.index, stateNames)}]`;
    case 'Postfix':
      unsupported('postfix expressions outside statement position');
    default:
      unsupported((expr as { kind: string }).kind);
  }
}

function generateViewBlock(view: AST.ViewBlockDecl, stateNames: Set<string>): string {
  if (view.nodes.length !== 1) {
    unsupported('view block without exactly one root node');
  }
  return templateNodeToJs(view.nodes[0], stateNames);
}

function templateNodeToJs(node: AST.TemplateNode, stateNames: Set<string>): string {
  switch (node.kind) {
    case 'Element':
      return elementToJs(node, stateNames);
    case 'TextLiteral':
      return JSON.stringify(node.value);
    case 'TextInterpolation':
      return `text(() => ${exprToJs(node.expr, stateNames)})`;
    case 'TemplateIf': {
      if (node.consequent.length !== 1) unsupported('if-block with multiple root nodes');
      const trueJs = templateNodeToJs(node.consequent[0], stateNames);
      if (!node.alternate) {
        return `ifBlock(() => ${exprToJs(node.test, stateNames)}, () => ${trueJs})`;
      }
      if (node.alternate.length !== 1) unsupported('else-block with multiple root nodes');
      const falseJs = templateNodeToJs(node.alternate[0], stateNames);
      return `ifBlock(() => ${exprToJs(node.test, stateNames)}, () => ${trueJs}, () => ${falseJs})`;
    }
    case 'TemplateFor':
      unsupported('for-loops in view blocks');
    default:
      unsupported((node as { kind: string }).kind);
  }
}

function elementToJs(node: Extract<AST.TemplateNode, { kind: 'Element' }>, stateNames: Set<string>): string {
  const attrParts: string[] = [];
  for (const attr of node.attributes) {
    const value = attr.isExpr ? exprToJs(attr.exprValue as AST.Expr, stateNames) : JSON.stringify(attr.stringValue);
    attrParts.push(`${attr.name}: ${value}`);
  }
  const attrsJs = `{ ${attrParts.join(', ')} }`;
  const childrenJs = node.children.map((c) => templateNodeToJs(c, stateNames));
  const args = [`'${node.tag}'`, attrsJs, ...childrenJs];
  return `h(${args.join(', ')})`;
}
