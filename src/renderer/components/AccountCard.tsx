import { format } from 'date-fns'
import type { AccountConfig, AccountUsageState, ProviderInfo } from '@/types'
import { useUsageStore } from '@stores/useUsageStore'
import { formatTimeRemaining, getUsageColor, getGradientClass } from '@lib/utils'
import { ProviderIcon } from './ui/ProviderIcon'
import { Sparkline } from './ui/Sparkline'

interface AccountCardProps {
  account: AccountConfig
  state: AccountUsageState | undefined
  provider?: ProviderInfo
  onRemove: (id: string) => void
}

const authChip: Record<string, string> = {
  oauthLocal: 'LOCAL LOGIN',
  apiKey: 'API KEY',
  oauthPaste: 'TOKEN',
}

function MetricRow({
  label,
  windowLabel,
  percent,
  reset,
}: {
  label: string
  windowLabel: string
  percent: number
  reset: string
}) {
  const color = getUsageColor(percent)
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {label} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>· {windowLabel}</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
      </div>
      <div style={{ width: '100%', height: 8, backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(percent, 100)}%`, background: getGradientClass(percent), borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease-out' }} />
      </div>
      <div style={{ marginTop: 4, textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>resets in {formatTimeRemaining(reset)}</span>
      </div>
    </div>
  )
}

function IconButton({
  onClick,
  label,
  spinning,
  danger,
  children,
}: {
  onClick: () => void
  label: string
  spinning?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={spinning}
      style={{
        padding: 6,
        borderRadius: 'var(--radius-md)',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: spinning ? 'default' : 'pointer',
        color: 'var(--color-text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.15s, background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = danger ? 'var(--color-semantic-error)' : 'var(--color-text-primary)'
        e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--color-text-tertiary)'
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <span style={spinning ? { animation: 'spin 1s linear infinite', display: 'flex' } : { display: 'flex' }}>{children}</span>
    </button>
  )
}

export function AccountCard({ account, state, provider, onRemove }: AccountCardProps) {
  const { accountHistory, refreshAccount, refreshingIds } = useUsageStore()
  const refreshing = refreshingIds.includes(account.id)
  const history = accountHistory[account.id] ?? []

  const worst =
    state?.status === 'ok' ? Math.max(state.usage.sessionPercent, state.usage.weeklyPercent) : 0
  const accent = state?.status === 'ok' ? getUsageColor(worst) : 'var(--color-border-default)'

  return (
    <div
      className="account-card"
      style={{
        background: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* Status accent bar — flex child, always visible against the card */}
      <div style={{ width: 4, flexShrink: 0, background: accent }} />

      {/* Card content — left padding reduced by 4px to keep visual symmetry with accent bar */}
      <div style={{ flex: 1, padding: '24px 24px 24px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <ProviderIcon provider={account.provider} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                {provider && (
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, color: 'var(--color-text-tertiary)' }}>
                    {authChip[provider.auth] ?? provider.auth.toUpperCase()}
                  </span>
                )}
                {state?.status === 'ok' && state.usage.planLabel && (
                  <>
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>·</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      color: 'var(--color-accent-primary)',
                      backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 12%, transparent)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                    }}>
                      {state.usage.planLabel}
                    </span>
                  </>
                )}
                {state?.status === 'ok' && state.usage.email && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    · {state.usage.email}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <IconButton onClick={() => refreshAccount(account.id)} label={`Refresh ${account.name}`} spinning={refreshing}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </IconButton>
            <IconButton onClick={() => onRemove(account.id)} label={`Remove ${account.name}`} danger>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* Body */}
        {!state || state.status === 'loading' ? (
          <div style={{ height: 88, borderRadius: 'var(--radius-md)' }} className="skeleton-loader" />
        ) : state.status === 'error' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: 'var(--color-semantic-error-light)', borderRadius: 'var(--radius-md)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-semantic-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--color-semantic-error)', wordBreak: 'break-word' }}>{state.error}</span>
          </div>
        ) : (
          <>
            <MetricRow label="Session" windowLabel={state.usage.sessionWindowLabel} percent={state.usage.sessionPercent} reset={state.usage.sessionResetTime} />
            <MetricRow label="Weekly" windowLabel={state.usage.weeklyWindowLabel} percent={state.usage.weeklyPercent} reset={state.usage.weeklyResetTime} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, borderTop: '1px solid var(--color-border-default)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>trend</span>
                <Sparkline points={history.map((h) => h.s)} color={getUsageColor(state.usage.sessionPercent)} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Updated {format(new Date(state.usage.lastUpdated), 'HH:mm:ss')}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
