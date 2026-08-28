# Crescent Formal Grammar (v0.2)

> Companion document to `Crescent_Design.md` (v0.3). Defines the concrete grammar and the
> lexer-mode/disambiguation rules needed to actually parse the language described there.
>
> **v0.2 changes:** resolves all three open items from v0.1 §9 — struct declarations, nullable/array
> modifier chaining, and generic type resolution — and reflects the implementation choices made in
> the reference parser (`crescent-compiler/`).

---

## 0. Notation

Standard EBNF:

- `::=` production
- `|` alternative
- `[ x ]` optional
- `{ x }` zero or more
- `( x )` grouping
- `'x'` literal terminal
- `UppercaseIdentifier`, `LowercaseIdentifier` — identifier terminals constrained by first-letter case (see §2)

Pure EBNF cannot fully express Crescent's grammar, because three separate ambiguities are
**context-sensitive**, not resolvable by lookahead alone. §1–2 define those rules; §3 onward is
the grammar that assumes them.

---

## 1. Lexer Modes

The lexer/parser operates in one of three modes, tracked on a mode stack. Mode transitions are
triggered by specific keywords and brace matching, not by the tokens' surface form alone.

| Mode         | Entered by                                                         | Exited by                                         |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------- |
| `MODE_CODE`  | default; also re-entered inside `{ }` interpolations in VIEW/STYLE | matching `}` of the interpolation, or end of file |
| `MODE_VIEW`  | the `view {` keyword+brace pair                                    | matching `}` that closes the `view` block         |
| `MODE_STYLE` | the `style {` keyword+brace pair                                   | matching `}` that closes the `style` block        |

Entering `MODE_VIEW` or `MODE_STYLE` pushes the current mode onto the stack. Any `{ Expression }`
interpolation encountered while in `MODE_VIEW` or `MODE_STYLE` pushes `MODE_CODE`, parses a single
`Expression`, then pops back to the enclosing mode at the matching `}`. Modes nest correctly this
way because Crescent has no view-inside-expression-inside-view construct in v0.1.

---

## 2. Disambiguation Rules

### 2.1 `<` — generic vs. comparison vs. tag-open

`<` is never ambiguous once mode + local context is known:

1. **Generic open.** In `MODE_CODE`, if `<` immediately follows one of the reserved
   generic-bearing keywords (`state`, `derived`, `provide`, `inject`) or follows an identifier in
   **type position** (start of a `VarDecl`, a `Param`, or a `ReturnType`), it opens a
   `TypeArgList` and the matching `>` closes it. No expression parsing occurs between them.
2. **Comparison.** In `MODE_CODE`, in any other position (i.e. mid-`Expression`), `<` is the
   less-than operator.
3. **Tag-open.** In `MODE_VIEW`, `<` at the start of a `TemplateNode` opens an `Element`. `<` never
   appears as a comparison operator inside `MODE_VIEW` directly — comparisons only occur inside a
   `{ Expression }` interpolation, which is already `MODE_CODE`.

Rule of thumb for the parser: **mode determines whether `<` can be a tag; keyword/type-position
determines whether it's a generic; everything left over is comparison.**

### 2.2 Tag name — Component vs. native HTML element

Inside `MODE_VIEW`, immediately after `<`:

- `UppercaseIdentifier` → **Component instantiation** (resolved against declared `component`s).
- `LowercaseIdentifier` → **native HTML element**, emitted as-is to the DOM/JS output.

This is a pure lexical convention (first-letter case), checked at parse time, not type-check time.

### 2.3 `{` inside `view {}` / `style {}` — interpolation vs. block

Inside `MODE_VIEW`: a `{` that opens a `TemplateIf` / `TemplateFor` body is a **block**
(distinguished because it's immediately preceded by the closing `)` of an `if (...)` / `for (...)`
condition). Any other `{` in `MODE_VIEW` is an **interpolation** and pushes `MODE_CODE` per §1.

Inside `MODE_STYLE`: every `{` is an interpolation (style rule bodies use `{ }` for the CSS rule
itself, which is structural, not a mode-entering brace — see `StyleRule` in §7).

---

## 3. Top-Level Structure

