import React, { useState, useId } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      })}

      {isVisible && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(position === 'top' ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            borderRadius: '6px',
            padding: '0.4rem 0.65rem',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
};
