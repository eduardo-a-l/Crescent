# Crescent Language Design Document (v0.3)

> **Identity:** A safe, explicitly-typed, C-style language that compiles to high-performance, reactive frontend web interfaces.
> **Brand Color:** Light Purple (#8B5CF6) and Dark/Deep Purple (#6d28d9)
> **Logo:** Dual Crescent Arcs
>
> **v0.3 changes:** adds struct declarations, documents nullable/array modifier chaining, and notes
> generic-type resolution. See `Crescent_Grammar.md` §9 for the formal resolution of these three
> items.

---

## 1. Core Principles

- **Explicit over Implicit:** C-style declarations (`int x = 0;`) so developers always know what types they are working with.
- **Fine-Grained Reactivity:** Use explicit state wrappers (`state<T>`) so the compiler updates the UI directly without needing a heavy Virtual DOM.
- **Zero Boilerplate:** Components are self-contained logic, style, and view blocks in a single clean syntax.

---

## 2. Type System & Variables

Crescent uses familiar C primitive types with standard assignment syntax.

### Primitives

```c
int count = 10;
float pi = 3.14;
string greeting = "Hello, Crescent!";
bool is_active = true;

```

### Mutability & Constants

- Variables are mutable by default (C-style).
- Use `const` for immutable variables.

```c
const int MAX_USERS = 100;

```

### Arrays, Nullable Modifiers & Generics

Nullability (`?`) and array (`[]`) modifiers chain left-to-right, each wrapping the previous type,
so order matters:

```c
state<string[]?> tags = null;       // nullable — the whole array may be absent
state<string?[]> nicknames = [];    // not nullable — but individual elements may be
```

Generic user types (e.g. `Response<User>`) don't need special syntax — they resolve through the
same type-position rule as `state<T>`, `derived<T>`, `provide<T>`, and `inject<T>`:

```c
Response<User> pending = fetch_user_response();
```

### Struct Types

Structs are declared at the top level, outside any `component`, using C-style field syntax:

```c
struct User {
    string name;
    int age;
}
```

Once declared, a struct can be used as a type anywhere (`state<User>`, function params, array
element types, etc.) and constructed with the struct-literal syntax shown in §13.2.

---

## 3. Reactive State (`state<T>`)

To trigger UI re-renders, state must be wrapped in `state<T>`.

```c
// Creates a reactive integer initialized to 0
state<int> count = 0;

// Updates state (automatically triggers UI refresh)
count++;
count = count + 5;

```

---

## 4. Component Structure

A component is defined with the `component` keyword and contains **State**, **Functions**, and a **View Block**.

```c
component Counter {
    // 1. State
    state<int> count = 0;

    // 2. Logic (C-style functions)
    void increment() {
        count++;
    }

    void reset() {
        count = 0;
    }

    // 3. UI Template
    view {
        <div class="counter-card">
            <h1>"Current Count: " {count}</h1>

            <button onclick={increment}>"Add"</button>
            <button onclick={reset}>"Reset"</button>
        </div>
    }
}

```

---

## 5. Control Flow inside `view {}`

Crescent lets you use standard C control flow directly inside UI markup.

### Conditionals (`if` / `else`)

```c
view {
    <div>
        if (count > 10) {
            <p class="warning">"Count is getting high!"</p>
        } else {
            <p>"Count is normal."</p>
        }
    </div>
}

```

### Loops (`for`)

```c
component TodoList {
    state<string[]> items = ["Buy milk", "Build Crescent", "Profit"];

    view {
        <ul>
            for (string item in items key item) {
                <li>{item}</li>
            }
        </ul>
    }
}

```

---

## 6. Component Props & Nesting

Components accept typed parameters in their declaration and can be instantiated inside other `view` blocks.

```c
// Child Component
component CustomButton(string label, void() action) {
    view {
        <button class="btn" onclick={action}>
            {label}
        </button>
    }
}

// Parent Component
component App {
    state<int> clicks = 0;

    void handle_click() {
        clicks++;
    }

    view {
        <main>
            <h1>"Total Clicks: " {clicks}</h1>
            <CustomButton action={handle_click} label="Click Me!"/>
        </main>
    }
}

```

---

## 7. Component-Scoped Styling

Since Crescent is a modern frontend language inspired by React, component styling is native. The dedicated `style {}` block scopes styles directly to the component.

```c
component PrimaryButton(string text, void() onClick) {
    view {
        <button class="btn" onclick={onClick}>
            {text}
        </button>
    }

    // Styles automatically scoped to this component!
    style {
        .btn {
            background-color: #8B5CF6; /* Crescent Purple */
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .btn:hover {
            background-color: #6D28D9;
            transform: scale(1.05);
        }
    }
}

```

---

## 8. Dynamic Reactive Styling (The React + C# Blend)

You can bind reactive state variables directly inside your CSS block using `{expression}` syntax:

```c
component ThemeToggle {
    state<bool> is_dark = true;
    state<string> accent_color = "#8B5CF6";

    void toggle_theme() {
        is_dark = !is_dark;
    }

    view {
        <div class="box">
            <h1>"Dynamic Theme"</h1>
            <button onclick={toggle_theme}>"Toggle Mode"</button>
        </div>
    }

    style {
        .box {
            /* Bind Crescent state directly in CSS! */
            background-color: {is_dark ? "#18181B" : "#F4F4F5"};
            color: {is_dark ? "#FFFFFF" : "#000000"};
            border: 2px solid {accent_color};
            padding: 2rem;
            border-radius: 12px;
        }
    }
}

```

---

## 9. C# & React Feature Comparison

| Feature              | React Way                       | C# / .NET Way                         | Crescent's Way                                   |
| -------------------- | ------------------------------- | ------------------------------------- | ------------------------------------------------ |
| **Component Layout** | JSX functions                   | Razor / WPF XAML                      | `view { <HTML> }`                                |
| **State**            | `useState(0)` hook              | Properties / `INotifyPropertyChanged` | `state<int> count = 0;`                          |
| **UI Control Flow**  | `{condition && <Component/>}`   | `@if (condition) { ... }`             | `if (condition) { <Component/> }`                |
| **Types**            | TypeScript (Optional/Runtime)   | C# (Strict compile-time)              | C-style strict (`int`, `string`, `bool`)         |
| **Methods**          | `const handleClick = () => {}`  | `private void HandleClick()`          | `void handle_click()`                            |
| **Styling**          | CSS Modules / Styled-Components | XAML Styles                           | Scoped `style {}` blocks with reactive variables |

---

## 10. Advanced Reactivity & Lifecycles

### Derived State (`derived<T>`)

`derived<T>` automatically tracks state dependencies and recalculates computed values without manual updates:

```c
state<int> price = 10;
state<int> quantity = 2;

// Auto-recalculates whenever price or quantity changes!
derived<int> total = price * quantity;

```

### Lifecycle Hooks & Reactive Watchers

Clean, explicit lifecycle blocks replace hook arrays:

```c
component DataFetcher {
    state<string> data = "Loading...";

    // Runs once when component mounts to the DOM
    on_mount {
        data = fetch_api_data();
    }

    // Runs automatically whenever `data` changes
    on_change(data) {
        println("Data updated to: " + data);
    }

    view {
        <p>{data}</p>
    }
}

```

---

## 11. Null Safety (`T?`)

To prevent runtime null errors, types are non-nullable by default. Nullable variables require explicit `?` annotation.

```c
state<string?> user_name = null; // Explicitly nullable

view {
    if (user_name != null) {
        <p>"Welcome, " {user_name}</p> // Compiler safely unwraps user_name inside the block!
    } else {
        <p>"Please log in."</p>
    }
}

```

---

## 12. Component Composition (`<slot />`)

Pass child UI elements down to components (similar to Web Components or React `children`):

```c
// Layout Component
component Card {
    view {
        <div class="card">
            <slot /> // Renders whatever is passed inside <Card>...</Card>
        </div>
    }
}

// Usage
component App {
    view {
        <Card>
            <h1>"Card Title"</h1>
            <p>"Card description goes here."</p>
        </Card>
    }
}

```

---

## 13. Technical Edge Cases & Compiler Rules

### 13.1 State Mutation Granularity (Arrays & Collections)

- **Rule:** Mutating methods on array types (`T[]`), such as `push()`, `pop()`, `remove()`, or direct index assignments (`items[0] = "x"`), are automatically intercepted by the reactivity compiler.
- **Compiler Behavior:** No spread operators (`[...items, item]`) are required. Method calls flag the internal reactive collection as dirty, triggering targeted DOM node updates for affected elements.

```c
state<string[]> items = ["Task 1"];

void add_item(string task) {
    items.push(task); // Reactivity runtime automatically triggers UI insertion
}

```

### 13.2 Nested Object Mutation Enforcement

- **Rule:** Direct property writes on an object wrapped in `state<T>` (e.g. `user.name = "Alex"`) are forbidden at compile time to prevent silent no-op renders in shallow reactivity.
- **Compiler Behavior:** Developers must perform explicit whole-object reassignment.

```c
struct User {
    string name;
    int age;
}

state<User> user = User { name: "Alex", age: 25 };

void update_name() {
    // Compiler Error: Direct property write on shallow state 'user'
    // user.name = "Sam";

    // Reassignment (Triggers reactive update)
    user = User { name: "Sam", age: user.age };
}

```

### 13.3 Event Handler Signatures & Native Browser Events

- **Rule:** Event parameters are optional. Functions bound to DOM events can either be parameterless (`void()`) or explicitly accept strongly-typed event objects (`MouseEvent`, `KeyboardEvent`, `FormEvent`).

```c
// Simple handler
void handle_click() {
    count++;
}

// Typed browser event handler
void handle_key(KeyboardEvent e) {
    if (e.key == "Enter") {
        submit_form();
    }
}

view {
    <button onclick={handle_click}>"Add"</button>
    <input onkeydown={handle_key} />
}

```

### 13.4 Deep State Tree Passing & Async Data

#### Async Data Fetching

Crescent includes built-in `async` and `await` keywords for non-blocking execution:

```c
async void load_user_data() {
    string response = await fetch("https://api.example.com/user");
    user_name = response;
}

```

#### Dependency Injection / Tree Context

Deep state tree passing (equivalent to React Context or C# Dependency Injection) uses explicit `provide` and `inject` primitives:

```c
// Top-Level Ancestor Component
component App {
    provide<ThemeState> current_theme = ThemeState.Dark;

    view {
        <Dashboard/>
    }
}

// Deep Child Component
component DeepNestedWidget {
    inject<ThemeState> theme; // Automatically linked to the nearest provided ancestor!

    view {
        <div class={theme.class_name}>
            <p>"Context Resolved!"</p>
        </div>
    }
}

```

---

## 14. Architecture & Reactivity Trade-Offs

### 14.1 Target Architecture: Transpiled JS (v0.1) -> Wasm/Direct DOM (v1.0)

- **v0.1 Target:** Compiles to clean, modern **JavaScript (ESNext)**. This allows direct interop with the existing web ecosystem, browser DevTools, and NPM without requiring a heavy Wasm runtime bridge.
- **v1.0 Goal:** Directly targets **WebAssembly (Wasm)** with direct DOM binding handles once the ecosystem matures.

### 14.2 Reactivity Model: Shallow Signals with Reactive Collections

To maximize runtime performance and avoid the memory overhead of Vue-style deep `Proxy` objects:

- **Primitive & Object State (`state<T>`):** Shallow signals. Primitive value updates use normal assignment (`count = 5`). Object property updates require whole-object reassignment.
- **Collections (`state<T[]>`):** Arrays are wrapped under the hood in a lightweight Crescent `ReactiveList` class. Calling `.push()`, `.remove()`, or `.clear()` triggers targeted collection events rather than scanning deep object graphs.

### 14.3 Reactive CSS Lowering

CSS blocks containing `{expression}` interpolations compile down to **Scoped CSS Custom Properties (CSS Variables)** on the component host element.

- **Source Crescent Code:**

```c
style {
    .box {
        background-color: {is_dark ? "#18181B" : "#F4F4F5"};
        border-color: {accent_color};
    }
}

```

- **Lowered JS & CSS Output:**

```css
/* Generated Scoped CSS */
.box[data-crs-123] {
  background-color: var(--crs-bg-123);
  border-color: var(--crs-border-123);
}
```

```javascript
// Lowered JS State Signal Effect
effect(() => {
  element.style.setProperty("--crs-bg-123", is_dark ? "#18181B" : "#F4F4F5");
  element.style.setProperty("--crs-border-123", accent_color);
});
```

_Benefit:_ Zero DOM layout thrashing! Updates happen purely through the browser's optimized style engine.

### 14.4 List Reconciliation & Explicit Keys

To ensure efficient DOM patching when reordering or filtering lists, Crescent requires an explicit key in `for` loops (similar to React/Svelte keys):

```c
for (User user in users key user.id) {
    <UserCard user={user}/>
}

```

- **Fallback:** If no `key` is provided, the compiler emits a build warning and falls back to index-based patching.

### 14.5 `derived<T>` Evaluation Strategy: Lazy with Pull-Based Memoization

- **Strategy:** `derived<T>` uses **lazy memoization** (SolidJS / Svelte 5 model).
- **Behavior:** When a dependency changes, the derived value is marked as "dirty," but **does not recalculate immediately**. It only recalculates when a `view` or `on_change` observer actually reads its value. This makes reads inside loops safe and eliminates wasted CPU cycles on unused computations.

### 14.6 Safety Clarification

- **Definition:** "Safety" in Crescent refers specifically to **Application Safety** (Strict Compile-Time Type System + Null Safety `T?`), not systems-level memory safety (like Rust's borrow checker). It prevents runtime type errors at compile time.

### 14.7 Project Milestones: v0.x -> v1.0 -> Post-1.0

- **v0.x (current):** The build-up phase. Language features, the compiler, and the runtime are actively designed and can still change shape as they're built out — this is where the v1.0 base gets produced.
- **v1.0 Goal:** The base is done. Core language syntax and semantics are stable and won't change substantially after this point — v1.0 is meant to be a solid, dependable foundation, not another moving-target release. Two things are required to call it v1.0:
  - The **semantic/type checker** exists and is trustworthy (scope resolution, type checking, the reactivity rules already specified throughout this document actually enforced at compile time, not just documented).
  - Crescent **works well in an editor** — a real language server (LSP) experience in VS Code (diagnostics as you type, autocomplete, go-to-definition, hover types), not just syntax highlighting. This depends on the semantic checker above, since most of what an LSP reports is that checker's output delivered per-keystroke instead of per-build.
- **Post-1.0:** Only corrections (bug fixes), new things (additive features that don't break the stable v1.0 base), and QoL improvements. No fundamental redesigns of what's already stable.
