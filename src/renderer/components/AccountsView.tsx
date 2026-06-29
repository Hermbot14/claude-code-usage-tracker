import { useUsageStore } from '@stores/useUsageStore'
import { AccountCard } from './AccountCard'
import { StatusSummary } from './StatusSummary'

interface AccountsViewProps {
  onOpenSettings: () => void
}

export function AccountsView({ onOpenSettings }: AccountsViewProps) {
  const { accounts, accountUsage, providers, removeAccount } = useUsageStore()
  const providerById = (id: string) => providers.find((p) => p.id === id)

  if (accounts.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--radius-lg)', padding: '32px 24px', textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
          <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: '0 0 16px' }}>
          No accounts yet. Add a coding-plan provider to start tracking usage.
        </p>
        <button
          onClick={onOpenSettings}
          style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--color-accent-primary)', color: 'var(--color-text-inverse)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
        >
          Add an account
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.5vw, 18px)' }}>
      <StatusSummary />
      {/* Responsive grid: 1 column when narrow, flowing to 2–3 as the window widens.
          min(100%, 340px) keeps a single card from overflowing very narrow windows. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
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
