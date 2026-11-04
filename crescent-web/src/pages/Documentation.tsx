import '../site.css';
import { useEffect, useState } from 'react';
import { ArrowUpRight, CodeLines, CodePanel, SectionKicker, SiteShell } from '../shared/SiteShell';
import { goTo } from '../router';

type DocSection = {
  slug: string;
  navLabel: string;
  title: string;
  intro: string;
  body: React.ReactNode;
};

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cr-callout">
      <div className="cr-callout-label">{label}</div>
      <p>{children}</p>
    </div>
  );
}

const kw = (text: string) => <span className="kw">{text}</span>;
const ty = (text: string) => <span className="type">{text}</span>;
const fn = (text: string) => <span className="fn">{text}</span>;
const str = (text: string) => <span className="str">{text}</span>;

const sections: DocSection[] = [
  {
    slug: 'introduction',
    navLabel: 'Introduction',
    title: 'A typed language for reactive interfaces.',
    intro: 'Crescent compiles typed, component-based source into JavaScript for the browser. Every component declares its state, its logic, its markup, and its styles together, in one file, with one compiler checking all four at once.',
    body: (
      <>
        <p>Three ideas run through the whole language:</p>
        <ul className="cr-doc-list">
          <li><strong>Explicit over implicit.</strong> Types are written where a value is declared — {kw('int')}, {kw('string')}, {kw('bool')}, {kw('float')} — the same way C, Java, or C# read.</li>
          <li><strong>Fine-grained reactivity.</strong> A value that should re-render the view is wrapped in {kw('state')}&lt;T&gt;, and only the expressions that actually depend on it update. There is no virtual DOM to diff.</li>
          <li><strong>Zero boilerplate.</strong> A component's state, logic, view, and styles live in one declaration — no separate files, no wiring a template to a class by name.</li>
        </ul>
        <p>Here is a complete, real component — every line of this compiles today:</p>
        <CodePanel title="counter.crs">
          <CodeLines lines={[
            <>{kw('component')} {fn('Counter')} &#123;</>,
            <>&nbsp;&nbsp;{kw('state')}&lt;{ty('int')}&gt; count = 0;</>,
            <>&nbsp;&nbsp;{kw('void')} {fn('increment')}() &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;count++;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&nbsp;&nbsp;{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;div class="counter-card"&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;h1&gt;{str('"Current Count: "')} &#123;count&#125;&lt;/h1&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;button onclick=&#123;increment&#125;&gt;{str('"Add"')}&lt;/button&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/div&gt;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <p>Everything below is a piece of that same example, explained on its own: types, state, the view block, props, styling, lifecycle, and null safety.</p>
      </>
    ),
  },
  {
    slug: 'types',
    navLabel: 'Types & variables',
    title: 'Types & variables',
    intro: 'Variables are typed at the point they are declared, C-style, and mutable by default.',
    body: (
      <>
        <CodePanel title="types.crs" footer="four primitives">
          <CodeLines lines={[
            <>{ty('int')} count = 10;</>,
            <>{ty('float')} pi = 3.14;</>,
            <>{ty('string')} greeting = {str('"Hello, Crescent!"')};</>,
            <>{ty('bool')} is_active = {kw('true')};</>,
          ]} />
        </CodePanel>
        <h2>String interpolation</h2>
        <p>A {kw('string')} literal can embed an expression directly with <span className="cr-inline-code">&#123; expression &#125;</span>. The expression is evaluated, converted to text, and spliced into the surrounding string — exactly as if you'd written the concatenation by hand, without the noise.</p>
        <CodePanel title="interpolation.crs">
          <CodeLines lines={[
            <>{kw('state')}&lt;{ty('string')}&gt; name = {str('"Ada"')};</>,
            <>{kw('state')}&lt;{ty('int')}&gt; count = 0;</>,
            <>{ty('string')} message = {str('"Hello, {name}! Count is {count}."')};</>,
          ]} />
        </CodePanel>
        <p>This works anywhere a string literal is legal — an ordinary expression, view-block text, or an attribute value. Assigning an interpolated string is still assigning a plain {kw('string')}: it's checked and inferred exactly like any other string value.</p>
        <h2>Mutability &amp; constants</h2>
        <p>Variables are mutable by default. Use {kw('const')} for a value that should never be reassigned after declaration.</p>
        <CodePanel title="constants.crs">
          <CodeLines lines={[<>{kw('const')} {ty('int')} MAX_USERS = 100;</>]} />
        </CodePanel>
        <h2>Arrays, nullable modifiers &amp; generics</h2>
        <p>Nullability (<span className="cr-inline-code">?</span>) and array (<span className="cr-inline-code">[]</span>) modifiers chain left to right, each wrapping the previous type — so order changes what's actually nullable.</p>
        <CodePanel title="modifiers.crs">
          <CodeLines lines={[
            <>{kw('state')}&lt;{ty('string')}[]?&gt; tags = {kw('null')}; &nbsp;&nbsp;<span className="cr-code-comment">// the whole array may be absent</span></>,
            <>{kw('state')}&lt;{ty('string')}?[]&gt; nicknames = []; &nbsp;<span className="cr-code-comment">// individual elements may be</span></>,
          ]} />
        </CodePanel>
        <p>Generic user types don't need special syntax — they resolve through the same type-position rule as {kw('state')}&lt;T&gt;, {kw('derived')}&lt;T&gt;, {kw('provide')}&lt;T&gt;, and {kw('inject')}&lt;T&gt;.</p>
      </>
    ),
  },
  {
    slug: 'structs',
    navLabel: 'Structs',
    title: 'Structs',
    intro: 'Structs are declared at the top level, outside any component, using C-style field syntax. Once declared, a struct is a real type — usable in state, function params, array element types, anywhere a type is expected.',
    body: (
      <>
        <CodePanel title="structs.crs">
          <CodeLines lines={[
            <>{kw('struct')} {fn('User')} &#123;</>,
            <>&nbsp;&nbsp;{ty('string')} name;</>,
            <>&nbsp;&nbsp;{ty('int')} age;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <h2>Destructuring</h2>
        <p>A local variable declaration can pull a struct's fields straight into new local variables, instead of naming one variable and reading <span className="cr-inline-code">.field</span> off it repeatedly. Naming a subset of fields is the common case — you only bind what you need.</p>
        <CodePanel title="destructuring.crs">
          <CodeLines lines={[
            <>{kw('struct')} {fn('Point')} &#123; {ty('int')} x; {ty('int')} y; &#125;</>,
            <></>,
            <>{kw('void')} {fn('log_position')}({kw('state')}&lt;Point&gt; current) &#123;</>,
            <>&nbsp;&nbsp;Point &#123; x, y &#125; = current;</>,
            <>&nbsp;&nbsp;console.log(x);</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <Callout label="scope of destructuring today">
          This works for a local variable declaration only. Destructuring directly in a function's
          parameter list, and array destructuring, are both real planned features that haven't
          shipped yet.
        </Callout>
      </>
    ),
  },
  {
    slug: 'components',
    navLabel: 'Components',
    title: 'Component structure',
    intro: 'A component is declared with the component keyword and holds three things: state, logic (plain C-style functions), and a view block.',
    body: (
      <>
        <CodePanel title="counter.crs">
          <CodeLines lines={[
            <>{kw('component')} {fn('Counter')} &#123;</>,
            <>&nbsp;&nbsp;<span className="cr-code-comment">// 1. State</span></>,
            <>&nbsp;&nbsp;{kw('state')}&lt;{ty('int')}&gt; count = 0;</>,
            <></>,
            <>&nbsp;&nbsp;<span className="cr-code-comment">// 2. Logic</span></>,
            <>&nbsp;&nbsp;{kw('void')} {fn('increment')}() &#123; count++; &#125;</>,
            <>&nbsp;&nbsp;{kw('void')} {fn('reset')}() &#123; count = 0; &#125;</>,
            <></>,
            <>&nbsp;&nbsp;<span className="cr-code-comment">// 3. View</span></>,
            <>&nbsp;&nbsp;{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;div class="counter-card"&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;h1&gt;{str('"Current Count: "')} &#123;count&#125;&lt;/h1&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;button onclick=&#123;increment&#125;&gt;{str('"Add"')}&lt;/button&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;button onclick=&#123;reset&#125;&gt;{str('"Reset"')}&lt;/button&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/div&gt;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <p>Nothing here is wired together by name or convention — the compiler sees the whole component as one declaration, so it can check that <span className="cr-inline-code">increment</span> exists and takes no arguments before it ever reaches the view block that references it.</p>
      </>
    ),
  },
  {
    slug: 'state',
    navLabel: 'Reactive state',
    title: 'Reactive state — state<T>',
    intro: 'A value that should trigger a UI update when it changes is wrapped in state<T>. Reassigning it, or mutating it in place, refreshes exactly the view expressions that read it.',
    body: (
      <>
        <CodePanel title="state.crs" footer="both of these trigger a re-render">
          <CodeLines lines={[
            <>{kw('state')}&lt;{ty('int')}&gt; count = 0;</>,
            <></>,
            <>count++;</>,
            <>count = count + 5;</>,
          ]} />
        </CodePanel>
        <p>State updates are shallow signals, not a virtual DOM diff — the compiler already knows, at compile time, which view expressions read <span className="cr-inline-code">count</span>, and only those are touched when it changes.</p>
      </>
    ),
  },
  {
    slug: 'derived',
    navLabel: 'Derived state',
    title: 'Derived state — derived<T>',
    intro: 'derived<T> declares a computed value that tracks its own dependencies automatically and recalculates whenever any of them change — no manual subscription, no dependency array to keep in sync by hand.',
    body: (
      <>
        <CodePanel title="derived.crs">
          <CodeLines lines={[
            <>{kw('state')}&lt;{ty('int')}&gt; price = 10;</>,
            <>{kw('state')}&lt;{ty('int')}&gt; quantity = 2;</>,
            <></>,
            <>{kw('derived')}&lt;{ty('int')}&gt; total = price * quantity;</>,
          ]} />
        </CodePanel>
        <p><span className="cr-inline-code">total</span> is never assigned to directly — it recalculates itself whenever <span className="cr-inline-code">price</span> or <span className="cr-inline-code">quantity</span> changes. The compiler evaluates it lazily: a change only marks it dirty, and it's actually recomputed the next time a view or an {kw('on_change')} watcher reads it.</p>
      </>
    ),
  },
  {
    slug: 'view',
    navLabel: 'View blocks',
    title: 'View blocks',
    intro: 'The view block is where a component describes its markup. It reads like HTML with expressions spliced in, and it compiles to direct DOM updates rather than a re-rendered virtual tree.',
    body: (
      <>
        <CodePanel title="view.crs">
          <CodeLines lines={[
            <>{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;&lt;div class="card"&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;h1&gt;{str('"Hello, "')} &#123;name&#125;&lt;/h1&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;button onclick=&#123;greet&#125;&gt;{str('"Say hello"')}&lt;/button&gt;</>,
            <>&nbsp;&nbsp;&lt;/div&gt;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <p>An event handler attribute like <span className="cr-inline-code">onclick=&#123;greet&#125;</span> takes a function reference directly — no string event name, no manual <span className="cr-inline-code">addEventListener</span>.</p>
      </>
    ),
  },
  {
    slug: 'control-flow',
    navLabel: 'Control flow',
    title: 'Control flow inside view {}',
    intro: 'Standard if/else and for work directly inside a view block, right alongside markup — not a separate templating mini-language.',
    body: (
      <>
        <h2>Conditionals</h2>
        <CodePanel title="conditional.crs">
          <CodeLines lines={[
            <>{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;&lt;div&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;{kw('if')} (count &gt; 10) &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;p class="warning"&gt;{str('"Count is getting high!"')}&lt;/p&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&#125; {kw('else')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;p&gt;{str('"Count is normal."')}&lt;/p&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&#125;</>,
            <>&nbsp;&nbsp;&lt;/div&gt;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <h2>Loops</h2>
        <p>A {kw('for')} loop over a list takes a {kw('key')} expression, so the compiler can reconcile the list by identity when it changes — reusing and reordering existing DOM nodes instead of rebuilding them.</p>
        <CodePanel title="loop.crs">
          <CodeLines lines={[
            <>{kw('component')} {fn('TodoList')} &#123;</>,
            <>&nbsp;&nbsp;{kw('state')}&lt;{ty('string')}[]&gt; items = [{str('"Buy milk"')}, {str('"Build Crescent"')}];</>,
            <></>,
            <>&nbsp;&nbsp;{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;ul&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{kw('for')} ({ty('string')} item {kw('in')} items {kw('key')} item) &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;li&gt;&#123;item&#125;&lt;/li&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#125;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/ul&gt;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
      </>
    ),
  },
  {
    slug: 'props',
    navLabel: 'Props & nesting',
    title: 'Props & nesting',
    intro: 'A component declares typed parameters right in its header, the same shape as a function signature, and any other component can instantiate it inside a view block.',
    body: (
      <>
        <CodePanel title="props.crs" footer="child + parent, in one file">
          <CodeLines lines={[
            <><span className="cr-code-comment">// Child</span></>,
            <>{kw('component')} {fn('CustomButton')}({ty('string')} label, {ty('void')}() action) &#123;</>,
            <>&nbsp;&nbsp;{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;button class="btn" onclick=&#123;action&#125;&gt;&#123;label&#125;&lt;/button&gt;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
            <></>,
            <><span className="cr-code-comment">// Parent</span></>,
            <>{kw('component')} {fn('App')} &#123;</>,
            <>&nbsp;&nbsp;{kw('state')}&lt;{ty('int')}&gt; clicks = 0;</>,
            <>&nbsp;&nbsp;{kw('void')} {fn('handle_click')}() &#123; clicks++; &#125;</>,
            <></>,
            <>&nbsp;&nbsp;{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;main&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;h1&gt;{str('"Total Clicks: "')} &#123;clicks&#125;&lt;/h1&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;CustomButton action=&#123;handle_click&#125; label="Click Me!"/&gt;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/main&gt;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <p>A prop typed <span className="cr-inline-code">void()</span> is a function reference — the same way <span className="cr-inline-code">action</span> above accepts <span className="cr-inline-code">handle_click</span> and calls it back on click.</p>
      </>
    ),
  },
  {
    slug: 'slots',
    navLabel: 'Slots',
    title: 'Composition — <slot />',
    intro: 'A component can accept child markup from wherever it\'s used, the same idea as React\'s children or a Web Component slot, with a single self-closing element marking where it goes.',
    body: (
      <CodePanel title="slots.crs">
        <CodeLines lines={[
          <><span className="cr-code-comment">// Layout component</span></>,
          <>{kw('component')} {fn('Card')} &#123;</>,
          <>&nbsp;&nbsp;{kw('view')} &#123;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;div class="card"&gt;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;slot /&gt;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/div&gt;</>,
          <>&nbsp;&nbsp;&#125;</>,
          <>&#125;</>,
          <></>,
          <><span className="cr-code-comment">// Usage</span></>,
          <>{kw('component')} {fn('App')} &#123;</>,
          <>&nbsp;&nbsp;{kw('view')} &#123;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;Card&gt;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;h1&gt;{str('"Card Title"')}&lt;/h1&gt;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/Card&gt;</>,
          <>&nbsp;&nbsp;&#125;</>,
          <>&#125;</>,
        ]} />
      </CodePanel>
    ),
  },
  {
    slug: 'context',
    navLabel: 'Context',
    title: 'Context — provide<T> / inject<T>',
    intro: 'provide<T> makes a value available to every component beneath it in the tree, however deeply nested, without threading it through every prop list along the way. inject<T> reads it back out, wherever it\'s needed.',
    body: (
      <CodePanel title="context.crs">
        <CodeLines lines={[
          <>{kw('struct')} {fn('ThemeState')} &#123; {ty('string')} class_name; &#125;</>,
          <></>,
          <>{kw('component')} {fn('DeepNestedWidget')} &#123;</>,
          <>&nbsp;&nbsp;{kw('inject')}&lt;ThemeState&gt; theme;</>,
          <>&nbsp;&nbsp;{kw('view')} &#123;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;div class=&#123;theme.class_name&#125;&gt;{str('"Context resolved!"')}&lt;/div&gt;</>,
          <>&nbsp;&nbsp;&#125;</>,
          <>&#125;</>,
          <></>,
          <>{kw('component')} {fn('App')} &#123;</>,
          <>&nbsp;&nbsp;{kw('provide')}&lt;ThemeState&gt; current_theme = ThemeState &#123; class_name: {str('"dark-theme"')} &#125;;</>,
          <>&nbsp;&nbsp;{kw('view')} &#123; &lt;DeepNestedWidget/&gt; &#125;</>,
          <>&#125;</>,
        ]} />
      </CodePanel>
    ),
  },
  {
    slug: 'styling',
    navLabel: 'Styling',
    title: 'Component-scoped styling',
    intro: 'A style block scopes CSS to its own component automatically — a class name like .btn never leaks out to, or collides with, any other component\'s .btn.',
    body: (
      <>
        <CodePanel title="styling.crs">
          <CodeLines lines={[
            <>{kw('component')} {fn('PrimaryButton')}({ty('string')} text) &#123;</>,
            <>&nbsp;&nbsp;{kw('view')} &#123; &lt;button class="btn"&gt;&#123;text&#125;&lt;/button&gt; &#125;</>,
            <></>,
            <>&nbsp;&nbsp;{kw('style')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;.btn &#123; background-color: #8B5CF6; color: white; border-radius: 8px; &#125;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;.btn:hover &#123; background-color: #6D28D9; &#125;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <h2>Reactive styling</h2>
        <p>A style block can also read a component's own state directly, with the same <span className="cr-inline-code">&#123; expression &#125;</span> syntax as everywhere else — a style rule updates the moment the state it reads changes.</p>
        <CodePanel title="reactive-styling.crs">
          <CodeLines lines={[
            <>{kw('component')} {fn('ThemeToggle')} &#123;</>,
            <>&nbsp;&nbsp;{kw('state')}&lt;{ty('bool')}&gt; is_dark = {kw('true')};</>,
            <>&nbsp;&nbsp;{kw('style')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;.box &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;background-color: &#123;is_dark ? {str('"#18181B"')} : {str('"#F4F4F5"')}&#125;;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&#125;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
      </>
    ),
  },
  {
    slug: 'lifecycle',
    navLabel: 'Lifecycle',
    title: 'Lifecycle hooks & watchers',
    intro: 'on_mount runs once, when a component first attaches to the DOM. on_change(name) runs every time the state or derived value named in its parentheses changes — an explicit watcher instead of a dependency array.',
    body: (
      <CodePanel title="lifecycle.crs">
        <CodeLines lines={[
          <>{kw('component')} {fn('Cart')} &#123;</>,
          <>&nbsp;&nbsp;{kw('state')}&lt;{ty('int')}&gt; quantity = 2;</>,
          <>&nbsp;&nbsp;{kw('state')}&lt;{ty('string')}&gt; log = {str('""')};</>,
          <></>,
          <>&nbsp;&nbsp;{kw('on_mount')} &#123;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;log = {str('"mounted"')};</>,
          <>&nbsp;&nbsp;&#125;</>,
          <></>,
          <>&nbsp;&nbsp;{kw('on_change')}(quantity) &#123;</>,
          <>&nbsp;&nbsp;&nbsp;&nbsp;log = {str('"quantity changed to "')} + quantity;</>,
          <>&nbsp;&nbsp;&#125;</>,
          <>&#125;</>,
        ]} />
      </CodePanel>
    ),
  },
  {
    slug: 'null-safety',
    navLabel: 'Null safety',
    title: 'Null safety — T?',
    intro: 'Types are non-nullable by default. A value that may be absent needs an explicit ? — and the compiler tracks, statement by statement, whether a nullable value has actually been checked yet.',
    body: (
      <>
        <CodePanel title="null-safety.crs">
          <CodeLines lines={[
            <>{kw('state')}&lt;{ty('string')}?&gt; user_name = {kw('null')};</>,
            <></>,
            <>{kw('view')} &#123;</>,
            <>&nbsp;&nbsp;{kw('if')} (user_name != {kw('null')}) &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;p&gt;{str('"Welcome, "')} &#123;user_name&#125;&lt;/p&gt; <span className="cr-code-comment">// safe here</span></>,
            <>&nbsp;&nbsp;&#125; {kw('else')} &#123;</>,
            <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;p&gt;{str('"Please log in."')}&lt;/p&gt;</>,
            <>&nbsp;&nbsp;&#125;</>,
            <>&#125;</>,
          ]} />
        </CodePanel>
        <p>This narrowing isn't limited to a plain <span className="cr-inline-code">if</span>. The checker also understands short-circuit narrowing across <span className="cr-inline-code">&amp;&amp;</span>/<span className="cr-inline-code">||</span>, both branches of a ternary, and an early-return guard clause — so <span className="cr-inline-code">if (user_name == null) &#123; return; &#125;</span> makes <span className="cr-inline-code">user_name</span> safe to use in every statement that follows it, for the rest of that function.</p>
        <Callout label="what gets checked">
          Narrowing applies to state, derived values, function parameters, local variables, and
          for-loop items alike — anywhere a nullable binding can appear.
        </Callout>
      </>
    ),
  },
];

function useDocSection(): [DocSection, string] {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const found = sections.find((s) => s.slug === hash);
  return [found ?? sections[0], found ? hash : sections[0].slug];
}

export function Documentation() {
  const [active, activeSlug] = useDocSection();
  const activeIndex = sections.findIndex((s) => s.slug === activeSlug);
  const prev = sections[activeIndex - 1];
  const next = sections[activeIndex + 1];

  return (
    <SiteShell active="Documentation">
      <main className="cr-doc-layout">
        <aside className="cr-doc-sidebar">
          <div className="cr-side-title">Crescent documentation</div>
          {sections.map((section) => (
            <a
              key={section.slug}
              href={`#${section.slug}`}
              className={`cr-side-link ${activeSlug === section.slug ? 'active' : ''}`}
            >
              {section.navLabel}
            </a>
          ))}
        </aside>

        <article className="cr-doc-article" id={active.slug}>
          <SectionKicker>browser-first language guide</SectionKicker>
          <h1>{active.title}</h1>
          <p className="text-lg !leading-8">{active.intro}</p>
          {active.body}

          <div className="cr-doc-pager">
            {prev ? <a href={`#${prev.slug}`} className="cr-btn">← {prev.navLabel}</a> : <span />}
            {next ? <a href={`#${next.slug}`} className="cr-btn cr-btn-primary">{next.navLabel} <ArrowUpRight size={14} /></a> : <span />}
          </div>
        </article>

        <aside className="cr-toc">
          <div className="cr-side-title">On this page</div>
          <a href={`#${active.slug}`}>{active.navLabel}</a>
          <div className="mt-10 border-t border-[#a09ad633] pt-4 cr-mono text-[10px] text-[#9292ae]">
            Language status<br /><span className="text-[#bdbdd2]">Pre-1.0 · compiler 0.1.0</span>
          </div>
          <button type="button" onClick={() => goTo('Playground')} className="cr-btn cr-btn-primary mt-5 w-full justify-center">
            Try it <ArrowUpRight size={14} />
          </button>
        </aside>
      </main>
    </SiteShell>
  );
}
