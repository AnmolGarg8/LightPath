import React from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Select option',
  size = 'md',
}: SegmentedControlProps<T>) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % options.length;
      onChange(options[nextIndex].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + options.length) % options.length;
      onChange(options[prevIndex].value);
    }
  };

  const isSm = size === 'sm';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        padding: '3px',
        gap: '2px',
      }}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: 'var(--font-sans)',
              fontSize: isSm ? 'var(--text-xs)' : 'var(--text-sm)',
              fontWeight: isSelected ? 700 : 500,
              padding: isSm ? '0.25rem 0.6rem' : '0.4rem 0.85rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              color: isSelected ? 'var(--text-inverted)' : 'var(--text-secondary)',
              backgroundColor: isSelected ? 'var(--focus-ring)' : 'transparent',
              transition: 'background-color 0.15s ease, color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.icon && <span aria-hidden="true">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
