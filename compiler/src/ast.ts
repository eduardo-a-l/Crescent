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
  | { kind: 'VarDecl'; type: CrescentType; name: string; init: Expr; line: number }
  | { kind: 'Assignment'; target: Expr; op: string; value: Expr; line: number }
  | { kind: 'PostfixStmt'; target: Expr; op: '++' | '--'; line: number }
  | { kind: 'ExprStatement'; expr: Expr; line: number }
  | { kind: 'If'; test: Expr; consequent: Stmt[]; alternate?: Stmt[]; line: number }
  | { kind: 'For'; itemType: CrescentType; itemName: string; iterable: Expr; body: Stmt[]; line: number }
  | { kind: 'Return'; value?: Expr; line: number };

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
      line: number;
    }
  | { kind: 'TemplateIf'; test: Expr; consequent: TemplateNode[]; alternate?: TemplateNode[]; line: number }
  | {
      kind: 'TemplateFor';
      itemType: CrescentType;
      itemName: string;
      iterable: Expr;
      key?: Expr;
      body: TemplateNode[];
      line: number;
    }
  | { kind: 'TextInterpolation'; expr: Expr; line: number }
  | { kind: 'TextLiteral'; value: string; line: number };

export type StyleValuePart = { kind: 'raw'; text: string } | { kind: 'expr'; expr: Expr };

export interface StyleDeclaration {
  property: string;
  parts: StyleValuePart[];
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
  line: number;
}

export interface DerivedDecl {
  kind: 'DerivedDecl';
  type: CrescentType;
  name: string;
  init: Expr;
  line: number;
}

export interface ProvideDecl {
  kind: 'ProvideDecl';
  type: CrescentType;
  name: string;
  init: Expr;
  line: number;
}

export interface InjectDecl {
  kind: 'InjectDecl';
  type: CrescentType;
  name: string;
  line: number;
}

export interface ConstDecl {
  kind: 'ConstDecl';
  type: CrescentType;
  name: string;
  init: Expr;
  line: number;
}

export interface FunctionDecl {
  kind: 'FunctionDecl';
  isAsync: boolean;
  returnType: CrescentType | 'void';
  name: string;
  params: Param[];
  body: Stmt[];
  line: number;
}

export interface OnMountDecl {
  kind: 'OnMountDecl';
  body: Stmt[];
  line: number;
}

export interface OnChangeDecl {
  kind: 'OnChangeDecl';
  watched: string[];
  body: Stmt[];
  line: number;
}

export interface ViewBlockDecl {
  kind: 'ViewBlockDecl';
  nodes: TemplateNode[];
  line: number;
}

export interface StyleBlockDecl {
  kind: 'StyleBlockDecl';
  rules: StyleRule[];
  line: number;
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
  line: number;
}

export interface StructField {
  type: CrescentType;
  name: string;
}

export interface StructDecl {
  kind: 'StructDecl';
  name: string;
  fields: StructField[];
  line: number;
}

export interface ImportItem {
  name: string;
  alias?: string;
}

export interface UseDecl {
  kind: 'UseDecl';
  pathSegments: string[];
  items: ImportItem[];
  line: number;
}

export type TopLevelDecl = ComponentDecl | StructDecl | UseDecl;

export interface Program {
  kind: 'Program';
  declarations: TopLevelDecl[];
}