```
Program        ::= { TopLevelDecl }
TopLevelDecl   ::= ComponentDecl | StructDecl

ComponentDecl  ::= 'component' Identifier [ '(' [ ParamList ] ')' ] '{' { ComponentMember } '}'

ParamList      ::= Param { ',' Param }
Param          ::= Type Identifier

ComponentMember ::= StateDecl
                   | DerivedDecl
                   | ProvideDecl
                   | InjectDecl
                   | ConstDecl
                   | FunctionDecl
                   | LifecycleBlock
                   | ViewBlock
                   | StyleBlock

StructDecl     ::= 'struct' Identifier '{' { StructField } '}'
StructField    ::= Type Identifier ';'
```

Structs are top-level declarations, sitting alongside `component` rather than nested inside one,
since a struct type is typically shared across several components.

---

## 4. Types

```
Type           ::= BaseType { TypeModifier }
TypeModifier   ::= '?' | '[' ']'

BaseType       ::= PrimitiveType
                  | Identifier
                  | Identifier '<' Type '>'

PrimitiveType  ::= 'int' | 'float' | 'string' | 'bool'

TypeArgList    ::= '<' Type '>'
```

Modifiers apply left-to-right, each wrapping the type built so far: `string[]?` reads as
`NullableType(ArrayType(string))` — a nullable array of strings — while `string?[]` reads as
`ArrayType(NullableType(string))` — an array of nullable strings. The two are legal and distinct.

`Identifier '<' Type '>'` covers generic user/library types (e.g. `Response<User>`) and resolves via
the same type-position rule as everything else in `BaseType` — no dedicated syntax is needed beyond
what §2.1 already establishes. `state`, `derived`, `provide`, `inject` each consume their
`TypeArgList` via the keyword-triggered rule in §2.1 rather than this general production, since they
are grammar keywords, not identifiers.

---

## 5. Declarations

```
StateDecl      ::= 'state' TypeArgList Identifier '=' Expression ';'
DerivedDecl    ::= 'derived' TypeArgList Identifier '=' Expression ';'
ProvideDecl    ::= 'provide' TypeArgList Identifier '=' Expression ';'
InjectDecl     ::= 'inject' TypeArgList Identifier ';'
ConstDecl      ::= 'const' Type Identifier '=' Expression ';'

FunctionDecl   ::= [ 'async' ] ReturnType Identifier '(' [ ParamList ] ')' Block
ReturnType     ::= Type | 'void'

LifecycleBlock ::= OnMountBlock | OnChangeBlock
OnMountBlock   ::= 'on_mount' Block
OnChangeBlock  ::= 'on_change' '(' Identifier { ',' Identifier } ')' Block
```

---

## 6. Statements & Expressions

Standard C-style precedence, as promised in the design doc. No surprises here — included for
completeness so the whole grammar is in one place.

```
Block          ::= '{' { Statement } '}'

Statement      ::= VarDecl
                  | Assignment ';'
                  | ExprStatement ';'
                  | IfStatement
                  | ForStatement
                  | ReturnStatement ';'
                  | Block

VarDecl        ::= Type Identifier '=' Expression ';'
Assignment     ::= LValue AssignOp Expression ';'
                  | LValue ( '++' | '--' ) ';'
LValue         ::= Identifier { '.' Identifier | '[' Expression ']' }
AssignOp       ::= '=' | '+=' | '-=' | '*=' | '/='

IfStatement    ::= 'if' '(' Expression ')' Block [ 'else' ( IfStatement | Block ) ]
ForStatement   ::= 'for' '(' Type Identifier 'in' Expression ')' Block
ReturnStatement ::= 'return' [ Expression ]
ExprStatement  ::= Expression

Expression     ::= Ternary
Ternary        ::= LogicalOr [ '?' Expression ':' Expression ]
LogicalOr      ::= LogicalAnd { '||' LogicalAnd }
LogicalAnd     ::= Equality { '&&' Equality }
Equality       ::= Relational { ( '==' | '!=' ) Relational }
Relational     ::= Additive { ( '<' | '>' | '<=' | '>=' ) Additive }
Additive       ::= Multiplicative { ( '+' | '-' ) Multiplicative }
Multiplicative ::= Unary { ( '*' | '/' | '%' ) Unary }
Unary          ::= ( '!' | '-' | 'await' ) Unary | Postfix
Postfix        ::= Primary { '.' Identifier | '(' [ ArgList ] ')' | '[' Expression ']' | '++' | '--' }
Primary        ::= Literal | Identifier | StructLiteral | ArrayLiteral | '(' Expression ')'

StructLiteral  ::= Identifier '{' [ FieldInit { ',' FieldInit } ] '}'
FieldInit      ::= Identifier ':' Expression
ArrayLiteral   ::= '[' [ Expression { ',' Expression } ] ']'
ArgList        ::= Expression { ',' Expression }
Literal        ::= IntLiteral | FloatLiteral | StringLiteral | 'true' | 'false' | 'null'
```

