import { Lexer } from './lexer';
import { Token, TokenType, PRIMITIVE_TYPE_TOKENS } from './tokens';
import * as AST from './ast';

export class ParseError extends Error {}

interface Snapshot {
  pos: number;
}

export class Parser {
  private lexer: Lexer;
  private current: Token;

  constructor(source: string) {
    this.lexer = new Lexer(source);
    this.current = this.lexer.nextToken();
  }

  private snapshot(): Snapshot {
    return { pos: this.current.start };
  }

  private restore(snap: Snapshot): void {
    this.lexer.setPos(snap.pos);
    this.current = this.lexer.nextToken();
  }

  private check(type: TokenType): boolean {
    return this.current.type === type;
  }

  private checkAny(types: TokenType[]): boolean {
    return types.includes(this.current.type);
  }

  private advance(): Token {
    const prev = this.current;
    this.current = this.lexer.nextToken();
    return prev;
  }

  private expect(type: TokenType, message?: string): Token {
    if (!this.check(type)) {
      throw new ParseError(
        message ??
          `Expected token ${type} but got ${this.current.type} ('${this.current.value}') at line ${this.current.line}`
      );
    }
    return this.advance();
  }

  private fail(message: string): never {
    throw new ParseError(`${message} at line ${this.current.line} (got ${this.current.type} '${this.current.value}')`);
  }

  parseProgram(): AST.Program {
    const declarations: AST.TopLevelDecl[] = [];
    while (!this.check('EOF')) {
      declarations.push(this.parseTopLevelDecl());
    }
    return { kind: 'Program', declarations };
  }

  private parseTopLevelDecl(): AST.TopLevelDecl {
    if (this.check('STRUCT')) return this.parseStructDecl();
    if (this.check('COMPONENT')) return this.parseComponentDecl();
    if (this.check('USE')) return this.parseUseDecl();
    this.fail("Expected 'component', 'struct', or 'use' at top level");
  }

  private parsePathSegment(): string {
    if (this.check('SUPER')) {
      this.advance();
      return 'super';
    }
    return this.expect('IDENTIFIER').value;
  }

  private parseImportItem(): AST.ImportItem {
    const name = this.expect('IDENTIFIER').value;
    if (this.check('AS')) {
      this.advance();
      const alias = this.expect('IDENTIFIER').value;
      return { name, alias };
    }
    return { name };
  }

  private parseUseDecl(): AST.UseDecl {
    this.expect('USE');
    const segments: string[] = [this.parsePathSegment()];

    while (this.check('COLONCOLON')) {
      this.advance();
      if (this.check('LBRACE')) {
        this.advance();
        const items: AST.ImportItem[] = [this.parseImportItem()];
        while (this.check('COMMA')) {
          this.advance();
          items.push(this.parseImportItem());
        }
        this.expect('RBRACE');
        this.expect('SEMI');
        return { kind: 'UseDecl', pathSegments: segments, items };
      }
      segments.push(this.parsePathSegment());
    }

    this.expect('SEMI');
    const itemName = segments.pop();
    if (itemName === undefined || segments.length === 0) {
      throw new ParseError("'use' must reference a module path before the imported item, e.g. 'use card::UserCard;'");
    }
    return { kind: 'UseDecl', pathSegments: segments, items: [{ name: itemName }] };
  }

  private parseStructDecl(): AST.StructDecl {
    this.expect('STRUCT');
    const name = this.expect('IDENTIFIER').value;
    this.expect('LBRACE');
    const fields: AST.StructField[] = [];
    while (!this.check('RBRACE')) {
      const type = this.parseType();
      const fieldName = this.expect('IDENTIFIER').value;
      this.expect('SEMI');
      fields.push({ type, name: fieldName });
    }
    this.expect('RBRACE');
    return { kind: 'StructDecl', name, fields };
  }

  private parseComponentDecl(): AST.ComponentDecl {
    this.expect('COMPONENT');
    const name = this.expect('IDENTIFIER').value;
    let params: AST.Param[] = [];
    if (this.check('LPAREN')) {
      this.advance();
      if (!this.check('RPAREN')) params = this.parseParamList();
      this.expect('RPAREN');
    }
    this.expect('LBRACE');
    const members: AST.ComponentMember[] = [];
    while (!this.check('RBRACE')) {
      members.push(this.parseComponentMember());
    }
    this.expect('RBRACE');
    return { kind: 'ComponentDecl', name, params, members };
  }

