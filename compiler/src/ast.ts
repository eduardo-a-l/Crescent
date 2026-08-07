export type CrescentType =
  | { kind: 'PrimitiveType'; name: 'int' | 'float' | 'string' | 'bool' }
  | { kind: 'NamedType'; name: string }
  | { kind: 'GenericType'; name: string; typeArg: CrescentType }
  | { kind: 'NullableType'; inner: CrescentType }
  | { kind: 'ArrayType'; inner: CrescentType };

export type Expr =
  | { kind: 'IntLiteral'; value: number }
  | { kind: 'FloatLiteral'; value: number }
  | { kind: 'StringLiteral'; value: string }
  | { kind: 'BoolLiteral'; value: boolean }
  | { kind: 'NullLiteral' }
  | { kind: 'Identifier'; name: string }
  | { kind: 'StructLiteral'; typeName: string; fields: { name: string; value: Expr }[] }
  | { kind: 'ArrayLiteral'; elements: Expr[] }
  | { kind: 'Unary'; op: '!' | '-' | 'await'; operand: Expr }
  | { kind: 'Binary'; op: string; left: Expr; right: Expr }
  | { kind: 'Ternary'; test: Expr; consequent: Expr; alternate: Expr }
  | { kind: 'Call'; callee: Expr; args: Expr[] }
  | { kind: 'Member'; object: Expr; property: string }
  | { kind: 'Index'; object: Expr; index: Expr }
  | { kind: 'Postfix'; op: '++' | '--'; operand: Expr };

export type Stmt =
  | { kind: 'VarDecl'; type: CrescentType; name: string; init: Expr }
  | { kind: 'Assignment'; target: Expr; op: string; value: Expr }
  | { kind: 'PostfixStmt'; target: Expr; op: '++' | '--' }
  | { kind: 'ExprStatement'; expr: Expr }
  | { kind: 'If'; test: Expr; consequent: Stmt[]; alternate?: Stmt[] }
  | { kind: 'For'; itemType: CrescentType; itemName: string; iterable: Expr; body: Stmt[] }
  | { kind: 'Return'; value?: Expr };

export interface Param {
  type: CrescentType;
  name: string;
}

export type Attribute = {
  name: string;
  isExpr: boolean;
  stringValue?: string;
  exprValue?: Expr;
};

export type TemplateNode =
  | {
      kind: 'Element';
      tag: string;
      isComponent: boolean;
      attributes: Attribute[];
      children: TemplateNode[];
      selfClosing: boolean;
    }
  | { kind: 'TemplateIf'; test: Expr; consequent: TemplateNode[]; alternate?: TemplateNode[] }
  | {
      kind: 'TemplateFor';
      itemType: CrescentType;
      itemName: string;
      iterable: Expr;
      key?: Expr;
      body: TemplateNode[];
    }
  | { kind: 'TextInterpolation'; expr: Expr }
  | { kind: 'TextLiteral'; value: string };

export interface StyleDeclaration {
  property: string;
  isExpr: boolean;
  rawValue?: string;
  exprValue?: Expr;
}

export interface StyleRule {
  selector: string;
  declarations: StyleDeclaration[];
}

export interface StateDecl {
  kind: 'StateDecl';
  type: CrescentType;
  name: string;
  init: Expr;
}

export interface DerivedDecl {
  kind: 'DerivedDecl';
  type: CrescentType;
  name: string;
  init: Expr;
}

export interface ProvideDecl {
  kind: 'ProvideDecl';
  type: CrescentType;
  name: string;
  init: Expr;
}

export interface InjectDecl {
  kind: 'InjectDecl';
  type: CrescentType;
  name: string;
}

export interface ConstDecl {
  kind: 'ConstDecl';
  type: CrescentType;
  name: string;
  init: Expr;
}

export interface FunctionDecl {
  kind: 'FunctionDecl';
  isAsync: boolean;
  returnType: CrescentType | 'void';
  name: string;
  params: Param[];
  body: Stmt[];
}

export interface OnMountDecl {
  kind: 'OnMountDecl';
  body: Stmt[];
}

export interface OnChangeDecl {
  kind: 'OnChangeDecl';
  watched: string[];
  body: Stmt[];
}

export interface ViewBlockDecl {
  kind: 'ViewBlockDecl';
  nodes: TemplateNode[];
}

export interface StyleBlockDecl {
  kind: 'StyleBlockDecl';
  rules: StyleRule[];
}

export type ComponentMember =
  | StateDecl
  | DerivedDecl
  | ProvideDecl
  | InjectDecl
  | ConstDecl
  | FunctionDecl
  | OnMountDecl
  | OnChangeDecl
  | ViewBlockDecl
  | StyleBlockDecl;

export interface ComponentDecl {
  kind: 'ComponentDecl';
  name: string;
  params: Param[];
  members: ComponentMember[];
}

export interface StructField {
  type: CrescentType;
  name: string;
}

export interface StructDecl {
  kind: 'StructDecl';
  name: string;
  fields: StructField[];
}

export type TopLevelDecl = ComponentDecl | StructDecl;

export interface Program {
  kind: 'Program';
  declarations: TopLevelDecl[];
}
