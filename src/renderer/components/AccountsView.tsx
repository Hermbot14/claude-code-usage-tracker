import { useEffect, useState } from 'react'
import { useUsageStore } from '@stores/useUsageStore'
import { AccountCard } from './AccountCard'
import { StatusSummary } from './StatusSummary'

interface AccountsViewProps {
  onOpenSettings: () => void
}

/** One actionable step row in the first-run setup guide. */
function SetupStep({
  n,
  done,
  children,
}: {
  n: number
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          backgroundColor: done ? 'var(--color-semantic-success)' : 'var(--color-accent-primary)',
          color: 'var(--color-text-inverse)',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? '✓' : n}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: '22px', flex: 1, minWidth: 0 }}>
        {children}
      </span>
    </li>
  )
}

/** Small inline action button used by the setup steps. */
function StepButton({
  onClick,
  busy,
  disabled,
  children,
}: {
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      style={{
        padding: '6px 12px',
        marginLeft: 8,
        borderRadius: 'var(--radius-md)',
        border: 'none',
        backgroundColor: 'var(--color-accent-primary)',
        color: 'var(--color-text-inverse)',
        fontSize: 12,
        fontWeight: 600,
        cursor: busy || disabled ? 'wait' : 'pointer',
        opacity: busy || disabled ? 0.6 : 1,
        verticalAlign: 'middle',
      }}
    >
      {children}
    </button>
  )
}

function Code({ children, block }: { children: React.ReactNode; block?: boolean }) {
  return (
    <code
      style={{
        backgroundColor: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 4,
        padding: block ? '4px 8px' : '1px 6px',
        fontSize: 12,
        fontFamily: 'ui-monospace, Consolas, monospace',
        color: 'var(--color-text-primary)',
        // Block variant: long commands (e.g. the npm install line) get their own
        // line and scroll instead of wrapping mid-token into confusing fragments.
        ...(block
          ? {
              display: 'block',
              marginTop: 6,
              whiteSpace: 'nowrap' as const,
              overflowX: 'auto' as const,
              maxWidth: '100%',
              width: 'fit-content',
            }
          : {}),
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

  // One-click setup state. cliStatus === null → probe still running.
  const [cliStatus, setCliStatus] = useState<{
    claudeInstalled: boolean
    claudeVersion: string | null
    npmAvailable: boolean
  } | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState<string | null>(null)
  const [loginMsg, setLoginMsg] = useState<string | null>(null)

  const empty = accounts.length === 0

  // Probe for the CLI whenever the empty state is shown (cheap, local).
  useEffect(() => {
    if (!empty) return
    let cancelled = false
    window.api.claudeSetup
      .check()
      .then((s) => {
        if (!cancelled) setCliStatus(s)
      })
      .catch(() => {
        if (!cancelled) setCliStatus({ claudeInstalled: false, claudeVersion: null, npmAvailable: false })
      })
    return () => {
      cancelled = true
    }
  }, [empty])

  const handleInstall = async () => {
    setInstalling(true)
    setInstallMsg(null)
    try {
      const res = await window.api.claudeSetup.install()
      setInstallMsg(res.detail ?? (res.ok ? 'Installed.' : 'Install failed.'))
      if (res.ok) setCliStatus(await window.api.claudeSetup.check())
    } catch (err) {
      setInstallMsg(err instanceof Error ? err.message : 'Install failed.')
    } finally {
      setInstalling(false)
    }
  }

  const handleLogin = async () => {
    setLoginMsg(null)
    try {
      const res = await window.api.claudeSetup.login()
      setLoginMsg(res.detail ?? (res.ok ? 'Terminal opened.' : 'Could not open a terminal.'))
    } catch (err) {
      setLoginMsg(err instanceof Error ? err.message : 'Could not open a terminal.')
    }
  }

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
        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: 0, margin: '0 0 18px' }}>
          <SetupStep n={1} done={cliStatus?.claudeInstalled === true}>
            {cliStatus === null ? (
              <>Checking for the Claude Code CLI…</>
            ) : cliStatus.claudeInstalled ? (
              <>
                Claude Code is installed
                {cliStatus.claudeVersion ? (
                  // "2.1.215 (Claude Code)" → show just "2.1.215"
                  <span style={{ color: 'var(--color-text-tertiary)' }}>
                    {' '}(v{cliStatus.claudeVersion.split(' ')[0]})
                  </span>
                ) : null}
              </>
            ) : (
              <>
                Install Claude Code
                <StepButton onClick={handleInstall} busy={installing}>
                  {installing ? 'Installing…' : 'Install now'}
                </StepButton>
                {installMsg && (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {installMsg}
                  </span>
                )}
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  or run <Code>npm install -g @anthropic-ai/claude-code</Code> yourself
                </span>
              </>
            )}
          </SetupStep>
          <SetupStep n={2}>
            Sign in to Claude
            <StepButton onClick={handleLogin} disabled={cliStatus !== null && !cliStatus.claudeInstalled}>
              Sign in
            </StepButton>
            {loginMsg && (
              <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                {loginMsg}
              </span>
            )}
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              opens a terminal running <Code>claude /login</Code> — finish in your browser
            </span>
          </SetupStep>
        </ol>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
          That&apos;s it — your account appears here automatically within a few seconds of signing in.
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