  private parseParamList(): AST.Param[] {
    const params: AST.Param[] = [];
    params.push(this.parseParam());
    while (this.check('COMMA')) {
      this.advance();
      params.push(this.parseParam());
    }
    return params;
  }

  private parseParam(): AST.Param {
    if (this.check('VOID')) {
      this.advance();
      this.expect('LPAREN');
      this.expect('RPAREN');
      const name = this.expect('IDENTIFIER').value;
      return { type: { kind: 'NamedType', name: 'void()' }, name };
    }
    const type = this.parseType();
    const name = this.expect('IDENTIFIER').value;
    return { type, name };
  }

  private parseComponentMember(): AST.ComponentMember {
    switch (this.current.type) {
      case 'STATE': return this.parseStateDecl();
      case 'DERIVED': return this.parseDerivedDecl();
      case 'PROVIDE': return this.parseProvideDecl();
      case 'INJECT': return this.parseInjectDecl();
      case 'CONST': return this.parseConstDecl();
      case 'ON_MOUNT': return this.parseOnMountDecl();
      case 'ON_CHANGE': return this.parseOnChangeDecl();
      case 'VIEW': return this.parseViewBlockDecl();
      case 'STYLE': return this.parseStyleBlockDecl();
      case 'ASYNC': return this.parseFunctionDecl();
      case 'VOID': return this.parseFunctionDecl();
      default:
        if (this.isTypeStartToken()) return this.parseFunctionDecl();
        this.fail('Expected a component member');
    }
  }

  private isTypeStartToken(): boolean {
    return PRIMITIVE_TYPE_TOKENS.includes(this.current.type) || this.check('IDENTIFIER');
  }

  private parseStateDecl(): AST.StateDecl {
    this.expect('STATE');
    this.expect('LT');
    const type = this.parseType();
    this.expect('GT');
    const name = this.expect('IDENTIFIER').value;
    this.expect('ASSIGN');
    const init = this.parseExpression();
    this.expect('SEMI');
    return { kind: 'StateDecl', type, name, init };
  }

  private parseDerivedDecl(): AST.DerivedDecl {
    this.expect('DERIVED');
    this.expect('LT');
    const type = this.parseType();
    this.expect('GT');
    const name = this.expect('IDENTIFIER').value;
    this.expect('ASSIGN');
    const init = this.parseExpression();
    this.expect('SEMI');
    return { kind: 'DerivedDecl', type, name, init };
  }

  private parseProvideDecl(): AST.ProvideDecl {
    this.expect('PROVIDE');
    this.expect('LT');
    const type = this.parseType();
    this.expect('GT');
    const name = this.expect('IDENTIFIER').value;
    this.expect('ASSIGN');
    const init = this.parseExpression();
    this.expect('SEMI');
    return { kind: 'ProvideDecl', type, name, init };
  }

  private parseInjectDecl(): AST.InjectDecl {
    this.expect('INJECT');
    this.expect('LT');
    const type = this.parseType();
    this.expect('GT');
    const name = this.expect('IDENTIFIER').value;
    this.expect('SEMI');
    return { kind: 'InjectDecl', type, name };
  }

  private parseConstDecl(): AST.ConstDecl {
    this.expect('CONST');
    const type = this.parseType();
    const name = this.expect('IDENTIFIER').value;
    this.expect('ASSIGN');
    const init = this.parseExpression();
    this.expect('SEMI');
    return { kind: 'ConstDecl', type, name, init };
  }

  private parseOnMountDecl(): AST.OnMountDecl {
    this.expect('ON_MOUNT');
    const body = this.parseBlock();
    return { kind: 'OnMountDecl', body };
  }

  private parseOnChangeDecl(): AST.OnChangeDecl {
    this.expect('ON_CHANGE');
    this.expect('LPAREN');
    const watched: string[] = [this.expect('IDENTIFIER').value];
    while (this.check('COMMA')) {
      this.advance();
      watched.push(this.expect('IDENTIFIER').value);
    }
    this.expect('RPAREN');
    const body = this.parseBlock();
    return { kind: 'OnChangeDecl', watched, body };
  }

