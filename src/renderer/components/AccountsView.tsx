import { useState } from 'react'
import { useUsageStore } from '@stores/useUsageStore'
import { AccountCard } from './AccountCard'
import { StatusSummary } from './StatusSummary'

interface AccountsViewProps {
  onOpenSettings: () => void
}

/** One numbered step in the first-run setup guide. */
function SetupStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          backgroundColor: 'var(--color-accent-primary)',
          color: 'var(--color-text-inverse)',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: '22px' }}>
        {children}
      </span>
    </li>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        backgroundColor: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 12,
        fontFamily: 'ui-monospace, Consolas, monospace',
        color: 'var(--color-text-primary)',
      }}
    >
      {children}
    </code>
  )
}

export function AccountsView({ onOpenSettings }: AccountsViewProps) {
  const { accounts, accountUsage, providers, removeAccount, discoverAndMergeLocalAccounts } =
    useUsageStore()
  const providerById = (id: string) => providers.find((p) => p.id === id)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  const handleRescan = async () => {
    setScanning(true)
    setScanMessage(null)
    try {
      const added = await discoverAndMergeLocalAccounts({ rescanDismissed: true })
      if (added === 0) {
        setScanMessage(
          'No CLI login found yet. Finish the steps above, then scan again — the app also rescans automatically every 10 seconds.',
        )
      }
    } finally {
      setScanning(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 'clamp(20px, 3vw, 32px)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          Connect your Claude Code account
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '0 0 16px' }}>
          Usage Tracker reads the login your Claude Code CLI already has — no API key to paste.
        </p>
        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: '0 0 18px' }}>
          <SetupStep n={1}>
            Install Claude Code if you haven&apos;t: <Code>npm install -g @anthropic-ai/claude-code</Code>
          </SetupStep>
          <SetupStep n={2}>
            Open a terminal and run <Code>claude</Code>
          </SetupStep>
          <SetupStep n={3}>
            Type <Code>/login</Code> and finish signing in via your browser
          </SetupStep>
        </ol>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
          That&apos;s it — your account appears here automatically within a few seconds of logging in.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleRescan}
            disabled={scanning}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'var(--color-accent-primary)',
              color: 'var(--color-text-inverse)',
              fontSize: 14,
              fontWeight: 500,
              cursor: scanning ? 'wait' : 'pointer',
              opacity: scanning ? 0.7 : 1,
            }}
          >
            {scanning ? 'Scanning…' : 'Scan for accounts'}
          </button>
          <button
            onClick={onOpenSettings}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Add API-key account instead
          </button>
        </div>
        {scanMessage && (
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '12px 0 0' }}>
            {scanMessage}
          </p>
        )}
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '16px 0 0' }}>
          Also works with the OpenAI Codex CLI (<Code>codex login</Code>) and Z.AI / GLM API keys.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.5vw, 18px)' }}>
      <StatusSummary />
      {/* Responsive grid: auto-fit (not auto-fill) so a single card expands to
          fill the row instead of being parked in a narrow 340px track on the
          left; multiple cards flow into 2–3 columns as the window widens.
          min(100%, 340px) keeps a single card from overflowing narrow windows. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'clamp(12px, 1.5vw, 18px)',
          alignItems: 'start',
        }}
      >
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            state={accountUsage[account.id]}
            provider={providerById(account.provider)}
            onRemove={removeAccount}
          />
        ))}
      </div>
    </div>
  )
}
