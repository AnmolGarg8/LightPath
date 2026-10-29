import React from 'react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  const typeConfig: Record<string, { bg: string; border: string; icon: string }> = {
    info: { bg: 'var(--color-earth-bg)', border: 'var(--color-earth-border)', icon: 'ℹ' },
    success: { bg: 'var(--color-visible-bg)', border: 'var(--color-visible-border)', icon: '✓' },
    warning: { bg: 'var(--color-marginal-bg)', border: 'var(--color-marginal-border)', icon: '⚠' },
    error: { bg: 'var(--color-blocked-bg)', border: 'var(--color-blocked-border)', icon: '✕' },
  };

  return (
    <aside
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        zIndex: 9999,
        maxWidth: '420px',
        width: 'calc(100% - 3rem)',
      }}
    >
      {toasts.map((toast) => {
        const conf = typeConfig[toast.type] || typeConfig.info;
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${conf.border}`,
              borderLeft: `4px solid ${conf.border}`,
              boxShadow: 'var(--shadow-lg)',
              borderRadius: '6px',
              padding: '0.85rem 1.1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '1.1em', marginTop: '0.1rem' }}>
              {conf.icon}
            </span>
            <div style={{ flex: 1 }}>
              {toast.title && (
                <strong style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  {toast.title}
                </strong>
              )}
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                {toast.message}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss alert"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.1em',
                lineHeight: 1,
                padding: '0.2rem',
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </aside>
  );
};