  private parseFunctionDecl(): AST.FunctionDecl {
    let isAsync = false;
    if (this.check('ASYNC')) {
      isAsync = true;
      this.advance();
    }
    let returnType: AST.CrescentType | 'void';
    if (this.check('VOID')) {
      this.advance();
      returnType = 'void';
    } else {
      returnType = this.parseType();
    }
    const name = this.expect('IDENTIFIER').value;
    this.expect('LPAREN');
    let params: AST.Param[] = [];
    if (!this.check('RPAREN')) params = this.parseParamList();
    this.expect('RPAREN');
    const body = this.parseBlock();
    return { kind: 'FunctionDecl', isAsync, returnType, name, params, body };
  }

  parseType(): AST.CrescentType {
    let base = this.parseBaseType();
    while (true) {
      if (this.check('QUESTION')) {
        this.advance();
        base = { kind: 'NullableType', inner: base };
      } else if (this.check('LBRACKET')) {
        this.advance();
        this.expect('RBRACKET');
        base = { kind: 'ArrayType', inner: base };
      } else {
        break;
      }
    }
    return base;
  }

  private parseBaseType(): AST.CrescentType {
    if (PRIMITIVE_TYPE_TOKENS.includes(this.current.type)) {
      const name = this.advance().value as 'int' | 'float' | 'string' | 'bool';
      return { kind: 'PrimitiveType', name };
    }
    const name = this.expect('IDENTIFIER').value;
    if (this.check('LT')) {
      this.advance();
      const typeArg = this.parseType();
      this.expect('GT');
      return { kind: 'GenericType', name, typeArg };
    }
    return { kind: 'NamedType', name };
  }

  private parseBlock(): AST.Stmt[] {
    this.expect('LBRACE');
    const stmts: AST.Stmt[] = [];
    while (!this.check('RBRACE')) {
      stmts.push(this.parseStatement());
    }
    this.expect('RBRACE');
    return stmts;
  }

  private parseStatement(): AST.Stmt {
    if (PRIMITIVE_TYPE_TOKENS.includes(this.current.type)) {
      return this.parseVarDeclStatement();
    }
    if (this.check('IDENTIFIER')) {
      const snap = this.snapshot();
      try {
        return this.parseVarDeclStatement();
      } catch (e) {
        this.restore(snap);
      }
      return this.parseAssignmentOrExprStatement();
    }
    if (this.check('IF')) return this.parseIfStatement();
    if (this.check('FOR')) return this.parseForStatement();
    if (this.check('RETURN')) return this.parseReturnStatement();
    return this.parseAssignmentOrExprStatement();
  }

  private parseVarDeclStatement(): AST.Stmt {
    const type = this.parseType();
    if (!this.check('IDENTIFIER')) this.fail('Expected identifier in variable declaration');
    const name = this.advance().value;
    this.expect('ASSIGN');
    const init = this.parseExpression();
    this.expect('SEMI');
    return { kind: 'VarDecl', type, name, init };
  }

  private parseAssignmentOrExprStatement(): AST.Stmt {
    const expr = this.parseExpression();
    const assignOps: TokenType[] = ['ASSIGN', 'PLUS_ASSIGN', 'MINUS_ASSIGN', 'STAR_ASSIGN', 'SLASH_ASSIGN'];
    if (this.checkAny(assignOps)) {
      const op = this.advance().value;
      const value = this.parseExpression();
      this.expect('SEMI');
      return { kind: 'Assignment', target: expr, op, value };
    }
    if (expr.kind === 'Postfix') {
      this.expect('SEMI');
      return { kind: 'PostfixStmt', target: expr.operand, op: expr.op };
    }
    this.expect('SEMI');
    return { kind: 'ExprStatement', expr };
  }

  private parseIfStatement(): AST.Stmt {
    this.expect('IF');
    this.expect('LPAREN');
    const test = this.parseExpression();
    this.expect('RPAREN');
    const consequent = this.parseBlock();
    let alternate: AST.Stmt[] | undefined;
    if (this.check('ELSE')) {
      this.advance();
      if (this.check('IF')) {
        alternate = [this.parseIfStatement()];
      } else {
        alternate = this.parseBlock();
      }
    }
    return { kind: 'If', test, consequent, alternate };
  }

