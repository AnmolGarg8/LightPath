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

  return {
    currentPath,
    view: <Suspense fallback={<RouteLoadingFallback />}>{view}</Suspense>,
  };
}
