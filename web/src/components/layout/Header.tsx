import React, { useState, useEffect } from 'react';

interface HeaderProps {
  currentRoute: string;
}

export const Header: React.FC<HeaderProps> = ({ currentRoute }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Read stored theme or system preference
    const stored = localStorage.getItem('lightpath_theme') as 'dark' | 'light' | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('lightpath_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const navLinks = [
    { href: '#/', label: 'Mission Browser' },
    { href: '#/compare/synthetic-proving-ground/synthetic-crater-rim', label: 'Compare Sites' },
    { href: '#/scan/synthetic-proving-ground', label: 'Area Scan' },
    { href: '#/route/synthetic-proving-ground', label: 'Route Planner' },
    { href: '#/explain', label: 'How It Works' },
    { href: '#/?demo=1', label: '90s Demo' },
    { href: '#/trust', label: 'Trust & Benchmarks' },
  ];

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '4rem',
        }}
      >
        {/* Brand / Logo */}
        <a
          href="#/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              borderRadius: '6px',
              backgroundColor: 'var(--focus-ring)',
              color: '#070a12',
              fontWeight: 800,
              fontSize: '1.1rem',
            }}
            aria-hidden="true"
          >
            ☾
          </span>
          <div>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                fontSize: 'var(--text-lg)',
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              LightPath
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--focus-ring)',
                marginTop: '-2px',
              }}
            >
              CLPS Lunar Mission Browser
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Main navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          }}
          className="desktop-nav"
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === '#/'
                ? currentRoute === '/' || currentRoute === ''
                : currentRoute.startsWith(link.href.replace('#', ''));
            return (
              <a
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--focus-ring)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid var(--focus-ring)' : '2px solid transparent',
                  padding: '0.4rem 0',
                  transition: 'color 0.15s ease',
                }}
              >
                {link.label}
              </a>
            );
          })}

          {/* Theme switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.65rem', fontSize: 'var(--text-xs)' }}
          >
            {theme === 'dark' ? '☼ Light' : '☾ Dark'}
          </button>
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          className="btn btn-outline mobile-nav-btn"
          style={{ display: 'none', padding: '0.4rem 0.6rem' }}
        >
          ☰
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              toggleTheme();
              setMobileMenuOpen(false);
            }}
            className="btn btn-outline"
            style={{ marginTop: '0.5rem' }}
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav-btn { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
};