  private parseForStatement(): AST.Stmt {
    this.expect('FOR');
    this.expect('LPAREN');
    const itemType = this.parseType();
    const itemName = this.expect('IDENTIFIER').value;
    this.expect('IN');
    const iterable = this.parseExpression();
    this.expect('RPAREN');
    const body = this.parseBlock();
    return { kind: 'For', itemType, itemName, iterable, body };
  }

  private parseReturnStatement(): AST.Stmt {
    this.expect('RETURN');
    if (this.check('SEMI')) {
      this.advance();
      return { kind: 'Return' };
    }
    const value = this.parseExpression();
    this.expect('SEMI');
    return { kind: 'Return', value };
  }

  parseExpression(): AST.Expr {
    return this.parseTernary();
  }

  private parseTernary(): AST.Expr {
    const test = this.parseLogicalOr();
    if (this.check('QUESTION')) {
      this.advance();
      const consequent = this.parseExpression();
      this.expect('COLON');
      const alternate = this.parseExpression();
      return { kind: 'Ternary', test, consequent, alternate };
    }
    return test;
  }

  private parseLogicalOr(): AST.Expr {
    let left = this.parseLogicalAnd();
    while (this.check('OR_OR')) {
      this.advance();
      const right = this.parseLogicalAnd();
      left = { kind: 'Binary', op: '||', left, right };
    }
    return left;
  }

  private parseLogicalAnd(): AST.Expr {
    let left = this.parseEquality();
    while (this.check('AND_AND')) {
      this.advance();
      const right = this.parseEquality();
      left = { kind: 'Binary', op: '&&', left, right };
    }
    return left;
  }

  private parseEquality(): AST.Expr {
    let left = this.parseRelational();
    while (this.checkAny(['EQ', 'NEQ'])) {
      const op = this.advance().value;
      const right = this.parseRelational();
      left = { kind: 'Binary', op, left, right };
    }
    return left;
  }

  private parseRelational(): AST.Expr {
    let left = this.parseAdditive();
    while (this.checkAny(['LT', 'GT', 'LE', 'GE'])) {
      const op = this.advance().value;
      const right = this.parseAdditive();
      left = { kind: 'Binary', op, left, right };
    }
    return left;
  }

