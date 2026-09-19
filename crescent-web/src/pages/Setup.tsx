import '../site.css';
import { ArrowUpRight, Download, FileCode2, MiniMeta, PageTitle, SectionKicker, SiteShell, Terminal } from '../shared/SiteShell';
import { goTo } from '../router';
import { useState } from 'react';

export function Setup() {
  const [selected, setSelected] = useState('playground');
  return (
    <SiteShell active="Setup">
      <main>
        <PageTitle kicker="getting started" title={<>Try Crescent in the browser. <em>Use the compiler from source.</em></>} copy="The Playground is available now. The compiler is still distributed from the source repository, and a versioned public release comes later." actions={<button type="button" onClick={() => goTo('Playground')} className="cr-btn cr-btn-primary">Open the Playground <ArrowUpRight size={15} /></button>} />
        <section className="cr-section !pt-0">
          <div className="cr-section-head"><div><SectionKicker>where to start</SectionKicker><h2 className="cr-section-title mt-5">Choose the tool that exists today.</h2></div><p className="cr-section-copy">Try it in the browser, build the compiler from source, or install the editor extension by hand.</p></div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { id: 'playground', icon: FileCode2, tag: 'AVAILABLE NOW', title: 'Browser Playground', body: 'Compile a single component, read the diagnostics, and preview it in a sandboxed iframe. The code lives in the URL, so sharing it is just sending a link.', action: 'Open Playground', fn: () => goTo('Playground') },
              { id: 'cli', icon: Terminal, tag: 'NOT AVAILABLE YET', title: 'CLI + compiler', body: "Not published as a package yet — it's built from source in the repository. A versioned, public CLI is coming.", action: 'View current status', fn: () => setSelected('cli') },
              { id: 'editor', icon: Download, tag: 'VS CODE v0.2', title: 'Editor support', body: '.crs file support, syntax highlighting, and diagnostics on save. Check, Build, Preview, and Open Preview in Browser are all there — just not on the Marketplace yet.', action: 'View current status', fn: () => setSelected('editor') },
            ].map(({ id, icon: Icon, tag, title, body, action, fn }) => <button type="button" key={id} onClick={fn} className={`cr-panel text-left p-6 transition hover:-translate-y-1 ${selected === id ? 'border-[#9a84ff88] bg-[#17152f]' : ''}`}><div className="flex items-center justify-between"><Icon size={20} className="text-[#9a84ff]" /><span className="cr-mono text-[9px] tracking-[.1em] text-[#9292ae]">{tag}</span></div><h3 className="mt-12 cr-display text-2xl font-semibold tracking-[-.05em] text-[#f2efff]">{title}</h3><p className="mt-3 min-h-[72px] text-sm leading-6 text-[#9292ae]">{body}</p><span className="mt-7 inline-flex items-center gap-2 cr-mono text-[10px] text-[#9de4ff]">{action} <ArrowUpRight size={13} /></span></button>)}
          </div>
        </section>
        <section className="cr-section">
          <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div><SectionKicker>current availability</SectionKicker><h2 className="cr-section-title mt-5">Use the Playground now. Everything else is source-only.</h2><p className="mt-5 text-sm leading-7 text-[#9292ae]">Crescent is pre-1.0, so these labels are literal, not modest. The browser path is ready today; the compiler and editor support are real, just not packaged for anyone else to download yet.</p></div><div className="cr-panel overflow-hidden"><div className="cr-panel-top"><span className="cr-panel-label">what exists today</span><span className="rounded-full border border-[#a09ad633] bg-[#ffffff06] px-2 py-1 cr-mono text-[9px] text-[#9292ae]">CURRENT</span></div><div className="grid divide-y divide-[#a09ad633] md:grid-cols-3 md:divide-x md:divide-y-0">{[['TRY', 'Playground', 'Available now — no account, no database, just a link.'], ['USE', 'Compiler', 'Not published yet. Build it from source in the repository.'], ['EDIT', 'VS Code', 'v0.2 — syntax highlighting and diagnostics, no language server yet, not on the Marketplace.']].map(([tag, title, body]) => <div key={tag} className="p-5"><span className="cr-mono text-[10px] text-[#9a84ff]">{tag}</span><h3 className="mt-5 text-sm font-bold text-[#eeeef8]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#9292ae]">{body}</p></div>)}</div></div></div>
        </section>
        <section className="cr-section">
          <div className="cr-panel flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center md:p-8"><div><MiniMeta>recommended first step</MiniMeta><h2 className="mt-3 cr-display text-2xl font-semibold tracking-[-.05em] text-[#f2efff]">Open a component. Change one line. Read the compiler feedback.</h2></div><button type="button" onClick={() => goTo('Playground')} className="cr-btn cr-btn-primary shrink-0">Open Playground <ArrowUpRight size={15} /></button></div>
        </section>
      </main>
    </SiteShell>
  );
}
