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
          <div className="cr-section-head"><div><SectionKicker>where to start</SectionKicker><h2 className="cr-section-title mt-5">Choose the tool that exists today.</h2></div><p className="cr-section-copy">Start in the browser, use the current compiler from source, or add the existing editor extension manually.</p></div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { id: 'playground', icon: FileCode2, tag: 'AVAILABLE NOW', title: 'Browser Playground', body: 'Compile one component through the current compiler, inspect diagnostics, and open the sandboxed preview. Share the code in the URL hash.', action: 'Open Playground', fn: () => goTo('Playground') },
              { id: 'cli', icon: Terminal, tag: 'NOT AVAILABLE YET', title: 'CLI + compiler', body: 'The compiler is not published as a package yet. It is built from source in the project repository; a public, versioned CLI comes later.', action: 'View current status', fn: () => setSelected('cli') },
              { id: 'editor', icon: Download, tag: 'VS CODE v0.2', title: 'Editor support', body: 'The extension supports .crs files, syntax highlighting, diagnostics on save/open, Check, Build, Preview, and Open Preview in Browser. It is not on the Marketplace.', action: 'View current status', fn: () => setSelected('editor') },
            ].map(({ id, icon: Icon, tag, title, body, action, fn }) => <button type="button" key={id} onClick={fn} className={`cr-panel text-left p-6 transition hover:-translate-y-1 ${selected === id ? 'border-[#9a84ff88] bg-[#17152f]' : ''}`}><div className="flex items-center justify-between"><Icon size={20} className="text-[#9a84ff]" /><span className="cr-mono text-[9px] tracking-[.1em] text-[#9292ae]">{tag}</span></div><h3 className="mt-12 cr-display text-2xl font-semibold tracking-[-.05em] text-[#f2efff]">{title}</h3><p className="mt-3 min-h-[72px] text-sm leading-6 text-[#9292ae]">{body}</p><span className="mt-7 inline-flex items-center gap-2 cr-mono text-[10px] text-[#9de4ff]">{action} <ArrowUpRight size={13} /></span></button>)}
          </div>
        </section>
        <section className="cr-section">
          <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div><SectionKicker>current availability</SectionKicker><h2 className="cr-section-title mt-5">Use the Playground now. Everything else is source-only.</h2><p className="mt-5 text-sm leading-7 text-[#9292ae]">Crescent is pre-1.0, so the labels matter. The browser path is ready for trying the language; local compiler and editor support are real but not packaged as public downloads yet.</p></div><div className="cr-panel overflow-hidden"><div className="cr-panel-top"><span className="cr-panel-label">what exists today</span><span className="rounded-full border border-[#a09ad633] bg-[#ffffff06] px-2 py-1 cr-mono text-[9px] text-[#9292ae]">CURRENT</span></div><div className="grid divide-y divide-[#a09ad633] md:grid-cols-3 md:divide-x md:divide-y-0">{[['TRY', 'Playground', 'Available now. URL-hash sharing. No account or database.'], ['USE', 'Compiler', 'Not published yet. Built from source in the project repository.'], ['EDIT', 'VS Code', 'Extension v0.2. No LSP and not published to the Marketplace.']].map(([tag, title, body]) => <div key={tag} className="p-5"><span className="cr-mono text-[10px] text-[#9a84ff]">{tag}</span><h3 className="mt-5 text-sm font-bold text-[#eeeef8]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#9292ae]">{body}</p></div>)}</div></div></div>
        </section>
        <section className="cr-section">
          <div className="cr-panel flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center md:p-8"><div><MiniMeta>recommended first step</MiniMeta><h2 className="mt-3 cr-display text-2xl font-semibold tracking-[-.05em] text-[#f2efff]">Open a component. Change one line. Read the compiler feedback.</h2></div><button type="button" onClick={() => goTo('Playground')} className="cr-btn cr-btn-primary shrink-0">Open Playground <ArrowUpRight size={15} /></button></div>
        </section>
      </main>
    </SiteShell>
  );
}
