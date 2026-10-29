import React, { useState, useEffect } from 'react';
import { HomeView } from './views/HomeView';
import { SiteDetailView } from './views/SiteDetailView';
import { CompareView } from './views/CompareView';
import { RoutePlannerView } from './views/RoutePlannerView';
import { ScanView } from './views/ScanView';
import { EvidenceView } from './views/EvidenceView';
import { TrustView } from './views/TrustView';
import { ExplainView } from './views/ExplainView';

export interface RouteMatch {
  route: string;
  component: React.ReactNode;
}

export function useRouter(): { currentPath: string; view: React.ReactNode } {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const hash = window.location.hash.replace(/^#/, '');
    return hash || '/';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      setCurrentPath(hash || '/');
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Route matching
  let view: React.ReactNode;

  // 1. Home /
  if (currentPath === '/' || currentPath === '') {
    view = <HomeView />;
  }
  // 2. Site /site/:id
  else if (currentPath.startsWith('/site/')) {
    const siteId = currentPath.replace('/site/', '').split('/')[0];
    view = <SiteDetailView siteId={siteId} />;
  }
  // 3. Compare /compare/:a/:b
  else if (currentPath.startsWith('/compare/')) {
    const parts = currentPath.replace('/compare/', '').split('/');
    const siteA = parts[0] || 'synthetic-proving-ground';
    const siteB = parts[1] || 'synthetic-crater-rim';
    view = <CompareView siteAId={siteA} siteBId={siteB} />;
  }
  // 4. Route Traverse /route/:id
  else if (currentPath.startsWith('/route/')) {
    const siteId = currentPath.replace('/route/', '').split('/')[0];
    view = <RoutePlannerView siteId={siteId} />;
  }
  // 5. Area Scan /scan/:id
  else if (currentPath.startsWith('/scan/')) {
    const rawId = currentPath.replace('/scan/', '').split('?')[0];
    const siteId = rawId.split('/')[0] || 'synthetic-proving-ground';
    view = <ScanView siteId={siteId} />;
  }
  // 6. Evidence /evidence/:id
  else if (currentPath.startsWith('/evidence/')) {
    const siteId = currentPath.replace('/evidence/', '').split('/')[0];
    view = <EvidenceView siteId={siteId} />;
  }
  // 6. Trust /trust
  else if (currentPath === '/trust' || currentPath.startsWith('/trust')) {
    view = <TrustView />;
  }
  // 7. Explain /explain
  else if (currentPath === '/explain' || currentPath.startsWith('/explain')) {
    view = <ExplainView />;
  }
  // Fallback
  else {
    view = <HomeView />;
  }

  return { currentPath, view };
}
