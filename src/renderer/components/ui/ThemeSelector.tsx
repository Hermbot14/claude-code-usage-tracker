import { useState, useEffect } from 'react'

const THEMES = [
  { id: 'default', name: 'Default', colors: { primary: '#A5A66A', bg: '#F2F2ED' } },
  { id: 'dusk', name: 'Dusk', colors: { primary: '#B8B978', bg: '#F5F5F0' } },
  { id: 'lime', name: 'Lime', colors: { primary: '#7C3AED', bg: '#E8F5A3' } },
  { id: 'ocean', name: 'Ocean', colors: { primary: '#0284C7', bg: '#E0F2FE' } },
  { id: 'retro', name: 'Retro', colors: { primary: '#D97706', bg: '#FEF3C7' } },
  { id: 'neo', name: 'Neo', colors: { primary: '#D946EF', bg: '#FDF4FF' } },
  { id: 'forest', name: 'Forest', colors: { primary: '#16A34A', bg: '#DCFCE7' } }
]

export function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('default')
  const [isDark, setIsDark] = useState(false)

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('usage-tracker-theme') || 'default'
    const savedDark = localStorage.getItem('usage-tracker-dark') === 'true'
    setCurrentTheme(savedTheme)
    setIsDark(savedDark)
    applyTheme(savedTheme, savedDark)
  }, [])

  const applyTheme = (theme: string, dark: boolean) => {
    const root = document.documentElement
    // Apply theme
    if (theme !== 'default') {
      root.setAttribute('data-theme', theme)
    } else {
      root.removeAttribute('data-theme')
    }
    // Apply dark mode
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme)
    localStorage.setItem('usage-tracker-theme', theme)
    applyTheme(theme, isDark)
    setIsOpen(false)
  }

  const handleDarkModeToggle = () => {
    const newDark = !isDark
    setIsDark(newDark)
    localStorage.setItem('usage-tracker-dark', String(newDark))
    applyTheme(currentTheme, newDark)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }

  const currentThemeData = THEMES.find(t => t.id === currentTheme) || THEMES[0]

  return (
    <div style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      {/* Theme Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Theme: ${currentThemeData.name}. Click to change.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={currentThemeData.name}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-surface-card)',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-card)'}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: currentThemeData.colors.primary,
            border: '2px solid var(--color-border-default)'
          }}
        />
      </button>

      {/* Theme Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40
            }}
          />

          {/* Dropdown Menu */}
          <div
            role="listbox"
            aria-label="Theme selection"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: '8px',
              zIndex: 50,
              minWidth: '200px'
            }}
          >
            {/* Dark Mode Toggle */}
            <button
              onClick={handleDarkModeToggle}
              role="option"
              aria-checked={isDark}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: isDark ? 'var(--color-background-secondary)' : 'transparent',
                cursor: 'pointer',
                marginBottom: '8px',
                fontSize: '14px',
                color: 'var(--color-text-primary)'
              }}
            >
              {isDark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {/* Theme Options */}
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                role="option"
                aria-selected={currentTheme === theme.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: currentTheme === theme.id ? 'var(--color-accent-primary-light)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--color-text-primary)'
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: theme.colors.primary,
                    border: `2px solid ${currentTheme === theme.id ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`
                  }}
                />
                <span>{theme.name}</span>
                {currentTheme === theme.id && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
