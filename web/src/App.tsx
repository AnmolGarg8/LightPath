// Portions of this code were generated with AI assistance (see docs/AI_DISCLOSURE.md)
import React from 'react';
import { useRouter } from './router';
import { AppLayout } from './components/layout/AppLayout';
import { GuidedDemoOverlay } from './components/common/GuidedDemoOverlay';

export const App: React.FC = () => {
  const { currentPath, view } = useRouter();
  const isSyntheticRoute = currentPath.includes('synthetic');

  return (
    <AppLayout currentRoute={currentPath} isSynthetic={isSyntheticRoute}>
      {view}
      <GuidedDemoOverlay />
    </AppLayout>
  );
};
