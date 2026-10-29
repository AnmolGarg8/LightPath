import React, { useId } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  ticks?: number[];
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  ticks,
  disabled = false,
}) => {
  const sliderId = useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 'var(--text-sm)',
        }}
      >
        <label htmlFor={sliderId} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}
        </label>
        <span
          className="mono"
          style={{
            fontWeight: 700,
            color: 'var(--focus-ring)',
            fontSize: 'var(--text-base)',
          }}
          aria-live="polite"
        >
          {value} {unit}
        </span>
      </div>

      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--focus-ring)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          height: '6px',
          borderRadius: '3px',
        }}
      />

      {ticks && ticks.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: '0.1rem',
          }}
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              onClick={() => !disabled && onChange(t)}
              style={{ cursor: disabled ? 'default' : 'pointer' }}
            >
              {t}{unit}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
