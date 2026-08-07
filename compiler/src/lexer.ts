import { KEYWORDS, Token, TokenType } from './tokens';

export class LexError extends Error {}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  getPos(): number {
    return this.pos;
  }

  setPos(pos: number): void {
    this.pos = pos;
  }

  peekChar(offset: number = 0): string {
    const i = this.pos + offset;
    return i < this.source.length ? this.source[i] : '\0';
  }

  advanceChar(): string {
    const c = this.peekChar();
    this.pos += 1;
    if (c === '\n') this.line += 1;
    return c;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const c = this.peekChar();
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        this.advanceChar();
      } else if (c === '/' && this.peekChar(1) === '/') {
        while (!this.isAtEnd() && this.peekChar() !== '\n') this.advanceChar();
      } else if (c === '/' && this.peekChar(1) === '*') {
        this.advanceChar();
        this.advanceChar();
        while (!this.isAtEnd() && !(this.peekChar() === '*' && this.peekChar(1) === '/')) {
          this.advanceChar();
        }
        this.advanceChar();
        this.advanceChar();
      } else {
        break;
      }
    }
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isIdentStart(c: string): boolean {
    return /[A-Za-z_]/.test(c);
  }

  private isIdentPart(c: string): boolean {
    return /[A-Za-z0-9_]/.test(c);
  }

  private makeToken(type: TokenType, value: string, start: number): Token {
    return { type, value, line: this.line, start };
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments();
    const start = this.pos;
    if (this.isAtEnd()) return this.makeToken('EOF', '', start);

    const c = this.advanceChar();

    if (this.isIdentStart(c)) {
      let ident = c;
      while (this.isIdentPart(this.peekChar())) ident += this.advanceChar();
      const kw = KEYWORDS[ident];
      return this.makeToken(kw ?? 'IDENTIFIER', ident, start);
    }

    if (this.isDigit(c)) {
      let num = c;
      while (this.isDigit(this.peekChar())) num += this.advanceChar();
      if (this.peekChar() === '.' && this.isDigit(this.peekChar(1))) {
        num += this.advanceChar();
        while (this.isDigit(this.peekChar())) num += this.advanceChar();
        return this.makeToken('FLOAT_LITERAL', num, start);
      }
      return this.makeToken('INT_LITERAL', num, start);
    }

    if (c === '"') {
      let str = '';
      while (!this.isAtEnd() && this.peekChar() !== '"') {
        const ch = this.advanceChar();
        if (ch === '\\') {
          const next = this.advanceChar();
          if (next === 'n') str += '\n';
          else if (next === 't') str += '\t';
          else str += next;
        } else {
          str += ch;
        }
      }
      if (this.isAtEnd()) throw new LexError(`Unterminated string literal at line ${this.line}`);
      this.advanceChar();
      return this.makeToken('STRING_LITERAL', str, start);
    }

    switch (c) {
      case '(': return this.makeToken('LPAREN', c, start);
      case ')': return this.makeToken('RPAREN', c, start);
      case '{': return this.makeToken('LBRACE', c, start);
      case '}': return this.makeToken('RBRACE', c, start);
      case '[': return this.makeToken('LBRACKET', c, start);
      case ']': return this.makeToken('RBRACKET', c, start);
      case ',': return this.makeToken('COMMA', c, start);
      case '.': return this.makeToken('DOT', c, start);
      case ':': return this.makeToken('COLON', c, start);
      case ';': return this.makeToken('SEMI', c, start);
      case '?': return this.makeToken('QUESTION', c, start);
      case '!':
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('NEQ', '!=', start); }
        return this.makeToken('BANG', c, start);
      case '=':
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('EQ', '==', start); }
        return this.makeToken('ASSIGN', c, start);
      case '<':
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('LE', '<=', start); }
        return this.makeToken('LT', c, start);
      case '>':
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('GE', '>=', start); }
        return this.makeToken('GT', c, start);
      case '&':
        if (this.peekChar() === '&') { this.advanceChar(); return this.makeToken('AND_AND', '&&', start); }
        throw new LexError(`Unexpected character '&' at line ${this.line}`);
      case '|':
        if (this.peekChar() === '|') { this.advanceChar(); return this.makeToken('OR_OR', '||', start); }
        throw new LexError(`Unexpected character '|' at line ${this.line}`);
      case '+':
        if (this.peekChar() === '+') { this.advanceChar(); return this.makeToken('PLUS_PLUS', '++', start); }
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('PLUS_ASSIGN', '+=', start); }
        return this.makeToken('PLUS', c, start);
      case '-':
        if (this.peekChar() === '-') { this.advanceChar(); return this.makeToken('MINUS_MINUS', '--', start); }
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('MINUS_ASSIGN', '-=', start); }
        return this.makeToken('MINUS', c, start);
      case '*':
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('STAR_ASSIGN', '*=', start); }
        return this.makeToken('STAR', c, start);
      case '/':
        if (this.peekChar() === '>') { this.advanceChar(); return this.makeToken('SLASH_GT', '/>', start); }
        if (this.peekChar() === '=') { this.advanceChar(); return this.makeToken('SLASH_ASSIGN', '/=', start); }
        return this.makeToken('SLASH', c, start);
      case '%':
        return this.makeToken('PERCENT', c, start);
      default:
        throw new LexError(`Unexpected character '${c}' at line ${this.line}`);
    }
  }

  readRawSelector(): string {
    let text = '';
    while (!this.isAtEnd() && this.peekChar() !== '{') {
      text += this.advanceChar();
    }
    return text.trim();
  }

  readRawStyleValueUntilTerminator(): string {
    let text = '';
    while (!this.isAtEnd() && this.peekChar() !== ';' && this.peekChar() !== '}') {
      text += this.advanceChar();
    }
    return text.trim();
  }

  readInterpolationSource(): string {
    let depth = 1;
    let text = '';
    while (!this.isAtEnd() && depth > 0) {
      const c = this.peekChar();
      if (c === '{') depth += 1;
      if (c === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      text += this.advanceChar();
    }
    if (this.isAtEnd()) throw new LexError('Unterminated style interpolation');
    return text;
  }

  skipRawWhitespace(): void {
    while (!this.isAtEnd() && /\s/.test(this.peekChar())) this.advanceChar();
  }
}
