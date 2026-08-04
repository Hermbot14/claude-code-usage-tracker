import { useCallback, useEffect, useState } from 'react'
import { useInterval } from '@hooks/useInterval'
import type { CostSummary } from '@/types'

/**
 * API-equivalent cost panel.
 *
 * Shows what this machine's Claude Code usage *would* have cost on pay-as-you-go
 * API billing. On a coding plan nothing here is actually charged — it exists so
 * the value of the plan (and the shape of the spend) is visible.
 *
 * Figures come from the main process, which reprices the raw token counts in
 * ~/.claude/metrics/costs.jsonl rather than trusting the cost the logging hook
 * wrote (see src/main/cost-service.ts).
 */

const REFRESH_MS = 60_000

function usd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function compactTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

/** "claude-haiku-4-5-20251001" -> "Haiku 4.5"; raw id when unrecognised. */
function prettyModel(model: string): string {
  const m = model.toLowerCase()
  const family = ['fable', 'mythos', 'opus', 'sonnet', 'haiku'].find((f) => m.includes(f))
  if (!family) return model
  const version = (m.split(family)[1] ?? '')
    .replace(/^[-_]/, '')
    .replace(/-?\d{8}$/, '') // drop the release-date suffix
    .replace(/-/g, '.')
  const label = family[0].toUpperCase() + family.slice(1)
  return version ? `${label} ${version}` : label
}

/**
 * A hairline that is visible on every theme.
 *
 * Several themes give --color-background-secondary the same hex as
 * --color-surface-card (the default dark theme uses #121216 for both), so a
 * tinted fill alone renders invisible on a card. Mixing against the text colour
 * always produces contrast, whichever way round the theme is.
 */
const HAIRLINE = 'color-mix(in srgb, var(--color-text-primary) 14%, transparent)'

interface StatProps {
  label: string
  value: string
  hint?: string
  emphasis?: boolean
}

function Stat({ label, value, hint, emphasis }: StatProps) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: 0,
        padding: '14px 16px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: emphasis
          ? 'var(--color-accent-primary-light)'
          : 'var(--color-background-secondary)',
        border: `1px solid ${emphasis ? 'var(--color-accent-primary)' : HAIRLINE}`,
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'clamp(20px, 2.4vw, 28px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          marginTop: '4px',
          color: emphasis ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function TokenChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: tone,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {compactTokens(value)}
      </span>
    </div>
  )
}

function SectionHeading() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <div
        style={{
          width: '34px',
          height: '34px',
          flexShrink: 0,
          borderRadius: 'var(--radius-md)',
          background:
            'linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-primary-hover) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-inverse)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          API-equivalent cost
        </h2>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            margin: '2px 0 0',
            lineHeight: 1.4,
          }}
        >
          What this usage would cost on pay-as-you-go billing. Your plan covers it.
        </p>
      </div>
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-text-tertiary)',
      }}
    >
      {children}
    </div>
  )
}

export function CostPanel() {
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(() => {
    window.api
      .getCostSummary()
      .then(setSummary)
      .catch(() => {
        /* the main handler never rejects; ignore transient IPC failures */
      })
  }, [])

  useEffect(() => load(), [load])
  useInterval(load, REFRESH_MS)

  // First paint, before IPC resolves — hold the layout height steady.
  if (!summary) {
    return (
      <div className="card" style={{ minHeight: '180px' }}>
        <div
          className="skeleton-loader"
          style={{ height: '16px', width: '180px', borderRadius: '4px' }}
        />
        <div
          className="skeleton-loader"
          style={{ height: '76px', marginTop: '16px', borderRadius: 'var(--radius-lg)' }}
        />
      </div>
    )
  }

  if (!summary.available) {
    return (
      <div className="card">
        <SectionHeading />
        <p
          style={{
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            margin: '10px 0 0',
            lineHeight: 1.5,
          }}
        >
          {summary.reason ?? 'Cost data is unavailable.'}
        </p>
      </div>
    )
  }

  const { tokens } = summary
  const totalTokens = tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead
  const topProjects = summary.byProject.slice(0, 5)
  const maxProject = topProjects[0]?.cost ?? 1
  const visibleSessions = expanded ? summary.sessions : summary.sessions.slice(0, 5)

  // The ledger's own figure is usually inflated (stale rates). Only call it out
  // when the gap is material, so the note doesn't become permanent noise.
  const overstatement = summary.ledgerReportedTotal - summary.total
  const showCorrection =
    summary.total > 0 && summary.ledgerReportedTotal > 0 && overstatement / summary.total > 0.05

  return (
    <div className="card">
      <SectionHeading />

      {/* Headline figures */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
        <Stat label="Today" value={usd(summary.today)} />
        <Stat label="Last 7 days" value={usd(summary.last7Days)} />
        <Stat
          label="All time"
          value={usd(summary.total)}
          hint={`${summary.sessionCount.toLocaleString()} sessions`}
          emphasis
        />
      </div>

      {/* Token mix */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 20px',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--color-border-default)',
        }}
      >
        <TokenChip label="Input" value={tokens.input} tone="var(--color-semantic-info)" />
        <TokenChip label="Output" value={tokens.output} tone="var(--color-accent-primary)" />
        <TokenChip
          label="Cache write"
          value={tokens.cacheWrite}
          tone="var(--color-semantic-warning)"
        />
        <TokenChip label="Cache read" value={tokens.cacheRead} tone="var(--color-semantic-success)" />
        <span
          style={{
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            marginLeft: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {compactTokens(totalTokens)} tokens total
        </span>
      </div>

      {/* Spend by project */}
      {topProjects.length > 0 && (
        <div style={{ marginTop: '18px' }}>
          <SubHeading>By project</SubHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
            {topProjects.map((p) => (
              <div key={p.project} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  title={p.project}
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--color-text-secondary)',
                    width: 'min(32%, 210px)',
                    flexShrink: 0,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.project}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: HAIRLINE,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(2, (p.cost / maxProject) * 100)}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background:
                        'linear-gradient(90deg, var(--color-accent-primary) 0%, var(--color-accent-primary-hover) 100%)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '68px',
                    textAlign: 'right',
                  }}
                >
                  {usd(p.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {summary.sessions.length > 0 && (
        <div style={{ marginTop: '18px' }}>
          <SubHeading>Recent sessions</SubHeading>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px' }}>
            {visibleSessions.map((s, i) => (
              <div
                key={s.sessionId || `${s.date}-${s.cost}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 0',
                  // No rule under the final row — it would dangle above the button.
                  borderBottom:
                    i === visibleSessions.length - 1
                      ? 'none'
                      : '1px solid var(--color-border-default)',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {s.date}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-background-secondary)',
                    border: `1px solid ${HAIRLINE}`,
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {prettyModel(s.model)}
                </span>
                <span
                  title={s.project}
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.project}
                </span>
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {usd(s.cost)}
                </span>
              </div>
            ))}
          </div>
          {summary.sessions.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: '10px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)')
              }
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {expanded ? 'Show less' : `Show all ${summary.sessions.length}`}
            </button>
          )}
        </div>
      )}

      {showCorrection && (
        <p
          style={{
            fontSize: '11.5px',
            color: 'var(--color-text-tertiary)',
            margin: '16px 0 0',
            lineHeight: 1.5,
          }}
        >
          Repriced from raw token counts. The logging hook&rsquo;s own figure of{' '}
          {usd(summary.ledgerReportedTotal)} overstates this by {usd(overstatement)} — it prices
          Opus at legacy rates.
        </p>
      )}
    </div>
  )
}
