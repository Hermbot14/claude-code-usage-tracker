import { format } from 'date-fns'
import { useState, useRef, useEffect } from 'react'
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
      <div style={{ width: '100%', height: 9, backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(percent, 100)}%`,
            background: getGradientClass(percent),
            borderRadius: 'var(--radius-full)',
            boxShadow: `0 0 8px color-mix(in srgb, ${color} 55%, transparent)`,
            transition: 'width 0.5s ease-out, box-shadow 0.3s ease',
          }}
        />
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
  tone = 'default',
  children,
}: {
  onClick: () => void
  label: string
  spinning?: boolean
  danger?: boolean
  /** 'onAccent' = light icon for placement on the gradient plan header. */
  tone?: 'default' | 'onAccent'
  children: React.ReactNode
}) {
  const onAccent = tone === 'onAccent'
  const base = onAccent ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)'
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={spinning}
      style={{
        padding: 7,
        borderRadius: 'var(--radius-md)',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: spinning ? 'default' : 'pointer',
        color: base,
        opacity: onAccent ? 0.8 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.15s, background-color 0.15s, opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1'
        if (onAccent) {
          e.currentTarget.style.color = 'var(--color-text-inverse)'
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.22)'
        } else {
          e.currentTarget.style.color = danger ? 'var(--color-semantic-error)' : 'var(--color-text-primary)'
          e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = base
        e.currentTarget.style.opacity = onAccent ? '0.8' : '1'
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <span style={spinning ? { animation: 'spin 1s linear infinite', display: 'flex' } : { display: 'flex' }}>{children}</span>
    </button>
  )
}

export function AccountCard({ account, state, provider, onRemove }: AccountCardProps) {
  const { accountHistory, refreshAccount, refreshingIds, updateAccountPlan } = useUsageStore()
  const refreshing = refreshingIds.includes(account.id)
  const history = accountHistory[account.id] ?? []

  // Plan label: account config override > API-inferred > nothing
  const apiPlan = state?.status === 'ok' ? state.usage.planLabel : undefined
  const displayPlan = account.planLabel ?? apiPlan

  const [editingPlan, setEditingPlan] = useState(false)
  const [planDraft, setPlanDraft] = useState('')
  const planInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingPlan) {
      setPlanDraft(displayPlan ?? '')
      planInputRef.current?.focus()
      planInputRef.current?.select()
    }
  }, [editingPlan, displayPlan])

  const commitPlan = () => {
    setEditingPlan(false)
    updateAccountPlan(account.id, planDraft)
  }

  // "Max 20x" → "Max 20×" for a more polished multiplier glyph.
  const prettyPlan = displayPlan ? displayPlan.replace(/(\d)\s*x\b/i, '$1×') : undefined
  const authLabel = provider ? authChip[provider.auth] ?? provider.auth.toUpperCase() : null
  const email = state?.status === 'ok' ? state.usage.email : undefined

  return (
    <div
      className="account-card"
      style={{
        flexDirection: 'column',
        background: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
        transition: 'transform 0.2s ease, box-shadow 0.3s ease, background-color 0.3s ease, border-color 0.2s ease',
      }}
    >
      {/* ── Plan header: a gradient band that makes the subscription the hero ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-primary-hover) 100%)',
          padding: 'clamp(15px, 1.7vw, 19px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Identity + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ borderRadius: 11, boxShadow: '0 0 0 2px rgba(255,255,255,0.32)', display: 'flex', flexShrink: 0 }}>
              <ProviderIcon provider={account.provider} size={38} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-inverse)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
                {authLabel && (
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'var(--color-text-inverse)', opacity: 0.72, flexShrink: 0 }}>
                    {authLabel}
                  </span>
                )}
                {email && (
                  <>
                    <span style={{ fontSize: 10, color: 'var(--color-text-inverse)', opacity: 0.5, flexShrink: 0 }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-inverse)', opacity: 0.72, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <IconButton tone="onAccent" onClick={() => refreshAccount(account.id)} label={`Refresh ${account.name}`} spinning={refreshing}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </IconButton>
            <IconButton tone="onAccent" onClick={() => onRemove(account.id)} label={`Remove ${account.name}`} danger>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* Plan hero block — floats on the gradient, the visual centerpiece */}
        <div
          onClick={() => setEditingPlan(true)}
          title={displayPlan ? 'Click to edit plan' : 'Click to set your plan'}
          style={{
            display: 'flex', alignItems: 'center', gap: 13,
            background: 'var(--color-surface-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '11px 15px',
            boxShadow: 'var(--shadow-lg)',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent-primary-light)',
            color: 'var(--color-accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 2h14v2H5v-2z" />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
              Current plan
            </div>
            {editingPlan ? (
              <input
                ref={planInputRef}
                value={planDraft}
                onChange={(e) => setPlanDraft(e.target.value)}
                onBlur={commitPlan}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter') commitPlan(); if (e.key === 'Escape') setEditingPlan(false) }}
                placeholder="e.g. Max 20x"
                style={{
                  width: '100%', marginTop: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 19, fontWeight: 800, lineHeight: 1.15, color: 'var(--color-text-primary)',
                  borderBottom: '1.5px solid var(--color-accent-primary)', padding: 0,
                }}
              />
            ) : (
              <div style={{
                fontSize: 19, fontWeight: 800, lineHeight: 1.15,
                color: displayPlan ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {prettyPlan ?? 'Set your plan'}
              </div>
            )}
          </div>
          {!editingPlan && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Body: usage metrics ── */}
      <div style={{ padding: 'clamp(16px, 1.8vw, 22px)' }}>
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
