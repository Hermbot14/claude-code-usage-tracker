import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LevelBadge } from '@/components/usage/LevelBadge'
import { usageLevel } from '@/lib/usage-level'
import { cn } from '@/lib/utils'
import type { ProviderUsage } from '@/types'
import { useUsageStore } from '@stores/useUsageStore'

/**
 * The page header, OpenRouter style: how many accounts, the one closest to
 * its limit and when the figures were read, with Refresh in the header band.
 */
export function StatusSummary() {
  const { accounts, accountUsage, refreshAccount, refreshingIds } = useUsageStore()
  if (accounts.length === 0) return null

  let worst: { name: string; pct: number; window: string } | null = null
  let lastUpdated = 0
  for (const account of accounts) {
    const state = accountUsage[account.id]
    if (state?.status !== 'ok') continue
    const u: ProviderUsage = state.usage
    const pct = Math.max(u.sessionPercent, u.weeklyPercent)
    const window = u.sessionPercent >= u.weeklyPercent ? 'session' : 'weekly'
    if (!worst || pct > worst.pct) worst = { name: account.name, pct, window }
    lastUpdated = Math.max(lastUpdated, new Date(u.lastUpdated).getTime())
  }

  const anyRefreshing = refreshingIds.length > 0
  const refreshAll = () => accounts.forEach((a) => refreshAccount(a.id))

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight">
          {accounts.length} account{accounts.length === 1 ? '' : 's'} tracked
        </h2>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          {worst ? (
            <>
              <LevelBadge level={usageLevel(worst.pct)} />
              <span className="truncate">
                Most used: {worst.name} · {worst.pct}% {worst.window}
              </span>
            </>
          ) : (
            'Waiting for usage data…'
          )}
        </p>
        {lastUpdated > 0 && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Read at {format(new Date(lastUpdated), 'HH:mm:ss')}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        onClick={refreshAll}
        disabled={anyRefreshing}
        aria-label="Refresh all accounts"
      >
        <RefreshCw className={cn(anyRefreshing && 'animate-spin')} data-icon="inline-start" />
        Refresh
      </Button>
    </section>
  )
}
