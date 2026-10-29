import React from 'react';
import { DataValidationError } from '../../types/schemas';

interface ValidationErrorPageProps {
  error: DataValidationError | Error;
  onRetry?: () => void;
}

export const ValidationErrorPage: React.FC<ValidationErrorPageProps> = ({ error, onRetry }) => {
  const isSchemaError = error instanceof DataValidationError;

  return (
    <div
      role="alert"
      style={{
        maxWidth: '800px',
        margin: '3rem auto',
        padding: '2rem',
        backgroundColor: 'var(--bg-card)',
        border: '2px solid var(--color-blocked)',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span aria-hidden="true" style={{ fontSize: '2rem', color: 'var(--color-blocked)' }}>
          ⚠
        </span>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-blocked)', margin: 0 }}>
            Scientific Data Contract Failure
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            LightPath enforces strict JSON schema contract validation before displaying celestial data.
          </p>
        </div>
      </div>

      {isSchemaError ? (
        <>
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '6px',
              marginBottom: '1.25rem',
              fontSize: 'var(--text-sm)',
            }}
          >
            <strong>Offending Source File:</strong> <code className="mono">{error.sourceFile}</code>
          </div>

          <h3 style={{ fontSize: 'var(--text-base)', marginBottom: '0.5rem' }}>Failing Schema Fields:</h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginBottom: '1.5rem',
            }}
          >
            {error.details.map((detail, idx) => (
              <li
                key={idx}
                style={{
                  padding: '0.6rem 0.85rem',
                  backgroundColor: 'var(--color-blocked-bg)',
                  border: '1px solid var(--color-blocked-border)',
                  borderRadius: '4px',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-blocked)' }}>
                  Field Path: <code>{detail.fieldPath}</code>
                </div>
                <div style={{ color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  Diagnosis: {detail.message} (Rule Code: {detail.code})
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: 'var(--text-sm)',
          }}
        >
          <strong>Error Details:</strong> {error.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            ↻ Retry Data Fetch
          </button>
        )}
        <a href="#/" className="btn btn-secondary">
          Return to Mission Browser
        </a>
      </div>
    </div>
  );
};
