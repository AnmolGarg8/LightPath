import React, { useState, useEffect, Suspense, lazy } from 'react';

// Lazy-load individual route views for code splitting and sub-300KB home bundle
const HomeView = lazy(() => import('./views/HomeView').then((m) => ({ default: m.HomeView })));
const SiteDetailView = lazy(() => import('./views/SiteDetailView').then((m) => ({ default: m.SiteDetailView })));
const CompareView = lazy(() => import('./views/CompareView').then((m) => ({ default: m.CompareView })));
const RoutePlannerView = lazy(() => import('./views/RoutePlannerView').then((m) => ({ default: m.RoutePlannerView })));
const ScanView = lazy(() => import('./views/ScanView').then((m) => ({ default: m.ScanView })));
const EvidenceView = lazy(() => import('./views/EvidenceView').then((m) => ({ default: m.EvidenceView })));
const TrustView = lazy(() => import('./views/TrustView').then((m) => ({ default: m.TrustView })));
const ExplainView = lazy(() => import('./views/ExplainView').then((m) => ({ default: m.ExplainView })));

export interface RouteMatch {
  route: string;
  component: React.ReactNode;
}

const RouteLoadingFallback: React.FC = () => (
  <div
    style={{
      padding: '3rem 1.5rem',
      textAlign: 'center',
      color: 'var(--text-secondary)',
      fontSize: '0.95rem',
    }}
    role="status"
    aria-live="polite"
  >
    <div className="skeleton-line" style={{ width: '40%', margin: '0 auto 1rem auto', height: '24px' }} />
    <div className="skeleton-line" style={{ width: '60%', margin: '0 auto', height: '16px' }} />
    <p style={{ marginTop: '1rem' }}>Loading scientific analysis view...</p>
  </div>
);

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

  // Separate route path from query parameters (?demo=1, ?kiosk=1, etc.)
  const [rawRoute] = currentPath.split('?');
  const cleanPath = (rawRoute || '/').replace(/\/+$/, '') || '/';

  // Route matching
  let view: React.ReactNode;

  // 1. Home /
  if (cleanPath === '/' || cleanPath === '') {
    view = <HomeView />;
  }
  // 2. Site /site/:id
  else if (cleanPath.startsWith('/site/')) {
    const siteId = cleanPath.replace('/site/', '').split('/')[0];
    view = <SiteDetailView siteId={siteId} />;
  }
  // 3. Compare /compare or /compare/:a/:b
  else if (cleanPath === '/compare' || cleanPath.startsWith('/compare/')) {
    const sub = cleanPath.replace('/compare/', '').replace('/compare', '');
    const parts = sub ? sub.split('/') : [];
    const siteA = parts[0] || 'synthetic-proving-ground';
    const siteB = parts[1] || 'synthetic-crater-rim';
    view = <CompareView siteAId={siteA} siteBId={siteB} />;
  }
  // 4. Route Traverse /route/:id
  else if (cleanPath.startsWith('/route/')) {
    const siteId = cleanPath.replace('/route/', '').split('/')[0];
    view = <RoutePlannerView siteId={siteId} />;
  }
  // 5. Area Scan /scan/:id
  else if (cleanPath.startsWith('/scan/')) {
    const siteId = cleanPath.replace('/scan/', '').split('/')[0] || 'synthetic-proving-ground';
    view = <ScanView siteId={siteId} />;
  }
  // 6. Evidence /evidence/:id
  else if (cleanPath.startsWith('/evidence/')) {
    const siteId = cleanPath.replace('/evidence/', '').split('/')[0];
    view = <EvidenceView siteId={siteId} />;
  }
  // 7. Trust /trust
  else if (cleanPath === '/trust' || cleanPath.startsWith('/trust')) {
    view = <TrustView />;
  }
  // 8. Explain /explain
  else if (cleanPath === '/explain' || cleanPath.startsWith('/explain')) {
    view = <ExplainView />;
  }
  // Fallback
  else {
    view = <HomeView />;
  }

  return {
    currentPath,
    view: <Suspense fallback={<RouteLoadingFallback />}>{view}</Suspense>,
  };
}
