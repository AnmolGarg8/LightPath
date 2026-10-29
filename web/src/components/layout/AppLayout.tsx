import React from 'react';
import { Header } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { Footer } from './Footer';

interface AppLayoutProps {
  currentRoute: string;
  isSynthetic?: boolean;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentRoute,
  isSynthetic = true,
  children,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <DisclaimerBanner isSynthetic={isSynthetic} isUnverified={true} />
      <Header currentRoute={currentRoute} />
      <main style={{ flex: 1, padding: '1.5rem 0 3rem 0' }} id="main-content">
        <div className="container">{children}</div>
      </main>
      <Footer />
    </div>
  );
};
