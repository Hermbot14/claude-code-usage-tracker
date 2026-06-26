import { useState, useEffect } from 'react'
import { AccountsView } from '@components/AccountsView'
import { SettingsPanel } from '@components/SettingsPanel'
import { ThemeSelector } from '@components/ui/ThemeSelector'
import { UsageOverlay } from '@components/UsageOverlay'
import { useUsageStore } from '@stores/useUsageStore'
import { useAccountsData } from '@hooks/useAccountsData'

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { settings, updateSettings } = useUsageStore()

  // Drive multi-account discovery + polling.
  useAccountsData()

  // Check system preference for dark mode and load saved theme
  useEffect(() => {
    const savedDark = localStorage.getItem('usage-tracker-dark') === 'true'
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = savedDark || prefersDark
    setIsDarkMode(dark)

    if (dark) {
      document.documentElement.classList.add('dark')
    }

    const savedTheme = localStorage.getItem('usage-tracker-theme')
    if (savedTheme && savedTheme !== 'default') {
      document.documentElement.setAttribute('data-theme', savedTheme)
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('usage-tracker-dark')) {
        const newDark = e.matches
        setIsDarkMode(newDark)
        if (newDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const toggleDarkMode = () => {
    const newDark = !isDarkMode
    setIsDarkMode(newDark)
    localStorage.setItem('usage-tracker-dark', String(newDark))
    if (newDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Handler to expand from overlay mode back to the full desktop window.
  // Persist enabled=false FIRST (so the recreated window's renderer reloads in
  // dashboard mode), then ask main to recreate the normal window.
  const handleExpandFromOverlay = async () => {
    await updateSettings({ overlayMode: { ...settings.overlayMode, enabled: false } })
    await window.api.setOverlayMode(false)
  }

  // Check if overlay mode is enabled
  const isOverlayMode = settings.overlayMode.enabled

  // Conditional rendering: overlay mode vs full UI
  if (isOverlayMode) {
    return <UsageOverlay onExpand={handleExpandFromOverlay} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-background-primary)',
      padding: '16px',
      transition: 'background-color 0.3s ease'
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header */}
        <header style={{
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: 0 }}>
            <div style={{
              width: '40px',
              height: '40px',
              flexShrink: 0,
              background: 'linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-primary-hover) 100%)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <h1 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--color-text-primary)',
                margin: 0,
                lineHeight: '1.2',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Usage Tracker
              </h1>
              <p style={{
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                margin: 0,
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Coding-Plan Usage Monitor
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <ThemeSelector />
            <button
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {isDarkMode ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open settings"
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button
              onClick={() => window.api.minimizeToTray()}
              aria-label="Minimize to tray"
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <AccountsView onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Footer */}
        <footer style={{
          textAlign: 'center',
          padding: '16px'
        }}>
          <p style={{
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            margin: 0
          }}>
            Running in background. Access anytime from the system tray.
          </p>
        </footer>
      </div>

      {/* Settings Modal */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default App
