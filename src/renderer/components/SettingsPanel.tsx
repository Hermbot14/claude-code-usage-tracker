import { useState, useEffect } from 'react'
import { useUsageStore } from '@stores/useUsageStore'
import { AccountsManager } from './AccountsManager'
import { Badge } from './ui/Badge'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useUsageStore()
  const [localSettings, setLocalSettings] = useState({ ...settings })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Reset local settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings({ ...settings })
    }
  }, [isOpen, settings])

  const handleChange = (field: keyof typeof localSettings, value: any) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }))
  }

  // Handle overlay mode toggle - requires window recreation via IPC
  const handleOverlayModeToggle = async (enabled: boolean) => {
    // Update local state first
    handleChange('overlayMode', { ...localSettings.overlayMode, enabled })

    // Call IPC handler to recreate window with overlay mode
    const result = await window.api.setOverlayMode(enabled)
    if (result.success) {
      // Save settings after window recreation
      await updateSettings({ overlayMode: { ...localSettings.overlayMode, enabled } })
    }
  }

  // Handle click-through toggle - requires IPC call
  const handleClickThroughToggle = async (enabled: boolean) => {
    // Update local state
    handleChange('overlayMode', { ...localSettings.overlayMode, clickThrough: enabled })

    // Call IPC handler to set click-through
    const result = await window.api.setClickThrough(enabled)
    if (result.success) {
      // Save settings
      await updateSettings({ overlayMode: { ...localSettings.overlayMode, clickThrough: enabled } })
    }
  }

  // Handle overlay position change - requires IPC call
  const handleOverlayPositionChange = async (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    // Update local state
    handleChange('overlayMode', { ...localSettings.overlayMode, position })

    // Only call IPC if overlay mode is currently enabled
    if (localSettings.overlayMode.enabled) {
      await window.api.setOverlayPosition(position)
    }

    // Save settings
    await updateSettings({ overlayMode: { ...localSettings.overlayMode, position } })
  }

  // Handle overlay opacity change - apply live + persist
  const handleOverlayOpacityChange = async (opacity: number) => {
    handleChange('overlayMode', { ...localSettings.overlayMode, opacity })
    if (localSettings.overlayMode.enabled) {
      await window.api.setOverlayOpacity(opacity)
    }
    await updateSettings({ overlayMode: { ...localSettings.overlayMode, opacity } })
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      // First save the settings
      await updateSettings(localSettings)

      // Small delay to ensure settings are persisted and state is updated
      await new Promise(resolve => setTimeout(resolve, 100))

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Accounts drive polling now; the interval picks up new settings automatically.

      // Close the panel after successful save
      setTimeout(() => onClose(), 500)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  const maskApiKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 16) return key.slice(0, 4) + '...' + key.slice(-2)
    return key.slice(0, 8) + '...' + key.slice(-4)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-surface-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          borderBottom: '1px solid var(--color-border-default)'
        }}>
          <h2 id="settings-title" style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--color-text-primary)',
            margin: 0
          }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
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
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Accounts */}
          <AccountsManager />

          {/* Refresh Settings */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              margin: '0 0 12px'
            }}>
              Refresh Settings
            </h3>
            <div>
              <label htmlFor="refreshInterval" style={{
                display: 'block',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                marginBottom: '6px'
              }}>
                Refresh Interval: {localSettings.refreshInterval} seconds
              </label>
              <input
                id="refreshInterval"
                type="range"
                min="10"
                max="300"
                step="10"
                value={localSettings.refreshInterval}
                onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--color-accent-primary)'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>10s</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>5 min</span>
              </div>
            </div>
          </div>

          {/* Alert Thresholds */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              margin: '0 0 12px'
            }}>
              Alert Thresholds
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[80, 90, 100].map((threshold) => (
                <label
                  key={threshold}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: localSettings.alertThresholds.includes(threshold) ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-default)',
                    backgroundColor: localSettings.alertThresholds.includes(threshold) ? 'var(--color-accent-primary-light)' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localSettings.alertThresholds.includes(threshold)}
                    onChange={(e) => {
                      const newThresholds = e.target.checked
                        ? [...localSettings.alertThresholds, threshold]
                        : localSettings.alertThresholds.filter((t) => t !== threshold)
                      handleChange('alertThresholds', newThresholds)
                    }}
                    aria-label={`Alert at ${threshold}% usage`}
                    style={{ margin: 0 }}
                  />
                  <span style={{
                    fontSize: '14px',
                    color: 'var(--color-text-primary)'
                  }}>
                    {threshold}%
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              margin: '0 0 12px'
            }}>
              Notifications
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: localSettings.notificationsEnabled ? 'var(--color-background-secondary)' : 'transparent',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={localSettings.notificationsEnabled}
                  onChange={(e) => handleChange('notificationsEnabled', e.target.checked)}
                  aria-label="Enable desktop notifications"
                  style={{ margin: 0 }}
                />
                <span style={{
                  fontSize: '14px',
                  color: 'var(--color-text-primary)'
                }}>
                  Enable desktop notifications
                </span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: localSettings.soundAlertEnabled ? 'var(--color-background-secondary)' : 'transparent',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={localSettings.soundAlertEnabled}
                  onChange={(e) => handleChange('soundAlertEnabled', e.target.checked)}
                  aria-label="Enable sound alerts"
                  style={{ margin: 0 }}
                />
                <span style={{
                  fontSize: '14px',
                  color: 'var(--color-text-primary)'
                }}>
                  Enable sound alerts
                </span>
              </label>
            </div>
          </div>

          {/* Overlay Mode */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-text-secondary)',
              margin: '0 0 12px'
            }}>
              Overlay Mode
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Enable/Disable Toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: localSettings.overlayMode.enabled ? 'var(--color-background-secondary)' : 'transparent',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={localSettings.overlayMode.enabled}
                  onChange={(e) => handleOverlayModeToggle(e.target.checked)}
                  aria-label="Enable overlay mode"
                  style={{ margin: 0 }}
                />
                <span style={{
                  fontSize: '14px',
                  color: 'var(--color-text-primary)'
                }}>
                  Enable overlay mode
                </span>
              </label>

              {/* Position Selector */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '8px'
                }}>
                  Position
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  width: 'fit-content'
                }}>
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((position) => (
                    <button
                      key={position}
                      type="button"
                      onClick={() => handleOverlayPositionChange(position as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right')}
                      aria-label={`Position overlay at ${position}`}
                      aria-pressed={localSettings.overlayMode.position === position}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: localSettings.overlayMode.position === position ? '2px solid var(--color-accent-primary)' : '1px solid var(--color-border-default)',
                        backgroundColor: localSettings.overlayMode.position === position ? 'var(--color-accent-primary-light)' : 'var(--color-surface-elevated)',
                        color: 'var(--color-text-primary)',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textTransform: 'capitalize'
                      }}
                      onMouseEnter={(e) => {
                        if (localSettings.overlayMode.position !== position) {
                          e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (localSettings.overlayMode.position !== position) {
                          e.currentTarget.style.backgroundColor = 'var(--color-surface-elevated)'
                        }
                      }}
                    >
                      {position.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div>
                <label htmlFor="overlayOpacity" style={{
                  display: 'block',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px'
                }}>
                  Opacity: {localSettings.overlayMode.opacity}%
                </label>
                <input
                  id="overlayOpacity"
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={localSettings.overlayMode.opacity}
                  onChange={(e) => handleOverlayOpacityChange(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--color-accent-primary)'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>50%</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>100%</span>
                </div>
              </div>

              {/* Click-through Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: localSettings.overlayMode.clickThrough ? 'var(--color-background-secondary)' : 'transparent',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={localSettings.overlayMode.clickThrough}
                  onChange={(e) => handleClickThroughToggle(e.target.checked)}
                  aria-label="Enable click-through mode"
                  style={{ margin: 0, marginTop: '2px' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{
                    fontSize: '14px',
                    color: 'var(--color-text-primary)'
                  }}>
                    Click-through (hover to interact)
                  </span>
                  <span style={{
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)'
                  }}>
                    Overlay ignores clicks when enabled, allowing interaction with underlying apps. Hover over overlay to interact with it.
                  </span>
                </div>
              </label>

              {/* Show Percentage Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: localSettings.overlayMode.showPercentage ? 'var(--color-background-secondary)' : 'transparent',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={localSettings.overlayMode.showPercentage}
                  onChange={(e) => handleChange('overlayMode', { ...localSettings.overlayMode, showPercentage: e.target.checked })}
                  aria-label="Show percentage in overlay"
                  style={{ margin: 0 }}
                />
                <span style={{
                  fontSize: '14px',
                  color: 'var(--color-text-primary)'
                }}>
                  Show percentage
                </span>
              </label>

              {/* Show Progress Bar Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: localSettings.overlayMode.showProgressBar ? 'var(--color-background-secondary)' : 'transparent',
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={localSettings.overlayMode.showProgressBar}
                  onChange={(e) => handleChange('overlayMode', { ...localSettings.overlayMode, showProgressBar: e.target.checked })}
                  aria-label="Show progress bar in overlay"
                  style={{ margin: 0 }}
                />
                <span style={{
                  fontSize: '14px',
                  color: 'var(--color-text-primary)'
                }}>
                  Show progress bar
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          borderTop: '1px solid var(--color-border-default)'
        }}>
          <div>
            {saveStatus === 'saved' && (
              <Badge variant="success">Settings saved!</Badge>
            )}
            {saveStatus === 'error' && (
              <Badge variant="error">Failed to save</Badge>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              aria-busy={saveStatus === 'saving'}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-accent-primary)',
                color: 'var(--color-text-inverse)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                opacity: saveStatus === 'saving' ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (saveStatus !== 'saving') {
                  e.currentTarget.style.backgroundColor = 'var(--color-accent-primary-hover)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)'
              }}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