Note: `Relational`'s `'<'` is the comparison case from §2.1 — reachable here only because
`Relational` is only ever entered from within `MODE_CODE` expression parsing, never from a type or
tag position.

---

## 7. View Templating Grammar (`MODE_VIEW`)

```
ViewBlock          ::= 'view' '{' { TemplateNode } '}'

TemplateNode       ::= Element | TemplateIf | TemplateFor | TextInterpolation | TextLiteral

Element            ::= '<' TagName { Attribute } '/>'
                      | '<' TagName { Attribute } '>' { TemplateNode } '</' TagName '>'

TagName            ::= UppercaseIdentifier
                      | LowercaseIdentifier
                      | 'slot'

Attribute          ::= Identifier '=' ( StringLiteral | '{' Expression '}' )

TemplateIf         ::= 'if' '(' Expression ')' '{' { TemplateNode } '}'
                        [ 'else' ( TemplateIf | '{' { TemplateNode } '}' ) ]

TemplateFor         ::= 'for' '(' Type Identifier 'in' Expression [ 'key' Expression ] ')'
                         '{' { TemplateNode } '}'

TextInterpolation   ::= '{' Expression '}'
TextLiteral          ::= StringLiteral
```

`TagName`'s three alternatives resolve per §2.2: `UppercaseIdentifier` is a component instantiation,
`LowercaseIdentifier` is a native HTML tag, and `slot` is reserved and self-closing only.

`Attribute` values are unambiguous per the v0.2 fix: bare `{Expression}` for expressions, plain
`StringLiteral` for static strings. No quoted-brace hybrid form is legal.

`TemplateFor`'s `key` clause is required per §14.4 of the design doc; its absence is a parse-level
warning, not a parse error — the parser should still accept the loop and fall back to index-based
keys, flagging a diagnostic.

---

## 8. Style Grammar (`MODE_STYLE`)

```
StyleBlock         ::= 'style' '{' { StyleRule } '}'
StyleRule          ::= Selector '{' { StyleDeclaration } '}'
Selector           ::= SelectorToken { SelectorToken }
StyleDeclaration    ::= CSSProperty ':' StyleValue ';'
StyleValue          ::= { StyleValuePart }
StyleValuePart      ::= CSSValueLiteral | '{' Expression '}'
```

A `StyleValue` is a sequence of raw-CSS and `{Expression}` parts concatenated together, so a value
may freely mix the two — `border: 2px solid {accent_color};` is `[raw "2px solid ", expr
accent_color]`. A value with no `{Expression}` parts is purely static; a value with at least one
compiles to a single reactive binding covering the whole property (see `compiler/README.md`).

`Selector` and `CSSProperty` / `CSSValueLiteral` are treated as raw CSS token sequences (the
grammar doesn't attempt to model full CSS syntax — that's delegated to a CSS sub-lexer). The only
Crescent-specific hook into `MODE_STYLE` is the `{ Expression }` interpolation inside a
`StyleValue`, which pushes `MODE_CODE` exactly as in `MODE_VIEW` (§1).

---

## 9. Resolved Items (formerly Open Items, v0.1 §9)

- **Nullable/array chaining** — resolved: left-to-right, per §4. `T[]?` and `T?[]` are both legal
  and mean different things.
- **General generics** — resolved: no dedicated syntax needed. `Identifier '<' Type '>'` in
  `BaseType` (§4) handles it via the same type-position rule as the reserved keywords. Validated
  against `Response<User>` in the reference parser's test fixtures.
- **Struct definitions** — resolved: added as a top-level `StructDecl` (§3), separate from
  `StructLiteral` (§6), which now assumes the referenced type name has been declared via
  `StructDecl` elsewhere in the program. Cross-file/forward-reference resolution is left to a future
  semantic-analysis pass — this grammar only defines the syntax.

## 10. Open Items for v0.3 of this grammar

- No semantic rule yet for what happens when a `StructLiteral`'s `typeName` doesn't match any
  declared `StructDecl` — currently a parser-level non-issue (parses either way) but a real
  type-checker error once one exists.
- `on_change(data)` (§5) takes bare identifiers naming watched state — no grammar exists yet for
  watching a derived expression rather than a single named binding.
- Import/module syntax across files is entirely unspecified; `Program` currently assumes a single
  source file.
