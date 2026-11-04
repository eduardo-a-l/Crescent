(function (root) {
  const KEYWORDS = new Set([
    'component', 'state', 'derived', 'provide', 'inject', 'const', 'struct',
    'view', 'style', 'if', 'else', 'for', 'in', 'key', 'return',
    'async', 'await', 'void', 'true', 'false', 'null',
    'on_mount', 'on_change', 'slot', 'use', 'super', 'as',
  ]);

  const TYPES = new Set(['int', 'float', 'string', 'bool']);

  function isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  function isIdentStart(ch) {
    return /[A-Za-z_]/.test(ch);
  }

  function isIdentPart(ch) {
    return /[A-Za-z0-9_]/.test(ch);
  }

  function classifyWord(word) {
    if (KEYWORDS.has(word)) return 'tok-keyword';
    if (TYPES.has(word)) return 'tok-type';
    return null;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function unescapeHtml(text) {
    return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function tokenize(source) {
    const tokens = [];
    const stack = [];
    const n = source.length;
    let i = 0;

    function emit(text, cls) {
      if (text.length > 0) tokens.push({ text, cls });
    }

    while (i < n) {
      const top = stack.length > 0 ? stack[stack.length - 1] : null;
      const ch = source[i];

      if (top === 'string') {
        if (ch === '\\') {
          emit(source.slice(i, i + 2), 'tok-string');
          i += 2;
          continue;
        }
        if (ch === '"') {
          emit(ch, 'tok-string');
          i += 1;
          stack.pop();
          continue;
        }
        if (ch === '{') {
          emit(ch, 'tok-punct-interp');
          i += 1;
          stack.push('brace');
          continue;
        }
        const start = i;
        while (i < n && source[i] !== '"' && source[i] !== '{' && source[i] !== '\\') i += 1;
        emit(source.slice(start, i), 'tok-string');
        continue;
      }

      if (ch === '"') {
        emit(ch, 'tok-string');
        i += 1;
        stack.push('string');
        continue;
      }

      if (top === 'brace' && ch === '}') {
        emit(ch, 'tok-punct-interp');
        i += 1;
        stack.pop();
        continue;
      }

      if (ch === '{') {
        emit(ch, null);
        i += 1;
        if (top === 'brace') stack.push('brace');
        continue;
      }

      if (ch === '}') {
        emit(ch, null);
        i += 1;
        continue;
      }

      if (ch === '/' && source[i + 1] === '/') {
        const start = i;
        while (i < n && source[i] !== '\n') i += 1;
        emit(source.slice(start, i), 'tok-comment');
        continue;
      }

      if (ch === '/' && source[i + 1] === '*') {
        const start = i;
        i += 2;
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
        i = Math.min(i + 2, n);
        emit(source.slice(start, i), 'tok-comment');
        continue;
      }

      if (isDigit(ch)) {
        const start = i;
        while (i < n && isDigit(source[i])) i += 1;
        if (source[i] === '.' && isDigit(source[i + 1])) {
          i += 1;
          while (i < n && isDigit(source[i])) i += 1;
        }
        emit(source.slice(start, i), 'tok-number');
        continue;
      }

      if (isIdentStart(ch)) {
        const start = i;
        while (i < n && isIdentPart(source[i])) i += 1;
        const word = source.slice(start, i);
        emit(word, classifyWord(word));
        continue;
      }

      emit(ch, null);
      i += 1;
    }

    return tokens;
  }

  function mergeAdjacent(tokens) {
    const merged = [];
    for (const t of tokens) {
      const last = merged[merged.length - 1];
      if (last && last.cls === t.cls) {
        last.text += t.text;
      } else {
        merged.push({ text: t.text, cls: t.cls });
      }
    }
    return merged;
  }

  function toHtml(source) {
    return mergeAdjacent(tokenize(source))
      .map((t) => {
        const escaped = escapeHtml(t.text);
        return t.cls ? `<span class="${t.cls}">${escaped}</span>` : escaped;
      })
      .join('');
  }

  const api = { tokenize, toHtml, escapeHtml, unescapeHtml };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CrescentHighlight = api;
  }
})(typeof window !== 'undefined' ? window : this);
