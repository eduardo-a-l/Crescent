import * as AST from './ast';

export type FunctionEffects = Map<string, Set<string>>;

export type NullifyMode = 'fallthrough' | 'full';

interface Visitor {
  assign(name: string): void;
  call(name: string): void;
}

export function blockDefinitelyExits(stmts: AST.Stmt[]): boolean {
  for (const stmt of stmts) {
    if (stmt.kind === 'Return' || stmt.kind === 'Break' || stmt.kind === 'Continue') return true;
    if (stmt.kind === 'If' && stmt.alternate && blockDefinitelyExits(stmt.consequent) && blockDefinitelyExits(stmt.alternate)) return true;
  }
  return false;
}

function isProvablyNonNull(expr: AST.Expr): boolean {
  switch (expr.kind) {
    case 'IntLiteral':
    case 'FloatLiteral':
    case 'StringLiteral':
    case 'BoolLiteral':
    case 'StructLiteral':
    case 'ArrayLiteral':
    case 'TemplateString':
      return true;
    default:
      return false;
  }
}

function visitExpr(expr: AST.Expr, v: Visitor): void {
  switch (expr.kind) {
    case 'StructLiteral':
      for (const f of expr.fields) visitExpr(f.value, v);
      return;
    case 'ArrayLiteral':
      for (const e of expr.elements) visitExpr(e, v);
      return;
    case 'Unary':
      visitExpr(expr.operand, v);
      return;
    case 'Binary':
      visitExpr(expr.left, v);
      visitExpr(expr.right, v);
      return;
    case 'Ternary':
      visitExpr(expr.test, v);
      visitExpr(expr.consequent, v);
      visitExpr(expr.alternate, v);
      return;
    case 'Call':
      if (expr.callee.kind === 'Identifier') v.call(expr.callee.name);
      else visitExpr(expr.callee, v);
      for (const a of expr.args) visitExpr(a, v);
      return;
    case 'Member':
      visitExpr(expr.object, v);
      return;
    case 'Index':
      visitExpr(expr.object, v);
      visitExpr(expr.index, v);
      return;
    case 'Postfix':
      visitExpr(expr.operand, v);
      return;
    case 'TemplateString':
      for (const p of expr.parts) {
        if (p.kind === 'expr') visitExpr(p.expr, v);
      }
      return;
    default:
      return;
  }
}

function visitStmts(stmts: AST.Stmt[], mode: NullifyMode, v: Visitor): void {
  for (const stmt of stmts) visitStmt(stmt, mode, v);
}

function visitStmt(stmt: AST.Stmt, mode: NullifyMode, v: Visitor): void {
  switch (stmt.kind) {
    case 'VarDecl':
    case 'StructDestructure':
      visitExpr(stmt.init, v);
      return;
    case 'Assignment':
      visitExpr(stmt.value, v);
      visitExpr(stmt.target, v);
      if (stmt.op === '=' && stmt.target.kind === 'Identifier' && !isProvablyNonNull(stmt.value)) {
        v.assign(stmt.target.name);
      }
      return;
    case 'PostfixStmt':
      visitExpr(stmt.target, v);
      return;
    case 'ExprStatement':
      visitExpr(stmt.expr, v);
      return;
    case 'If':
      visitExpr(stmt.test, v);
      if (mode === 'full' || !blockDefinitelyExits(stmt.consequent)) visitStmts(stmt.consequent, mode, v);
      if (stmt.alternate && (mode === 'full' || !blockDefinitelyExits(stmt.alternate))) visitStmts(stmt.alternate, mode, v);
      return;
    case 'For':
      visitExpr(stmt.iterable, v);
      visitStmts(stmt.body, 'full', v);
      return;
    case 'ForC':
      visitStmt(stmt.init, 'full', v);
      visitExpr(stmt.test, v);
      if (stmt.update) visitStmt(stmt.update, 'full', v);
      visitStmts(stmt.body, 'full', v);
      return;
    case 'While':
      visitExpr(stmt.test, v);
      visitStmts(stmt.body, 'full', v);
      return;
    case 'DoWhile':
      visitStmts(stmt.body, 'full', v);
      visitExpr(stmt.test, v);
      return;
    case 'Return':
      if (stmt.value) visitExpr(stmt.value, v);
      return;
    case 'Break':
    case 'Continue':
      return;
  }
}

function declaredNames(stmts: AST.Stmt[], out: Set<string>): void {
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case 'VarDecl':
        out.add(stmt.name);
        break;
      case 'StructDestructure':
        for (const f of stmt.fields) out.add(f);
        break;
      case 'If':
        declaredNames(stmt.consequent, out);
        if (stmt.alternate) declaredNames(stmt.alternate, out);
        break;
      case 'For':
        out.add(stmt.itemName);
        declaredNames(stmt.body, out);
        break;
      case 'ForC':
        declaredNames([stmt.init], out);
        declaredNames(stmt.body, out);
        break;
      case 'While':
      case 'DoWhile':
        declaredNames(stmt.body, out);
        break;
    }
  }
}

export function computeFunctionEffects(functions: Map<string, AST.FunctionDecl>): FunctionEffects {
  const effects: FunctionEffects = new Map();
  const callees = new Map<string, Set<string>>();

  for (const [name, fn] of functions) {
    const direct = new Set<string>();
    const called = new Set<string>();
    visitStmts(fn.body, 'full', {
      assign: (n) => direct.add(n),
      call: (n) => called.add(n),
    });
    const locals = new Set<string>(fn.params.map((p) => p.name));
    declaredNames(fn.body, locals);
    for (const l of locals) direct.delete(l);
    effects.set(name, direct);
    callees.set(name, called);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, called] of callees) {
      const own = effects.get(name)!;
      for (const callee of called) {
        const theirs = effects.get(callee);
        if (!theirs) continue;
        for (const n of theirs) {
          if (!own.has(n)) {
            own.add(n);
            changed = true;
          }
        }
      }
    }
  }

  return effects;
}

export function nullifiedByStmts(stmts: AST.Stmt[], effects: FunctionEffects, mode: NullifyMode): Set<string> {
  const out = new Set<string>();
  visitStmts(stmts, mode, {
    assign: (n) => out.add(n),
    call: (n) => {
      const e = effects.get(n);
      if (e) for (const x of e) out.add(x);
    },
  });
  return out;
}

export function nullifiedByExpr(expr: AST.Expr, effects: FunctionEffects): Set<string> {
  const out = new Set<string>();
  visitExpr(expr, {
    assign: (n) => out.add(n),
    call: (n) => {
      const e = effects.get(n);
      if (e) for (const x of e) out.add(x);
    },
  });
  return out;
}
