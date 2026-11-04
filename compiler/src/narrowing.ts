import * as AST from './ast';

export interface FunctionEffect {
  nulls: Set<string>;
  writes: Set<string>;
  reads: Set<string>;
}

export type FunctionEffects = Map<string, FunctionEffect>;

export type DerivedDeps = ReadonlyMap<string, ReadonlySet<string>>;

export type NullifyMode = 'fallthrough' | 'full';

interface Visitor {
  assign(name: string): void;
  write(name: string): void;
  read(name: string): void;
  call(name: string): void;
  suspend(): void;
}

const NO_NAMES: ReadonlySet<string> = new Set();
const NO_DERIVED: DerivedDeps = new Map();

function rootName(expr: AST.Expr): string | null {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'Member':
    case 'Index':
      return rootName(expr.object);
    default:
      return null;
  }
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
    case 'Identifier':
      v.read(expr.name);
      return;
    case 'StructLiteral':
      for (const f of expr.fields) visitExpr(f.value, v);
      return;
    case 'ArrayLiteral':
      for (const e of expr.elements) visitExpr(e, v);
      return;
    case 'Unary':
      visitExpr(expr.operand, v);
      if (expr.op === 'await') v.suspend();
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
      if (expr.callee.kind === 'Identifier') {
        v.call(expr.callee.name);
      } else {
        visitExpr(expr.callee, v);
        if (expr.callee.kind === 'Member') {
          const root = rootName(expr.callee.object);
          if (root) v.write(root);
        }
      }
      for (const a of expr.args) visitExpr(a, v);
      return;
    case 'Member':
      visitExpr(expr.object, v);
      return;
    case 'Index':
      visitExpr(expr.object, v);
      visitExpr(expr.index, v);
      return;
    case 'Postfix': {
      visitExpr(expr.operand, v);
      const root = rootName(expr.operand);
      if (root) v.write(root);
      return;
    }
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
    case 'Assignment': {
      visitExpr(stmt.value, v);
      if (stmt.target.kind !== 'Identifier') visitExpr(stmt.target, v);
      const root = rootName(stmt.target);
      if (root) v.write(root);
      if (stmt.op === '=' && stmt.target.kind === 'Identifier' && !isProvablyNonNull(stmt.value)) {
        v.assign(stmt.target.name);
      }
      return;
    }
    case 'PostfixStmt': {
      if (stmt.target.kind !== 'Identifier') visitExpr(stmt.target, v);
      const root = rootName(stmt.target);
      if (root) v.write(root);
      return;
    }
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
    const effect: FunctionEffect = { nulls: new Set(), writes: new Set(), reads: new Set() };
    const called = new Set<string>();
    visitStmts(fn.body, 'full', {
      assign: (n) => effect.nulls.add(n),
      write: (n) => effect.writes.add(n),
      read: (n) => effect.reads.add(n),
      call: (n) => called.add(n),
      suspend: () => {},
    });
    const locals = new Set<string>(fn.params.map((p) => p.name));
    declaredNames(fn.body, locals);
    for (const l of locals) {
      effect.nulls.delete(l);
      effect.writes.delete(l);
      effect.reads.delete(l);
    }
    effects.set(name, effect);
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
        for (const key of ['nulls', 'writes', 'reads'] as const) {
          for (const n of theirs[key]) {
            if (!own[key].has(n)) {
              own[key].add(n);
              changed = true;
            }
          }
        }
      }
    }
  }

  return effects;
}

export function computeDerivedDeps(derived: { name: string; init: AST.Expr }[], effects: FunctionEffects): DerivedDeps {
  const deps = new Map<string, Set<string>>();
  for (const d of derived) {
    const own = new Set<string>();
    visitExpr(d.init, {
      assign: () => {},
      write: () => {},
      read: (n) => own.add(n),
      call: (n) => {
        const e = effects.get(n);
        if (e) for (const r of e.reads) own.add(r);
      },
      suspend: () => {},
    });
    deps.set(d.name, own);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const own of deps.values()) {
      for (const dep of Array.from(own)) {
        const inner = deps.get(dep);
        if (!inner) continue;
        for (const n of inner) {
          if (!own.has(n)) {
            own.add(n);
            changed = true;
          }
        }
      }
    }
  }

  return deps;
}

export function nullifiedByStmts(
  stmts: AST.Stmt[],
  effects: FunctionEffects,
  mode: NullifyMode,
  suspendNames: ReadonlySet<string> = NO_NAMES,
  derivedDeps: DerivedDeps = NO_DERIVED
): Set<string> {
  return collect((v) => visitStmts(stmts, mode, v), effects, suspendNames, derivedDeps);
}

export function nullifiedByExpr(
  expr: AST.Expr,
  effects: FunctionEffects,
  suspendNames: ReadonlySet<string> = NO_NAMES,
  derivedDeps: DerivedDeps = NO_DERIVED
): Set<string> {
  return collect((v) => visitExpr(expr, v), effects, suspendNames, derivedDeps);
}

function collect(
  run: (v: Visitor) => void,
  effects: FunctionEffects,
  suspendNames: ReadonlySet<string>,
  derivedDeps: DerivedDeps
): Set<string> {
  const out = new Set<string>();
  const writes = new Set<string>();
  run({
    assign: (n) => out.add(n),
    write: (n) => writes.add(n),
    read: () => {},
    call: (n) => {
      const e = effects.get(n);
      if (!e) return;
      for (const x of e.nulls) out.add(x);
      for (const x of e.writes) writes.add(x);
    },
    suspend: () => {
      for (const x of suspendNames) out.add(x);
    },
  });
  for (const [derived, deps] of derivedDeps) {
    if (out.has(derived)) continue;
    for (const w of writes) {
      if (deps.has(w)) {
        out.add(derived);
        break;
      }
    }
  }
  return out;
}