  private parseAdditive(): AST.Expr {
    let left = this.parseMultiplicative();
    while (this.checkAny(['PLUS', 'MINUS'])) {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      left = { kind: 'Binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): AST.Expr {
    let left = this.parseUnary();
    while (this.checkAny(['STAR', 'SLASH', 'PERCENT'])) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { kind: 'Binary', op, left, right };
    }
    return left;
  }

  private parseUnary(): AST.Expr {
    if (this.checkAny(['BANG', 'MINUS'])) {
      const op = this.advance().value as '!' | '-';
      const operand = this.parseUnary();
      return { kind: 'Unary', op, operand };
    }
    if (this.check('AWAIT')) {
      this.advance();
      const operand = this.parseUnary();
      return { kind: 'Unary', op: 'await', operand };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): AST.Expr {
    let expr = this.parsePrimary();
    while (true) {
      if (this.check('DOT')) {
        this.advance();
        const property = this.expect('IDENTIFIER').value;
        expr = { kind: 'Member', object: expr, property };
      } else if (this.check('LPAREN')) {
        this.advance();
        const args: AST.Expr[] = [];
        if (!this.check('RPAREN')) {
          args.push(this.parseExpression());
          while (this.check('COMMA')) {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect('RPAREN');
        expr = { kind: 'Call', callee: expr, args };
      } else if (this.check('LBRACKET')) {
        this.advance();
        const index = this.parseExpression();
        this.expect('RBRACKET');
        expr = { kind: 'Index', object: expr, index };
      } else if (this.checkAny(['PLUS_PLUS', 'MINUS_MINUS'])) {
        const op = this.advance().value as '++' | '--';
        expr = { kind: 'Postfix', op, operand: expr };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): AST.Expr {
    if (this.check('INT_LITERAL')) {
      return { kind: 'IntLiteral', value: parseInt(this.advance().value, 10) };
    }
    if (this.check('FLOAT_LITERAL')) {
      return { kind: 'FloatLiteral', value: parseFloat(this.advance().value) };
    }
    if (this.check('STRING_LITERAL')) {
      return { kind: 'StringLiteral', value: this.advance().value };
    }
    if (this.check('TRUE')) {
      this.advance();
      return { kind: 'BoolLiteral', value: true };
    }
    if (this.check('FALSE')) {
      this.advance();
      return { kind: 'BoolLiteral', value: false };
    }
    if (this.check('NULL')) {
      this.advance();
      return { kind: 'NullLiteral' };
    }
    if (this.check('LPAREN')) {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }
    if (this.check('LBRACKET')) {
      this.advance();
      const elements: AST.Expr[] = [];
      if (!this.check('RBRACKET')) {
        elements.push(this.parseExpression());
        while (this.check('COMMA')) {
          this.advance();
          elements.push(this.parseExpression());
        }
      }
      this.expect('RBRACKET');
      return { kind: 'ArrayLiteral', elements };
    }
    if (this.check('IDENTIFIER')) {
      const snap = this.snapshot();
      const name = this.advance().value;
      if (this.check('LBRACE')) {
        try {
          return this.parseStructLiteralTail(name);
        } catch (e) {
          this.restore(snap);
          this.advance();
        }
      }
      return { kind: 'Identifier', name };
    }
    this.fail('Expected an expression');
  }

  private parseStructLiteralTail(typeName: string): AST.Expr {
    this.expect('LBRACE');
    const fields: { name: string; value: AST.Expr }[] = [];
    if (!this.check('RBRACE')) {
      fields.push(this.parseFieldInit());
      while (this.check('COMMA')) {
        this.advance();
        fields.push(this.parseFieldInit());
      }
    }
    this.expect('RBRACE');
    return { kind: 'StructLiteral', typeName, fields };
  }

  private parseFieldInit(): { name: string; value: AST.Expr } {
    const name = this.expect('IDENTIFIER').value;
    this.expect('COLON');
    const value = this.parseExpression();
    return { name, value };
  }

  private parseViewBlockDecl(): AST.ViewBlockDecl {
    this.expect('VIEW');
    this.expect('LBRACE');
    const nodes: AST.TemplateNode[] = [];
    while (!this.check('RBRACE')) {
      nodes.push(this.parseTemplateNode());
    }
    this.expect('RBRACE');
    return { kind: 'ViewBlockDecl', nodes };
  }

  private parseTemplateNode(): AST.TemplateNode {
    if (this.check('LT')) return this.parseElement();
    if (this.check('IF')) return this.parseTemplateIf();
    if (this.check('FOR')) return this.parseTemplateFor();
    if (this.check('LBRACE')) {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RBRACE');
      return { kind: 'TextInterpolation', expr };
    }
    if (this.check('STRING_LITERAL')) {
      return { kind: 'TextLiteral', value: this.advance().value };
    }
    this.fail('Expected a template node inside view block');
  }

  private parseElement(): AST.TemplateNode {
    this.expect('LT');
    let tag: string;
    if (this.check('SLOT')) {
      this.advance();
      tag = 'slot';
    } else {
      tag = this.expect('IDENTIFIER').value;
    }
    const isComponent = /^[A-Z]/.test(tag);
    const attributes: AST.Attribute[] = [];
    while (this.check('IDENTIFIER')) {
      const attrName = this.advance().value;
      this.expect('ASSIGN');
      if (this.check('LBRACE')) {
        this.advance();
        const exprValue = this.parseExpression();
        this.expect('RBRACE');
        attributes.push({ name: attrName, isExpr: true, exprValue });
      } else {
        const stringValue = this.expect('STRING_LITERAL').value;
        attributes.push({ name: attrName, isExpr: false, stringValue });
      }
    }
    if (this.check('SLASH_GT')) {
      this.advance();
      return { kind: 'Element', tag, isComponent, attributes, children: [], selfClosing: true };
    }
    this.expect('GT');
    const children: AST.TemplateNode[] = [];
    while (!(this.check('LT') && this.isClosingTagAhead())) {
      children.push(this.parseTemplateNode());
    }
    this.expect('LT');
    this.expect('SLASH');
    const closeTag = this.check('SLOT') ? (this.advance(), 'slot') : this.expect('IDENTIFIER').value;
    if (closeTag !== tag) {
      this.fail(`Mismatched closing tag: expected </${tag}> but got </${closeTag}>`);
    }
    this.expect('GT');
    return { kind: 'Element', tag, isComponent, attributes, children, selfClosing: false };
  }

  private isClosingTagAhead(): boolean {
    const snap = this.snapshot();
    this.advance();
    const isSlash = this.check('SLASH');
    this.restore(snap);
    return isSlash;
  }

  private parseTemplateIf(): AST.TemplateNode {
    this.expect('IF');
    this.expect('LPAREN');
    const test = this.parseExpression();
    this.expect('RPAREN');
    this.expect('LBRACE');
    const consequent: AST.TemplateNode[] = [];
    while (!this.check('RBRACE')) consequent.push(this.parseTemplateNode());
    this.expect('RBRACE');
    let alternate: AST.TemplateNode[] | undefined;
    if (this.check('ELSE')) {
      this.advance();
      if (this.check('IF')) {
        alternate = [this.parseTemplateIf()];
      } else {
        this.expect('LBRACE');
        alternate = [];
        while (!this.check('RBRACE')) alternate.push(this.parseTemplateNode());
        this.expect('RBRACE');
      }
    }
    return { kind: 'TemplateIf', test, consequent, alternate };
  }

  private parseTemplateFor(): AST.TemplateNode {
    this.expect('FOR');
    this.expect('LPAREN');
    const itemType = this.parseType();
    const itemName = this.expect('IDENTIFIER').value;
    this.expect('IN');
    const iterable = this.parseExpression();
    let key: AST.Expr | undefined;
    if (this.check('KEY')) {
      this.advance();
      key = this.parseExpression();
    }
    this.expect('RPAREN');
    this.expect('LBRACE');
    const body: AST.TemplateNode[] = [];
    while (!this.check('RBRACE')) body.push(this.parseTemplateNode());
    this.expect('RBRACE');
    return { kind: 'TemplateFor', itemType, itemName, iterable, key, body };
  }

  private parseStyleBlockDecl(): AST.StyleBlockDecl {
    this.expect('STYLE');
    this.expect('LBRACE');
    this.lexer.setPos(this.current.start);
    const rules: AST.StyleRule[] = [];
    while (true) {
      this.lexer.skipRawWhitespace();
      if (this.lexer.peekChar() === '}') {
        this.lexer.advanceChar();
        break;
      }
      rules.push(this.parseStyleRule());
    }
    this.current = this.lexer.nextToken();
    return { kind: 'StyleBlockDecl', rules };
  }

  private parseStyleRule(): AST.StyleRule {
    const selector = this.lexer.readRawSelector();
    this.lexer.advanceChar();
    const declarations: AST.StyleDeclaration[] = [];
    while (true) {
      this.lexer.skipRawWhitespace();
      if (this.lexer.peekChar() === '}') {
        this.lexer.advanceChar();
        break;
      }
      declarations.push(this.parseStyleDeclaration());
    }
    return { selector, declarations };
  }

  private parseStyleDeclaration(): AST.StyleDeclaration {
    let property = '';
    while (!/[:\s]/.test(this.lexer.peekChar())) property += this.lexer.advanceChar();
    this.lexer.skipRawWhitespace();
    if (this.lexer.peekChar() !== ':') throw new ParseError(`Expected ':' after style property '${property}'`);
    this.lexer.advanceChar();
    this.lexer.skipRawWhitespace();

    const parts: AST.StyleValuePart[] = [];
    let rawBuf = '';
    while (this.lexer.peekChar() !== ';' && this.lexer.peekChar() !== '}' && this.lexer.peekChar() !== '\0') {
      if (this.lexer.peekChar() === '{') {
        if (rawBuf.length > 0) {
          parts.push({ kind: 'raw', text: rawBuf });
          rawBuf = '';
        }
        this.lexer.advanceChar();
        const exprSource = this.lexer.readInterpolationSource();
        this.lexer.advanceChar();
        const subParser = new Parser(exprSource);
        const exprValue = subParser.parseExpression();
        parts.push({ kind: 'expr', expr: exprValue });
      } else {
        rawBuf += this.lexer.advanceChar();
      }
    }
    if (rawBuf.length > 0) {
      parts.push({ kind: 'raw', text: rawBuf.replace(/\s+$/, '') });
    }
    if (this.lexer.peekChar() === ';') this.lexer.advanceChar();
    if (parts.length === 0) throw new ParseError(`Expected a value for style property '${property}'`);
    return { property, parts };
  }
}

export function parseCrescent(source: string): AST.Program {
  return new Parser(source).parseProgram();
}
