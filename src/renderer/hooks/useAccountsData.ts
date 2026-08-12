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
    setCurrentUsage,
    appendHistory,
  } = useUsageStore()

  const isFetchingRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  // Last-good usage per account, mirrored to disk so a cold launch can show
  // data immediately instead of blanking while the (rate-limited) API retries.
  const lastUsageRef = useRef<Record<string, ProviderUsage>>({})

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
      let cacheDirty = false
      for (const { account, res } of results) {
        if ((res as { throttled?: boolean }).throttled) {
          // minPollMs not yet elapsed and no cached data — leave current state unchanged.
          continue
        }
        if (res.success && res.data) {
          const usage = res.data as ProviderUsage
          setAccountUsage(account.id, { status: 'ok', usage })
          appendHistory(account.id, usage.sessionPercent, usage.weeklyPercent)
          lastUsageRef.current[account.id] = usage
          cacheDirty = true
          const worst = Math.max(usage.sessionPercent, usage.weeklyPercent)
          const primaryWorst = primary ? Math.max(primary.sessionPercent, primary.weeklyPercent) : -1
          if (worst > primaryWorst) primary = usage
        } else {
          // Transient hiccups (rate limit / network) shouldn't wipe a good reading
          // off the screen — keep the last-known value if we have one. Only surface
          // an error for persistent problems (auth, no credential, unsupported).
          const code = (res as { code?: string }).code
          const cached = lastUsageRef.current[account.id]
          const transient = code === 'rate_limit' || code === 'network' || code === undefined
          if (cached && transient) {
            setAccountUsage(account.id, { status: 'ok', usage: cached })
          } else {
            setAccountUsage(account.id, {
              status: 'error',
              error: res.error || 'Failed to fetch usage',
              code,
            })
          }
        }
      }

      // Persist fresh readings so the next cold launch hydrates instantly.
      if (cacheDirty) {
        window.api.store.set('lastUsage', lastUsageRef.current).catch(() => {})
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

        // Hydrate last-good usage from disk so cards render data immediately,
        // before the first (potentially rate-limited) network poll returns.
        const cachedUsage = ((await window.api.store.get('lastUsage', {})) || {}) as Record<string, ProviderUsage>
        lastUsageRef.current = { ...cachedUsage }
        const hydrate = (list: AccountConfig[]) => {
          for (const a of list) {
            const u = cachedUsage[a.id]
            if (u) setAccountUsage(a.id, { status: 'ok', usage: u })
          }
        }

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
          hydrate(accountsWithKeys)
          if (needsResave) {
            // Rewrite accounts file without plaintext keys
            const metaOnly = accountsWithKeys.map(({ apiKey: _k, ...meta }) => meta)
            await window.api.store.set('accounts', metaOnly)
          }
        } else {
          // First run — seed from the legacy single-key setting (CLI logins are
          // merged below, on this and every launch).
          const s = useUsageStore.getState().settings
          if (s.apiKey) {
            const seeded: AccountConfig[] = [
              { id: 'zai-default', name: 'Z.AI GLM', provider: 'zai', apiKey: s.apiKey, baseUrl: s.baseUrl },
            ]
            setAccounts(seeded)
            hydrate(seeded)
            await window.api.store.set('accounts', seeded)
          }
        }

        // ALWAYS re-detect CLI logins and merge new ones. This is the fix for
        // the install-before-login trap: the old code only detected logins on
        // the very first launch and persisted whatever it found (possibly []),
        // so logging into Claude Code after installing never surfaced an
        // account until the user wiped the app's data.
        await useUsageStore.getState().discoverAndMergeLocalAccounts()
      } catch (error) {
        console.error('Failed to bootstrap accounts:', error)
      }
    }
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While no account is configured, quietly re-scan for CLI logins every few
  // seconds — a user following the setup guide sees their account appear the
  // moment `/login` completes, without restarting the app.
  useEffect(() => {
    if (accounts.length > 0) return
    const id = setInterval(() => {
      useUsageStore.getState().discoverAndMergeLocalAccounts()
    }, 10_000)
    return () => clearInterval(id)
  }, [accounts.length])

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
