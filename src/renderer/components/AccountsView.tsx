import { useUsageStore } from '@stores/useUsageStore'
import { AccountCard } from './AccountCard'
import { SetupGuide } from './SetupGuide'
import { StatusSummary } from './StatusSummary'

export function AccountsView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { accounts, accountUsage, providers, removeAccount } = useUsageStore()

  if (accounts.length === 0) return <SetupGuide onOpenSettings={onOpenSettings} />

  return (
    <div className="flex flex-col gap-4">
      <StatusSummary />
      {/* auto-fit, not auto-fill: one card fills the row instead of sitting in
          a 340px track, and more cards flow into two or three columns as the
          window widens. min(100%, 340px) keeps a card inside a narrow window. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            state={accountUsage[account.id]}
            provider={providers.find((p) => p.id === account.provider)}
            onRemove={removeAccount}
          />
        ))}
      </div>
    </div>
  )
}
