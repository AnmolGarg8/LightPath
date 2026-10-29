import React from 'react';

interface StatProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  description?: string;
  alertText?: string;
  variant?: 'neutral' | 'sun' | 'earth' | 'joint' | 'alert' | 'success';
  onClick?: () => void;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  unit,
  description,
  alertText,
  variant = 'neutral',
  onClick,
  className = '',
}) => {
  const variantColorMap: Record<string, string> = {
    neutral: 'var(--text-primary)',
    sun: 'var(--color-sun)',
    earth: 'var(--color-earth)',
    joint: 'var(--color-joint)',
    alert: 'var(--color-blocked)',
    success: 'var(--color-visible)',
  };

  const color = variantColorMap[variant] || 'var(--text-primary)';

  return (
    <div
      className={`stat-box ${className}`}
      data-testid="stat-box"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
        <span
          className="mono"
          style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 800,
            lineHeight: 1.1,
            color,
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-muted)',
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {alertText && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--color-blocked)',
            marginTop: '0.2rem',
          }}
        >
          <span aria-hidden="true">⚠</span>
          <span>{alertText}</span>
        </div>
      )}

      {description && (
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            margin: '0.2rem 0 0 0',
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      )}

      {onClick && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--focus-ring)',
            fontWeight: 600,
            marginTop: '0.25rem',
            textDecoration: 'underline',
          }}
        >
          View detailed calculations →
        </span>
      )}
    </div>
  );
};
