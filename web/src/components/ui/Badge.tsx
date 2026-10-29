import React from 'react';

export type BadgeVariant =
  | 'visible'
  | 'marginal'
  | 'blocked'
  | 'sun'
  | 'earth'
  | 'joint'
  | 'synthetic'
  | 'unverified'
  | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  label?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  label,
  children,
  icon,
  className = '',
}) => {
  const content = children || label;

  const variantStyles: Record<BadgeVariant, { color: string; bg: string; border: string; symbol: string }> = {
    visible: {
      color: 'var(--color-visible)',
      bg: 'var(--color-visible-bg)',
      border: 'var(--color-visible-border)',
      symbol: '●',
    },
    marginal: {
      color: 'var(--color-marginal)',
      bg: 'var(--color-marginal-bg)',
      border: 'var(--color-marginal-border)',
      symbol: '▲',
    },
    blocked: {
      color: 'var(--color-blocked)',
      bg: 'var(--color-blocked-bg)',
      border: 'var(--color-blocked-border)',
      symbol: '■',
    },
    sun: {
      color: 'var(--color-sun)',
      bg: 'var(--color-sun-bg)',
      border: 'var(--color-sun-border)',
      symbol: '☼',
    },
    earth: {
      color: 'var(--color-earth)',
      bg: 'var(--color-earth-bg)',
      border: 'var(--color-earth-border)',
      symbol: '⊕',
    },
    joint: {
      color: 'var(--color-joint)',
      bg: 'var(--color-joint-bg)',
      border: 'var(--color-joint-border)',
      symbol: '☍',
    },
    synthetic: {
      color: 'var(--color-synthetic)',
      bg: 'var(--color-synthetic-bg)',
      border: 'var(--color-synthetic-border)',
      symbol: '✦',
    },
    unverified: {
      color: 'var(--color-marginal)',
      bg: 'var(--color-marginal-bg)',
      border: 'var(--color-marginal-border)',
      symbol: '⚠',
    },
    neutral: {
      color: 'var(--text-secondary)',
      bg: 'var(--bg-surface)',
      border: 'var(--border-color)',
      symbol: '•',
    },
  };

  const styleConfig = variantStyles[variant];

  return (
    <span
      className={`lightpath-badge ${className}`}
      data-testid="badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '9999px',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        letterSpacing: '0.03em',
        color: styleConfig.color,
        backgroundColor: styleConfig.bg,
        border: `1px solid ${styleConfig.border}`,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {icon ? (
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" style={{ fontSize: '0.75em' }}>
          {styleConfig.symbol}
        </span>
      )}
      <span>{content}</span>
    </span>
  );
};
