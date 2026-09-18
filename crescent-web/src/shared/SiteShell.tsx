import { ArrowUpRight, ChevronRight, CirclePlay, Copy, Download, ExternalLink, FileCode2, Github, Menu, Moon, Play, Radio, Sparkles, Terminal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { goTo, pathFor, type CrescentPage } from '../router';

export type { CrescentPage };

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={pathFor('Home')}
      onClick={(e) => {
        e.preventDefault();
        goTo('Home');
      }}
      className="cr-brand"
      aria-label="Crescent home"
    >
      <img src="/images/crescent-logo.svg" alt="" />
      <span className="cr-brand-word">crescent</span>
      {!compact && <span className="cr-brand-sub">language / 0.x</span>}
    </a>
  );
}

function NavLink({ page, active }: { page: CrescentPage; active: boolean }) {
  return (
    <a
      href={pathFor(page)}
      onClick={(e) => {
        e.preventDefault();
        goTo(page);
      }}
      className={`cr-navlink ${active ? 'active' : ''}`}
    >
      {page}
    </a>
  );
}

export function SiteShell({ active, children, fullBleed = false }: { active: CrescentPage; children: ReactNode; fullBleed?: boolean }) {
  const pages: CrescentPage[] = ['Home', 'Setup', 'Documentation', 'Playground'];
  const header = (
    <>
      <header className="cr-nav">
        <BrandMark />
        <nav className="cr-navlinks" aria-label="Primary navigation">
          {pages.map((page) => (
            <NavLink key={page} page={page} active={active === page} />
          ))}
          <span className="cr-status"><i /> pre-1.0 · compiler 0.1.0</span>
        </nav>
        <button type="button" className="cr-btn cr-btn-quiet md:hidden" aria-label="Open navigation"><Menu size={16} /></button>
      </header>
      <nav className="cr-mobile-nav" aria-label="Mobile navigation">
        {pages.map((page) => (
          <NavLink key={page} page={page} active={active === page} />
        ))}
      </nav>
    </>
  );

  if (fullBleed) {
    return (
      <div className="cr-site cr-site-fullbleed">
        <div className="cr-wrap">{header}</div>
        <div className="cr-fullbleed-body">{children}</div>
      </div>
    );
  }

  return (
    <div className="cr-site">
      <div className="cr-wrap">
        {header}
        {children}
        <footer className="cr-footer">
          <div className="cr-footer-row">
            <span className="cr-mono">Crescent / a language for the browser</span>
            <span>Compiler v0.1.0 · TypeScript today · JavaScript output</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function SectionKicker({ children }: { children: ReactNode }) {
  return <span className="cr-kicker">{children}</span>;
}

export function CodePanel({ title = 'counter.crs', code, footer = 'compiled in 42ms · no errors', children }: { title?: string; code?: ReactNode; footer?: string; children?: ReactNode }) {
  return (
    <div className="cr-panel overflow-hidden">
      <div className="cr-panel-top"><div className="cr-window-dots"><i /><i /><i /></div><span className="cr-panel-label">{title}</span><span className="cr-panel-label">CRESCENT</span></div>
      <div className="p-5 md:p-6"><div className="cr-code">{children ?? code}</div></div>
      <div className="cr-terminal"><div className="cr-terminal-line">{footer}</div></div>
    </div>
  );
}

export function CodeLines({ lines }: { lines: React.ReactNode[] }) {
  return <>{lines.map((line, index) => <div className="cr-code-line" key={index}><span className="cr-line-no">{index + 1}</span><span className="cr-code-content">{line}</span></div>)}</>;
}

export function PageTitle({ kicker, title, copy, actions }: { kicker: string; title: React.ReactNode; copy: string; actions?: React.ReactNode }) {
  return (
    <section className="relative py-20 md:py-28">
      <SectionKicker>{kicker}</SectionKicker>
      <h1 className="cr-hero-title cr-reveal">{title}</h1>
      <p className="cr-lede cr-reveal cr-reveal-2">{copy}</p>
      {actions && <div className="mt-8 flex flex-wrap gap-3 cr-reveal cr-reveal-3">{actions}</div>}
    </section>
  );
}

export function MiniMeta({ icon: Icon = Radio, children }: { icon?: typeof Radio; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 cr-mono text-[10px] uppercase tracking-[.1em] text-[#9292ae]"><Icon size={12} className="text-[#9a84ff]" />{children}</span>;
}

export { ArrowUpRight, ChevronRight, CirclePlay, Copy, Download, ExternalLink, FileCode2, Github, Moon, Play, Radio, Sparkles, Terminal, X };
