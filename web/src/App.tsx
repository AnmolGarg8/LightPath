import React from 'react';
import { useRouter } from './router';
import { AppLayout } from './components/layout/AppLayout';
import { GuidedDemoOverlay } from './components/common/GuidedDemoOverlay';

export const App: React.FC = () => {
  const { currentPath, view } = useRouter();

  return (
    <AppLayout currentRoute={currentPath} isSynthetic={true}>
      {view}
      <GuidedDemoOverlay />
    </AppLayout>
  );
};
