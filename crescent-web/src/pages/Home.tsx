import '../site.css';
import { ArrowUpRight, CodeLines, CodePanel, MiniMeta, PageTitle, SectionKicker, SiteShell } from '../shared/SiteShell';
import { goTo } from '../router';

export function Home() {
  return (
    <SiteShell active="Home">
      <main>
        <PageTitle
          kicker="typed components for the browser"
          title={<>Build reactive web interfaces with <em>typed components.</em></>}
          copy="Crescent keeps state, markup, styles, and compiler feedback close together, then compiles each component to JavaScript for the browser."
          actions={<><button type="button" onClick={() => goTo('Playground')} className="cr-btn cr-btn-primary">Open playground <ArrowUpRight size={15} /></button><button type="button" onClick={() => goTo('Documentation')} className="cr-btn">Read the language <ArrowUpRight size={15} /></button></>}
        />

        <section className="pb-24 md:pb-32 cr-reveal cr-reveal-4">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <CodePanel title="welcome.crs" footer="compiled to JavaScript · 18ms">
              <CodeLines lines={[
                <><span className="kw">component</span> <span className="fn">Welcome</span> &#123;</>,
                <>&nbsp;&nbsp;<span className="kw">state</span>&lt;<span className="type">string</span>&gt; name = <span className="str">"world"</span>;</>,
                <>&nbsp;&nbsp;<span className="kw">derived</span>&lt;<span className="type">string</span>&gt; label = <span className="str">"Hello, "</span> &#123;name&#125; <span className="str">"!"</span>;</>,
                <>&nbsp;&nbsp;<span className="kw">view</span> &#123;</>,
                <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;h1&gt;&#123;label&#125;&lt;/h1&gt;</>,
                <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;button onclick=&#123;greet&#125;&gt;</>,
                <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="str">"Say hello"</span></>,
                <>&nbsp;&nbsp;&nbsp;&nbsp;&lt;/button&gt;</>,
                <>&nbsp;&nbsp;&#125;</>,
                <>&nbsp;&nbsp;<span className="kw">style</span> &#123; .welcome &#123; color: violet; &#125; &#125;</>,
                <>&#125;</>,
              ]} />
            </CodePanel>
            <div className="cr-panel flex flex-col justify-between p-6 md:p-8">
              <div>
                <MiniMeta>what Crescent does</MiniMeta>
                <h2 className="mt-5 max-w-sm cr-display text-3xl font-semibold leading-[1.05] tracking-[-.06em] text-[#f2efff]">Change a value, and the view updates on its own. A type mismatch never reaches the browser.</h2>
                <p className="mt-5 max-w-sm text-sm leading-7 text-[#9292ae]">Every component keeps its state, derived values, view, and styles in one declaration — checked and compiled to JavaScript in the same pass.</p>
              </div>
              <div className="mt-10 border-t border-[#a09ad633] pt-5"><div className="flex items-center justify-between cr-mono text-[10px] text-[#9292ae]"><span>COMPILER FLOW</span><span className="text-[#bdbdd2]">READY TO RUN</span></div><div className="mt-4 flex flex-wrap gap-2">{['state', 'view', 'style', 'JavaScript output'].map((x) => <span key={x} className="rounded-md border border-[#a09ad633] px-2 py-1.5 text-[11px] text-[#bdbdd2]">{x}</span>)}</div></div>
            </div>
          </div>
        </section>

        <section className="cr-section">
          <div className="cr-section-head"><div><SectionKicker>why Crescent</SectionKicker><h2 className="cr-section-title mt-5">One file holds the logic, the markup, the styles, and the compiler's feedback.</h2></div><p className="cr-section-copy">Every piece has an obvious place to live — and a type the compiler checks before any of it reaches the browser.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Declare state', 'state<T> marks a value as reactive. derived<T> recomputes automatically from whatever it reads.', 'state<int> count = 0;'],
              ['02', 'Read diagnostics', 'Type and syntax problems surface before you ever open a broken preview.', 'error: expected string'],
              ['03', 'Compile for the browser', 'View and style blocks live right beside the logic they belong to, then compile straight to JavaScript and real DOM updates.', 'state → view → JavaScript'],
            ].map(([n, title, body, code]) => <article key={n} className="cr-panel p-6 md:p-7"><span className="cr-mono text-[11px] text-[#9a84ff]">{n}</span><h3 className="mt-12 cr-display text-xl font-semibold tracking-[-.04em] text-[#f2efff]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#9292ae]">{body}</p><div className="mt-7 border-t border-[#a09ad633] pt-4 cr-mono text-[10px] text-[#9de4ff]">{code}</div></article>)}
          </div>
        </section>

        <section className="cr-section">
          <div className="grid items-center gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div><SectionKicker>availability</SectionKicker><h2 className="cr-section-title mt-5">Try it now. Use the compiler from source.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#9292ae]">The Playground runs in any browser today. The compiler and the VS Code extension are both real — just not packaged as public downloads yet.</p><button type="button" onClick={() => goTo('Setup')} className="cr-btn mt-7">See where to start <ArrowUpRight size={15} /></button></div>
            <div className="cr-panel p-5 md:p-7"><div className="flex items-center justify-between border-b border-[#a09ad633] pb-4"><span className="cr-mono text-[11px] text-[#bdbdd2]">current availability</span><span className="rounded-full border border-[#e7bd7d44] px-2 py-1 cr-mono text-[9px] text-[#e7bd7d]">PRE-1.0</span></div>{[['NOW', 'Browser Playground', 'Compile one component, read the diagnostics, and share it with a link.'], ['SOURCE', 'CLI + compiler', 'Version 0.1.0, built from source. A public, versioned package is still to come.'], ['VSCODE', 'Editor extension v0.2', '.crs file support, syntax highlighting, and live diagnostics — Check, Build, and Preview included. Not on the Marketplace yet.']].map(([phase, title, body]) => <div key={phase} className="flex gap-5 border-b border-[#a09ad633] py-5 last:border-0"><span className="w-16 pt-1 cr-mono text-[10px] uppercase text-[#9a84ff]">{phase}</span><div><h3 className="text-sm font-bold text-[#eeeef8]">{title}</h3><p className="mt-1 text-xs leading-5 text-[#9292ae]">{body}</p></div></div>)}</div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
