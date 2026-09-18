import '../site.css';
import { ArrowUpRight, CodeLines, CodePanel, SectionKicker, SiteShell } from '../shared/SiteShell';
import { goTo } from '../router';
import { useState } from 'react';

const sections = ['Introduction', 'Components', 'Reactive state', 'View blocks', 'Style blocks', 'Lifecycle', 'Types'];
export function Documentation() {
  const [active, setActive] = useState('Introduction');
  return (
    <SiteShell active="Documentation">
      <main className="cr-doc-layout">
        <aside className="cr-doc-sidebar"><div className="cr-side-title">Crescent documentation</div>{sections.map((item) => <button type="button" key={item} onClick={() => setActive(item)} className={`cr-side-link text-left ${active === item ? 'active' : ''}`}>{item}</button>)}</aside>
        <article className="cr-doc-article">
          <SectionKicker>browser-first language guide</SectionKicker>
          <h1>{active === 'Introduction' ? 'Learn the pieces of a Crescent component.' : active}</h1>
          <p className="text-lg !leading-8">A Crescent component declares its types and state, describes its view and styles, and compiles to JavaScript for the browser.</p>
          <div className="mt-8">
            <CodePanel title="counter.crs">
              <CodeLines lines={[
                <><span className="kw">component</span> <span className="fn">Counter</span> &#123;</>,
                <>&nbsp;&nbsp;<span className="kw">state</span>&lt;<span className="type">int</span>&gt; count = 0;</>,
                <>&nbsp;&nbsp;<span className="kw">derived</span>&lt;<span className="type">string</span>&gt; label = <span className="str">"Count: "</span> &#123;count&#125;;</>,
                <>&nbsp;&nbsp;<span className="kw">void</span> <span className="fn">increment</span>() &#123;</>,
                <>&nbsp;&nbsp;&nbsp;&nbsp;count++;</>,
                <>&nbsp;&nbsp;&#125;</>,
                <>&nbsp;&nbsp;<span className="kw">view</span> &#123;</>,
                <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;button onclick=&#123;increment&#125;&gt;&#123;label&#125;&lt;/button&gt;</>,
                <>&nbsp;&nbsp;&#125;</>,
                <>&#125;</>,
              ]} />
            </CodePanel>
          </div>
          <h2>Component structure</h2><p>A component owns its state and describes the interface it produces. The <span className="cr-inline-code">view</span> block becomes DOM updates, and the <span className="cr-inline-code">style</span> block keeps component styles next to the markup.</p>
          <h2>Reactive state</h2><p>Use <span className="cr-inline-code">state&lt;T&gt;</span> for values that change and <span className="cr-inline-code">derived&lt;T&gt;</span> for values that follow them. When <span className="cr-inline-code">count</span> changes, the compiler knows which view expression must update.</p>
          <div className="mt-6 rounded-lg border border-[#e7bd7d33] bg-[#e7bd7d08] p-4"><div className="cr-mono text-[10px] text-[#e7bd7d]">DIAGNOSTIC / NULLABLE TYPE</div><p className="mt-2 text-xs leading-5 text-[#bdbdd2]">A value typed as <span className="cr-inline-code">string?</span> may be null. Check it before rendering text or passing it to a function that expects <span className="cr-inline-code">string</span>.</p></div>
          <h2>Compiler output</h2><p>The current compiler checks the component and emits JavaScript for the browser. The Playground runs this same compile loop with a sandboxed preview, so you can edit, run, and inspect the result without an account.</p>
          <button type="button" onClick={() => goTo('Playground')} className="cr-btn cr-btn-primary mt-7">Run this example <ArrowUpRight size={15} /></button>
        </article>
        <aside className="cr-toc"><div className="cr-side-title">On this page</div><a href="#components">Component structure</a><a href="#reactive">Reactive state</a><a href="#output">Compiler output</a><div className="mt-10 border-t border-[#a09ad633] pt-4 cr-mono text-[10px] text-[#9292ae]">Language status<br /><span className="text-[#bdbdd2]">Pre-1.0 · compiler 0.1.0</span></div></aside>
      </main>
    </SiteShell>
  );
}
