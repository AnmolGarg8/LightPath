import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outline' | 'alert';
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  footer,
  className = '',
  variant = 'default',
}) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)',
    },
    elevated: {
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-md)',
    },
    outline: {
      backgroundColor: 'transparent',
      border: '1px solid var(--border-color)',
      boxShadow: 'none',
    },
    alert: {
      backgroundColor: 'var(--color-marginal-bg)',
      border: '1px solid var(--color-marginal-border)',
      boxShadow: 'var(--shadow-sm)',
    },
  };

  return (
    <article
      className={`card ${className}`}
      data-testid="card"
      style={{
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        ...variantStyles[variant],
      }}
    >
      {(title || action || subtitle) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            borderBottom: subtitle ? 'none' : '1px solid var(--border-color)',
            paddingBottom: subtitle ? '0' : '0.5rem',
          }}
        >
          <div>
            {typeof title === 'string' ? (
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </header>
      )}

      <div style={{ flex: 1 }}>{children}</div>

      {footer && (
        <footer
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '0.75rem',
            marginTop: 'auto',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          {footer}
        </footer>
      )}
    </article>
  );
};
