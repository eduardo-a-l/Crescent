import '../site.css';
import { SiteShell } from '../shared/SiteShell';

export function Playground() {
  return (
    <SiteShell active="Playground" fullBleed>
      <iframe
        src="/app/index.html"
        title="Crescent playground"
        className="cr-playground-frame"
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      />
    </SiteShell>
  );
}
