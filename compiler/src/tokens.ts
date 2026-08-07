export type TokenType =
  | 'COMPONENT' | 'STATE' | 'DERIVED' | 'PROVIDE' | 'INJECT' | 'CONST' | 'STRUCT'
  | 'VIEW' | 'STYLE' | 'IF' | 'ELSE' | 'FOR' | 'IN' | 'KEY' | 'RETURN'
  | 'ASYNC' | 'AWAIT' | 'VOID' | 'TRUE' | 'FALSE' | 'NULL'
  | 'ON_MOUNT' | 'ON_CHANGE' | 'SLOT'
  | 'INT_TYPE' | 'FLOAT_TYPE' | 'STRING_TYPE' | 'BOOL_TYPE'
  | 'IDENTIFIER' | 'INT_LITERAL' | 'FLOAT_LITERAL' | 'STRING_LITERAL'
  | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET'
  | 'LT' | 'GT' | 'LE' | 'GE' | 'EQ' | 'NEQ'
  | 'ASSIGN' | 'PLUS_ASSIGN' | 'MINUS_ASSIGN' | 'STAR_ASSIGN' | 'SLASH_ASSIGN'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT'
  | 'PLUS_PLUS' | 'MINUS_MINUS'
  | 'BANG' | 'AND_AND' | 'OR_OR'
  | 'QUESTION' | 'COLON' | 'SEMI' | 'COMMA' | 'DOT'
  | 'SLASH_GT'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  start: number;
}

export const KEYWORDS: Record<string, TokenType> = {
  component: 'COMPONENT',
  state: 'STATE',
  derived: 'DERIVED',
  provide: 'PROVIDE',
  inject: 'INJECT',
  const: 'CONST',
  struct: 'STRUCT',
  view: 'VIEW',
  style: 'STYLE',
  if: 'IF',
  else: 'ELSE',
  for: 'FOR',
  in: 'IN',
  key: 'KEY',
  return: 'RETURN',
  async: 'ASYNC',
  await: 'AWAIT',
  void: 'VOID',
  true: 'TRUE',
  false: 'FALSE',
  null: 'NULL',
  on_mount: 'ON_MOUNT',
  on_change: 'ON_CHANGE',
  slot: 'SLOT',
  int: 'INT_TYPE',
  float: 'FLOAT_TYPE',
  string: 'STRING_TYPE',
  bool: 'BOOL_TYPE',
};

export const PRIMITIVE_TYPE_TOKENS: TokenType[] = [
  'INT_TYPE', 'FLOAT_TYPE', 'STRING_TYPE', 'BOOL_TYPE',
];
