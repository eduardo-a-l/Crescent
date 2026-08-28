import * as AST from './ast';

export class CodegenError extends Error {}

function unsupported(feature: string): never {
  throw new CodegenError(`Codegen: '${feature}' is not yet supported in v0.1`);
}

function compileError(message: string): never {
  throw new CodegenError(`Codegen: ${message}`);
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
  parts.push(
    `const { state, effect, h, text, ifBlock, forEach, injectStyle, slot, derived, watch } = require('../runtime');`
  );
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

function scopeAttrFor(componentName: string): string {
  return `data-crs-${componentName.toLowerCase()}`;
}

function generateComponent(component: AST.ComponentDecl): string {
  const stateNames = new Set<string>();
  const derivedNames = new Set<string>();
  for (const member of component.members) {
    if (member.kind === 'StateDecl') stateNames.add(member.name);
    if (member.kind === 'DerivedDecl') {
      stateNames.add(member.name);
      derivedNames.add(member.name);
    }
  }

  const styleMember = component.members.find(
    (m): m is AST.StyleBlockDecl => m.kind === 'StyleBlockDecl'
  );
  const scopeAttr = styleMember ? scopeAttrFor(component.name) : null;

  const paramNames = component.params.map((p) => p.name);
  const destructureNames = [...paramNames, 'children = []'];
  const signature = `{ ${destructureNames.join(', ')} } = {}`;

  const lines: string[] = [];
  lines.push(`function ${component.name}(${signature}) {`);

  const bodyLines: string[] = [];
  const onMountBodies: AST.Stmt[][] = [];
  let viewExpr: string | null = null;

  for (const member of component.members) {
    switch (member.kind) {
      case 'StateDecl':
        bodyLines.push(`  const ${member.name} = state(${exprToJs(member.init, stateNames)});`);
        break;
      case 'DerivedDecl':
        bodyLines.push(`  const ${member.name} = derived(() => ${exprToJs(member.init, stateNames)});`);
        break;
      case 'ConstDecl':
        bodyLines.push(`  const ${member.name} = ${exprToJs(member.init, stateNames)};`);
        break;
      case 'FunctionDecl':
        bodyLines.push(indentBlock(generateFunction(member, stateNames, derivedNames), 1));
        break;
      case 'ViewBlockDecl':
        if (viewExpr !== null) unsupported('multiple view blocks');
        viewExpr = generateViewBlock(member, stateNames, scopeAttr);
        break;
      case 'StyleBlockDecl':
        break;
      case 'OnMountDecl':
        onMountBodies.push(member.body);
        break;
      case 'OnChangeDecl': {
        const readDeps = member.watched.map((name) => `${name}.get();`).join(' ');
        bodyLines.push(`  watch(() => { ${readDeps} }, () => {`);
        for (const s of member.body) bodyLines.push(indentBlock(stmtToJs(s, stateNames, derivedNames), 2));
        bodyLines.push('  });');
        break;
      }
      case 'ProvideDecl':
        unsupported('provide<T>');
        break;
      case 'InjectDecl':
        unsupported('inject<T>');
        break;
      default:
        unsupported((member as { kind: string }).kind);
    }
  }

  if (viewExpr === null) unsupported('component without a view block');

  lines.push(...bodyLines);

  if (styleMember || onMountBodies.length > 0) {
    lines.push(`  const __root = ${viewExpr};`);
    if (styleMember && scopeAttr) {
      const { css, varAssignments } = generateStyleBlock(styleMember, scopeAttr, stateNames);
      if (varAssignments.length > 0) {
        lines.push('  effect(() => {');
        for (const va of varAssignments) {
          lines.push(`    __root.style.setProperty('${va.varName}', ${va.exprJs});`);
        }
        lines.push('  });');
      }
      lines.push(`  injectStyle(${JSON.stringify(css)}, ${JSON.stringify(scopeAttr)});`);
    }
    for (const body of onMountBodies) {
      for (const s of body) lines.push(indentBlock(stmtToJs(s, stateNames, derivedNames), 1));
    }
    lines.push('  return __root;');
  } else {
    lines.push(`  return ${viewExpr};`);
  }

  lines.push('}');
  return lines.join('\n');
}

function scopeSelector(selector: string, attr: string): string {
  const match = selector.match(/^[^\s:>+~]+/);
  if (!match) return `[${attr}]${selector}`;
  const head = match[0];
  const rest = selector.slice(head.length);
  return `${head}[${attr}]${rest}`;
}

function escapeForTemplateLiteral(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function styleValuePartsToJs(parts: AST.StyleValuePart[], stateNames: Set<string>): string {
  const pieces = parts.map((p) =>
    p.kind === 'raw' ? escapeForTemplateLiteral(p.text) : '${' + exprToJs(p.expr, stateNames) + '}'
  );
  return '`' + pieces.join('') + '`';
}

function generateStyleBlock(
  style: AST.StyleBlockDecl,
  scopeAttr: string,
  stateNames: Set<string>
): { css: string; varAssignments: { varName: string; exprJs: string }[] } {
  let varCounter = 0;
  const varAssignments: { varName: string; exprJs: string }[] = [];
  const ruleParts: string[] = [];

  for (const rule of style.rules) {
    const scopedSelector = rule.selector
      .split(',')
      .map((s) => scopeSelector(s.trim(), scopeAttr))
      .join(', ');
    const declLines: string[] = [];
    for (const decl of rule.declarations) {
      const isPureRaw = decl.parts.every((p) => p.kind === 'raw');
      if (isPureRaw) {
        const text = decl.parts.map((p) => (p as { kind: 'raw'; text: string }).text).join('');
        declLines.push(`  ${decl.property}: ${text};`);
      } else {
        const varName = `--crs-${varCounter}`;
        varCounter += 1;
        varAssignments.push({ varName, exprJs: styleValuePartsToJs(decl.parts, stateNames) });
        declLines.push(`  ${decl.property}: var(${varName});`);
      }
    }
    ruleParts.push(`${scopedSelector} {\n${declLines.join('\n')}\n}`);
  }

  return { css: ruleParts.join('\n\n'), varAssignments };
}

function generateFunction(fn: AST.FunctionDecl, stateNames: Set<string>, derivedNames: Set<string>): string {
  const params = fn.params.map((p) => p.name).join(', ');
  const asyncKeyword = fn.isAsync ? 'async ' : '';
  const lines: string[] = [];
  lines.push(`${asyncKeyword}function ${fn.name}(${params}) {`);
  for (const stmt of fn.body) {
    lines.push(indentBlock(stmtToJs(stmt, stateNames, derivedNames), 1));
  }
  lines.push('}');
  return lines.join('\n');
}

function stmtToJs(stmt: AST.Stmt, stateNames: Set<string>, derivedNames: Set<string>): string {
  switch (stmt.kind) {
    case 'VarDecl':
      return `let ${stmt.name} = ${exprToJs(stmt.init, stateNames)};`;
    case 'Assignment':
      return assignmentToJs(stmt, stateNames, derivedNames);
    case 'PostfixStmt':
      return postfixToJs(stmt, stateNames, derivedNames);
    case 'ExprStatement':
      return `${exprToJs(stmt.expr, stateNames)};`;
    case 'If': {
      const lines: string[] = [];
      lines.push(`if (${exprToJs(stmt.test, stateNames)}) {`);
      for (const s of stmt.consequent) lines.push(indentBlock(stmtToJs(s, stateNames, derivedNames), 1));
      lines.push('}');
      if (stmt.alternate) {
        lines.push('else {');
        for (const s of stmt.alternate) lines.push(indentBlock(stmtToJs(s, stateNames, derivedNames), 1));
        lines.push('}');
      }
      return lines.join('\n');
    }
    case 'For': {
      const lines: string[] = [];
      lines.push(`for (const ${stmt.itemName} of ${exprToJs(stmt.iterable, stateNames)}) {`);
      for (const s of stmt.body) lines.push(indentBlock(stmtToJs(s, stateNames, derivedNames), 1));
      lines.push('}');
      return lines.join('\n');
    }
    case 'Return':
      return stmt.value ? `return ${exprToJs(stmt.value, stateNames)};` : 'return;';
    default:
      unsupported((stmt as { kind: string }).kind);
  }
}

function findStateRoot(
  expr: AST.Expr,
  stateNames: Set<string>
): { name: string; immediateKind: 'Member' | 'Index' } | null {
  if (expr.kind === 'Member') {
    if (expr.object.kind === 'Identifier' && stateNames.has(expr.object.name)) {
      return { name: expr.object.name, immediateKind: 'Member' };
    }
    return findStateRoot(expr.object, stateNames);
  }
  if (expr.kind === 'Index') {
    if (expr.object.kind === 'Identifier' && stateNames.has(expr.object.name)) {
      return { name: expr.object.name, immediateKind: 'Index' };
    }
    return findStateRoot(expr.object, stateNames);
  }
  return null;
}

function assignmentToJs(
  stmt: Extract<AST.Stmt, { kind: 'Assignment' }>,
  stateNames: Set<string>,
  derivedNames: Set<string>
): string {
  if (stmt.target.kind === 'Identifier') {
    const name = stmt.target.name;
    if (derivedNames.has(name)) {
      compileError(`cannot assign to derived '${name}'; reassign one of its dependencies instead`);
    }
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

  const root = findStateRoot(stmt.target, stateNames);
  const targetJs = exprToJs(stmt.target, stateNames);
  const valueJs = exprToJs(stmt.value, stateNames);

  if (!root) {
    return `${targetJs} ${stmt.op} ${valueJs};`;
  }
  if (root.immediateKind === 'Member') {
    compileError(
      `direct property write on state '${root.name}' is forbidden at compile time; reassign the whole state instead (see design doc §13.2)`
    );
  }

  return [`${targetJs} ${stmt.op} ${valueJs};`, `${root.name}.set(${root.name}.get());`].join('\n');
}

function postfixToJs(
  stmt: Extract<AST.Stmt, { kind: 'PostfixStmt' }>,
  stateNames: Set<string>,
  derivedNames: Set<string>
): string {
  if (stmt.target.kind === 'Identifier') {
    const name = stmt.target.name;
    if (derivedNames.has(name)) {
      compileError(`cannot assign to derived '${name}'; reassign one of its dependencies instead`);
    }
    const delta = stmt.op === '++' ? '+ 1' : '- 1';
    if (!stateNames.has(name)) {
      return `${name}${stmt.op};`;
    }
    return `${name}.set(${name}.get() ${delta});`;
  }

  const root = findStateRoot(stmt.target, stateNames);
  const targetJs = exprToJs(stmt.target, stateNames);

  if (!root) {
    return `${targetJs}${stmt.op};`;
  }
  if (root.immediateKind === 'Member') {
    compileError(
      `direct property write on state '${root.name}' is forbidden at compile time; reassign the whole state instead (see design doc §13.2)`
    );
  }

  return [`${targetJs}${stmt.op};`, `${root.name}.set(${root.name}.get());`].join('\n');
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

function generateViewBlock(
  view: AST.ViewBlockDecl,
  stateNames: Set<string>,
  scopeAttr: string | null
): string {
  if (view.nodes.length !== 1) {
    unsupported('view block without exactly one root node');
  }
  return templateNodeToJs(view.nodes[0], stateNames, scopeAttr);
}

function templateNodeToJs(node: AST.TemplateNode, stateNames: Set<string>, scopeAttr: string | null): string {
  switch (node.kind) {
    case 'Element':
      if (node.tag === 'slot') return 'slot(children)';
      if (node.isComponent) return componentCallToJs(node, stateNames, scopeAttr);
      return elementToJs(node, stateNames, scopeAttr);
    case 'TextLiteral':
      return JSON.stringify(node.value);
    case 'TextInterpolation':
      return `text(() => ${exprToJs(node.expr, stateNames)})`;
    case 'TemplateIf': {
      if (node.consequent.length !== 1) unsupported('if-block with multiple root nodes');
      const trueJs = templateNodeToJs(node.consequent[0], stateNames, scopeAttr);
      if (!node.alternate) {
        return `ifBlock(() => ${exprToJs(node.test, stateNames)}, () => ${trueJs})`;
      }
      if (node.alternate.length !== 1) unsupported('else-block with multiple root nodes');
      const falseJs = templateNodeToJs(node.alternate[0], stateNames, scopeAttr);
      return `ifBlock(() => ${exprToJs(node.test, stateNames)}, () => ${trueJs}, () => ${falseJs})`;
    }
    case 'TemplateFor': {
      if (node.body.length !== 1) unsupported('for-loop with multiple root nodes');
      const itemJs = templateNodeToJs(node.body[0], stateNames, scopeAttr);
      const iterableJs = exprToJs(node.iterable, stateNames);
      const args = [`() => ${iterableJs}`, `(${node.itemName}) => ${itemJs}`];
      if (node.key) args.push(`(${node.itemName}) => ${exprToJs(node.key, stateNames)}`);
      return `forEach(${args.join(', ')})`;
    }
    default:
      unsupported((node as { kind: string }).kind);
  }
}

function componentCallToJs(
  node: Extract<AST.TemplateNode, { kind: 'Element' }>,
  stateNames: Set<string>,
  scopeAttr: string | null
): string {
  const propParts: string[] = [];
  for (const attr of node.attributes) {
    const value = attr.isExpr ? exprToJs(attr.exprValue as AST.Expr, stateNames) : JSON.stringify(attr.stringValue);
    propParts.push(`${attr.name}: ${value}`);
  }
  if (node.children.length > 0) {
    const childrenJs = node.children.map((c) => templateNodeToJs(c, stateNames, scopeAttr));
    propParts.push(`children: [${childrenJs.join(', ')}]`);
  }
  return `${node.tag}({ ${propParts.join(', ')} })`;
}

function elementToJs(
  node: Extract<AST.TemplateNode, { kind: 'Element' }>,
  stateNames: Set<string>,
  scopeAttr: string | null
): string {
  const attrParts: string[] = [];
  for (const attr of node.attributes) {
    const value = attr.isExpr ? exprToJs(attr.exprValue as AST.Expr, stateNames) : JSON.stringify(attr.stringValue);
    attrParts.push(`${attr.name}: ${value}`);
  }
  if (scopeAttr) {
    attrParts.push(`${JSON.stringify(scopeAttr)}: ''`);
  }
  const attrsJs = `{ ${attrParts.join(', ')} }`;
  const childrenJs = node.children.map((c) => templateNodeToJs(c, stateNames, scopeAttr));
  const args = [`'${node.tag}'`, attrsJs, ...childrenJs];
  return `h(${args.join(', ')})`;
}
