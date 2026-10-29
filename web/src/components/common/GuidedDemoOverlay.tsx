/**
 * Guided Demo Controller & Overlay (?demo=1 / ?kiosk=1)
 * 
 * Complies with Prompt 14:
 * - Eight scripted steps with captions and pause key (spacebar or button).
 * - Automatic route transitions between views.
 * - In kiosk mode (?kiosk=1): hides editing controls and auto-loops.
 * - Keyboard navigation (Left/Right arrows, Space to pause).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DEMO_STEPS, DemoStep } from '../../data/demoScript';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  X,
  Sparkles,
} from 'lucide-react';

export const GuidedDemoOverlay: React.FC = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isKiosk, setIsKiosk] = useState<boolean>(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(10);

  // Detect ?demo=1 or ?kiosk=1 in URL or hash
  const checkUrlParams = useCallback(() => {
    const fullUrl = window.location.href;
    const hasDemo = fullUrl.includes('demo=1');
    const hasKiosk = fullUrl.includes('kiosk=1');

    if (hasDemo || hasKiosk) {
      setIsActive(true);
      setIsKiosk(hasKiosk);
    }
  }, []);

  useEffect(() => {
    checkUrlParams();
    window.addEventListener('hashchange', checkUrlParams);
    return () => window.removeEventListener('hashchange', checkUrlParams);
  }, [checkUrlParams]);

  const currentStep: DemoStep = DEMO_STEPS[currentStepIdx] || DEMO_STEPS[0];

  // Navigate to step route when step changes
  useEffect(() => {
    if (!isActive) return;

    setRemainingSeconds(currentStep.durationSeconds);

    // Update window hash to target route while preserving demo/kiosk query
    const targetBase = currentStep.route.split('?')[0];
    const param = isKiosk ? 'kiosk=1' : 'demo=1';
    const targetHash = `${targetBase}?${param}`;

    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, [currentStepIdx, isActive, isKiosk, currentStep]);

  // Step timer
  useEffect(() => {
    if (!isActive || isPaused) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Advance to next step or loop in kiosk mode
          setCurrentStepIdx((idx) => {
            if (idx + 1 < DEMO_STEPS.length) {
              return idx + 1;
            }
            return isKiosk ? 0 : idx;
          });
          return currentStep.durationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, isPaused, isKiosk, currentStep]);

  // Keyboard navigation listener (Space = Pause, Arrow Right = Next, Arrow Left = Prev)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentStepIdx((idx) => Math.min(DEMO_STEPS.length - 1, idx + 1));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentStepIdx((idx) => Math.max(0, idx - 1));
      } else if (e.code === 'Escape' && !isKiosk) {
        setIsActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isKiosk]);

  if (!isActive) return null;

  const progressPct = ((currentStep.durationSeconds - remainingSeconds) / currentStep.durationSeconds) * 100;

  return (
    <div
      className="guided-demo-bar"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '92%',
        maxWidth: '880px',
        backgroundColor: 'rgba(10, 14, 23, 0.94)',
        border: '2px solid var(--accent-primary)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 240, 255, 0.25)',
        zIndex: 9999,
        backdropFilter: 'blur(12px)',
        color: '#ffffff',
      }}
    >
      {/* Step progress bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderTopLeftRadius: '10px',
          borderTopRightRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPct}%`,
            backgroundColor: 'var(--accent-primary)',
            transition: 'width 1s linear',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <Sparkles size={13} />
              {isKiosk ? 'KIOSK EXHIBIT MODE' : 'EXECUTIVE 90-SECOND DEMO'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              • Step {currentStepIdx + 1} of {DEMO_STEPS.length} ({remainingSeconds}s)
            </span>
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.3rem 0', color: '#ffffff' }}>
            {currentStep.title}
          </h3>

          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.45, maxWidth: '640px' }}>
            {currentStep.caption}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginTop: '0.25rem' }}>
          <button
            onClick={() => setCurrentStepIdx((idx) => Math.max(0, idx - 1))}
            disabled={currentStepIdx === 0}
            className="btn btn-secondary"
            title="Previous Step (Left Arrow)"
            style={{ padding: '0.4rem', borderRadius: '6px' }}
          >
            <SkipBack size={15} />
          </button>

          <button
            onClick={() => setIsPaused((p) => !p)}
            className="btn btn-primary"
            title="Pause / Resume (Spacebar)"
            style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 700 }}
          >
            {isPaused ? <Play size={15} /> : <Pause size={15} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={() => setCurrentStepIdx((idx) => Math.min(DEMO_STEPS.length - 1, idx + 1))}
            disabled={currentStepIdx === DEMO_STEPS.length - 1 && !isKiosk}
            className="btn btn-secondary"
            title="Next Step (Right Arrow)"
            style={{ padding: '0.4rem', borderRadius: '6px' }}
          >
            <SkipForward size={15} />
          </button>

          {!isKiosk && (
            <button
              onClick={() => {
                setIsActive(false);
                window.location.hash = window.location.hash.replace(/[?&](demo|kiosk)=1/, '');
              }}
              className="btn btn-secondary"
              title="Exit Guided Demo (Esc)"
              style={{ padding: '0.4rem', borderRadius: '6px', marginLeft: '0.25rem' }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
