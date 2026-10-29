import React from 'react';
import { useRouter } from './router';
import { AppLayout } from './components/layout/AppLayout';

export const App: React.FC = () => {
  const { currentPath, view } = useRouter();

  return (
    <AppLayout currentRoute={currentPath} isSynthetic={true}>
      {view}
    </AppLayout>
  );
};
