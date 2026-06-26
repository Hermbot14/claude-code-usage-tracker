import { useEffect, useCallback, useRef } from 'react'
import { useUsageStore } from '@stores/useUsageStore'
import type { AccountConfig, ProviderUsage, UsageData } from '@/types'

/** Map a normalized ProviderUsage onto the legacy UsageData shape (tray/overlay). */
function toLegacy(u: ProviderUsage): UsageData {
  return {
    sessionUsage: u.sessionUsage ?? 0,
    sessionLimit: u.sessionLimit ?? 0,
    sessionPercent: u.sessionPercent,
    sessionResetTime: u.sessionResetTime,
    weeklyUsage: u.weeklyUsage ?? 0,
    weeklyLimit: u.weeklyLimit ?? 0,
    weeklyPercent: u.weeklyPercent,
    weeklyResetTime: u.weeklyResetTime,
    lastUpdated: u.lastUpdated,
  }
}

/**
 * Drives the multi-account view: discovers providers + local logins, seeds
 * accounts on first run, then polls every account on the refresh interval.
 * The most-constrained account is mirrored into `currentUsage` so the existing
 * tray and overlay keep working unchanged.
 */
export function useAccountsData() {
  const {
    settings,
    accounts,
    setAccounts,
    setAccountUsage,
    setProviders,
    setLocalAccounts,
    setCurrentUsage,
    appendHistory,
  } = useUsageStore()

  const isFetchingRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const pollAll = useCallback(async () => {
    const list = useUsageStore.getState().accounts
    if (list.length === 0 || isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const results = await Promise.all(
        list.map(async (account) => {
          try {
            const res = await window.api.fetchAccountUsage(account)
            return { account, res }
          } catch (err) {
            return {
              account,
              res: { success: false, error: err instanceof Error ? err.message : 'Fetch failed' },
            }
          }
        }),
      )

      let primary: ProviderUsage | null = null
      for (const { account, res } of results) {
        if ((res as { throttled?: boolean }).throttled) {
          // minPollMs not yet elapsed and no cached data — leave current state unchanged.
          continue
        }
        if (res.success && res.data) {
          const usage = res.data as ProviderUsage
          setAccountUsage(account.id, { status: 'ok', usage })
          appendHistory(account.id, usage.sessionPercent, usage.weeklyPercent)
          const worst = Math.max(usage.sessionPercent, usage.weeklyPercent)
          const primaryWorst = primary ? Math.max(primary.sessionPercent, primary.weeklyPercent) : -1
          if (worst > primaryWorst) primary = usage
        } else {
          setAccountUsage(account.id, {
            status: 'error',
            error: res.error || 'Failed to fetch usage',
            code: (res as { code?: string }).code,
          })
        }
      }

      // Mirror the most-constrained account into the legacy tray/overlay state.
      if (primary) {
        const legacy = toLegacy(primary)
        setCurrentUsage(legacy)
        await window.api.updateTray(legacy)
      }
    } finally {
      isFetchingRef.current = false
    }
  }, [setAccountUsage, setCurrentUsage, appendHistory])

  // One-time bootstrap: providers, local logins, seed accounts.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Restore persisted settings (overlay mode, opacity, refresh interval,
        // thresholds, theme) before anything reads them.
        const storedSettings = await window.api.store.get('settings', null)
        if (storedSettings) {
          useUsageStore.getState().initializeFromStorage(storedSettings)
        }

        const [providers, local] = await Promise.all([
          window.api.listProviders(),
          window.api.discoverLocalAccounts(),
        ])
        setProviders(providers)
        setLocalAccounts(local)

        const stored = (await window.api.store.get('accounts', null)) as AccountConfig[] | null
        if (stored && Array.isArray(stored)) {
          // Restore encrypted API keys; also migrate any plaintext keys left from older
          // versions of the app into the encrypted store, then strip them from disk.
          let needsResave = false
          const accountsWithKeys = await Promise.all(
            stored.map(async (account) => {
              if (account.apiKey) {
                // Plaintext key still on disk — migrate it to the encrypted store
                await window.api.store.setSecret(`account-key-${account.id}`, account.apiKey)
                needsResave = true
                return account
              }
              const apiKey = await window.api.store.getSecret(`account-key-${account.id}`)
              return apiKey ? { ...account, apiKey } : account
            })
          )
          setAccounts(accountsWithKeys)
          if (needsResave) {
            // Rewrite accounts file without plaintext keys
            const metaOnly = accountsWithKeys.map(({ apiKey: _k, ...meta }) => meta)
            await window.api.store.set('accounts', metaOnly)
          }
        } else {
          // First run — seed from the legacy single-key setting + detected logins.
          const seeded: AccountConfig[] = []
          const s = useUsageStore.getState().settings
          if (s.apiKey) {
            seeded.push({ id: 'zai-default', name: 'Z.AI GLM', provider: 'zai', apiKey: s.apiKey, baseUrl: s.baseUrl })
          }
          const labelFor = (p: string) => providers.find((x) => x.id === p)?.label ?? p
          for (const loc of local) {
            if (seeded.some((a) => a.provider === loc.provider)) continue
            seeded.push({ id: `${loc.provider}-local`, name: labelFor(loc.provider), provider: loc.provider })
          }
          setAccounts(seeded)
          await window.api.store.set('accounts', seeded)
        }
      } catch (error) {
        console.error('Failed to bootstrap accounts:', error)
      }
    }
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll on interval + whenever the account set changes.
  useEffect(() => {
    if (accounts.length === 0) return
    pollAll()
    intervalRef.current = setInterval(pollAll, settings.refreshInterval * 1000)

    const cleanupListener = window.api.onRefreshUsage(() => pollAll())
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      cleanupListener()
    }
  }, [pollAll, settings.refreshInterval, accounts])

  return { pollAll }
}
