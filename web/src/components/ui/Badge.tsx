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
  | 'neutral'
  | 'success'
  | 'warning'
  | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  label?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  label,
  children,
  icon,
  className = '',
  size = 'md',
}) => {
  const content = children || label;

  const variantStyles: Record<BadgeVariant, { color: string; bg: string; border: string; symbol: string }> = {
    visible: {
      color: 'var(--color-visible)',
      bg: 'var(--color-visible-bg)',
      border: 'var(--color-visible-border)',
      symbol: '●',
    },
    success: {
      color: 'var(--color-visible)',
      bg: 'var(--color-visible-bg)',
      border: 'var(--color-visible-border)',
      symbol: '✓',
    },
    marginal: {
      color: 'var(--color-marginal)',
      bg: 'var(--color-marginal-bg)',
      border: 'var(--color-marginal-border)',
      symbol: '▲',
    },
    warning: {
      color: 'var(--color-marginal)',
      bg: 'var(--color-marginal-bg)',
      border: 'var(--color-marginal-border)',
      symbol: '⚠',
    },
    blocked: {
      color: 'var(--color-blocked)',
      bg: 'var(--color-blocked-bg)',
      border: 'var(--color-blocked-border)',
      symbol: '■',
    },
    info: {
      color: 'var(--color-earth)',
      bg: 'var(--color-earth-bg)',
      border: 'var(--color-earth-border)',
      symbol: 'ℹ',
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

  const styleConfig = variantStyles[variant] || variantStyles.neutral;
  const paddingMap = {
    sm: '0.15rem 0.45rem',
    md: '0.2rem 0.55rem',
    lg: '0.3rem 0.75rem',
  };
  const fontMap = {
    sm: '0.7rem',
    md: 'var(--text-xs)',
    lg: '0.85rem',
  };

  return (
    <span
      className={`lightpath-badge ${className}`}
      data-testid="badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: paddingMap[size] || paddingMap.md,
        borderRadius: '9999px',
        fontSize: fontMap[size] || fontMap.md,
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
