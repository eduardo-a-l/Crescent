import { useEffect, useState } from 'react';

export type CrescentPage = 'Home' | 'Setup' | 'Documentation' | 'Playground';

const pathToPage: Record<string, CrescentPage> = {
  '/': 'Home',
  '/setup': 'Setup',
  '/documentation': 'Documentation',
  '/playground': 'Playground',
};

const pageToPath: Record<CrescentPage, string> = {
  Home: '/',
  Setup: '/setup',
  Documentation: '/documentation',
  Playground: '/playground',
};

function resolvePage(pathname: string): CrescentPage {
  return pathToPage[pathname] ?? 'Home';
}

export function pathFor(page: CrescentPage): string {
  return pageToPath[page];
}

export function goTo(page: CrescentPage) {
  const path = pathFor(page);
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo(0, 0);
}

export function useCurrentPage(): CrescentPage {
  const [page, setPage] = useState<CrescentPage>(() => resolvePage(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPage(resolvePage(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return page;
}
