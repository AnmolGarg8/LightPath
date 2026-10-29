import React from 'react';

interface DisclaimerBannerProps {
  isSynthetic?: boolean;
  isUnverified?: boolean;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({
  isSynthetic = true,
  isUnverified = true,
}) => {
  // Always present permanent non-dismissible banner when synthetic or unverified
  if (!isSynthetic && !isUnverified) {
    return null;
  }

  return (
    <aside
      className="disclaimer-banner"
      role="region"
      aria-label="Simulation Data Disclaimer"
      data-testid="permanent-disclaimer-banner"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span aria-hidden="true" style={{ fontSize: '1.25em' }}>
          ⚠
        </span>
        <span>
          <strong>PERMANENT SCIENTIFIC NOTICE:</strong> Displaying{' '}
          {isSynthetic ? 'synthetic demo proving-ground data' : 'preliminary simulation data'}.{' '}
          Sun visibility is not electrical power. Earth visibility is not a link budget. Not certified for flight operations.
        </span>
      </div>
      <a
        href="#/explain"
        style={{
          color: 'inherit',
          fontWeight: 700,
          textDecoration: 'underline',
          whiteSpace: 'nowrap',
          fontSize: 'var(--text-xs)',
        }}
      >
        Read Operational Limitations →
      </a>
    </aside>
  );
};
