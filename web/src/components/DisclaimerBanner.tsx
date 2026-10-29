import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface Props {
  isSynthetic: boolean;
}

export const DisclaimerBanner: React.FC<Props> = ({ isSynthetic }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
      {/* Non-Negotiable Operational Disclaimer */}
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.7)',
          borderLeft: '4px solid #38bdf8',
          padding: '0.75rem 1rem',
          borderRadius: '0 0.5rem 0.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
          color: '#cbd5e1',
        }}
      >
        <Info size={18} style={{ color: '#38bdf8', flexShrink: 0 }} />
        <span>
          <strong>Operational Notice:</strong> LightPath is a preliminary planning and education tool.
          Sun visibility is not electrical power. Earth visibility is not a link budget. It is not for
          flight operations and does not certify landing or traverse safety.
        </span>
      </div>

      {/* Synthetic / Unverified Data Banner (Rule 3) */}
      {isSynthetic && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderLeft: '4px solid #ef4444',
            padding: '0.75rem 1rem',
            borderRadius: '0 0.5rem 0.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            color: '#fca5a5',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span>
            <strong>SYNTHETIC / UNVERIFIED DATA ACTIVE:</strong> This site contains synthetic or benchmark
            placeholder data (<span className="mono">is_synthetic = true</span>) and must not be treated as real flight data.
          </span>
        </div>
      )}
    </div>
  );
};
