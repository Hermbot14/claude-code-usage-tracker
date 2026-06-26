import { create } from 'zustand'
import type {
  UsageData,
  UsageHistoryEntry,
  Settings,
  AccountConfig,
  AccountUsageState,
  ProviderInfo,
  LocalAccountInfo,
} from '@/types'

interface UsageStore {
  // State
  currentUsage: UsageData | null
  history: UsageHistoryEntry[]
  settings: Settings
  isLoading: boolean
  error: string | null
  lastFetchTime: number | null
  isInitialized: boolean

  // Multi-account state
  accounts: AccountConfig[]
  accountUsage: Record<string, AccountUsageState>
  providers: ProviderInfo[]
  localAccounts: LocalAccountInfo[]
  /** In-memory recent session/weekly % samples per account, for sparklines. */
  accountHistory: Record<string, { t: number; s: number; w: number }[]>
  refreshingIds: string[]

  // Actions
  setCurrentUsage: (usage: UsageData) => void
  addToHistory: (entry: UsageHistoryEntry) => void
  updateSettings: (settings: Partial<Settings>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearHistory: () => void
  initializeFromStorage: (storedSettings: Settings) => void

  // Multi-account actions
  setAccounts: (accounts: AccountConfig[]) => void
  addAccount: (account: AccountConfig) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  setAccountUsage: (id: string, state: AccountUsageState) => void
  setProviders: (providers: ProviderInfo[]) => void
  setLocalAccounts: (local: LocalAccountInfo[]) => void
  appendHistory: (id: string, sessionPercent: number, weeklyPercent: number) => void
  refreshAccount: (id: string) => Promise<void>
}

const defaultSettings: Settings = {
  apiKey: '',
  baseUrl: 'https://api.z.ai/api/anthropic',
  refreshInterval: 5, // 5 seconds
  notificationsEnabled: true,
  alertThresholds: [80, 90, 100],
  soundAlertEnabled: false,
  retentionDays: 90,
  overlayMode: {
    enabled: false,
    position: 'top-right',
    opacity: 95,
    compact: true,
    clickThrough: false,
    showPercentage: true,
    showProgressBar: true,
  },
}

export const useUsageStore = create<UsageStore>((set, get) => ({
  // Initial state
  currentUsage: null,
  history: [],
  settings: defaultSettings,
  isLoading: false,
  error: null,
  lastFetchTime: null,
  isInitialized: false,
  accounts: [],
  accountUsage: {},
  providers: [],
  localAccounts: [],
  accountHistory: {},
  refreshingIds: [],

  // Actions
  setCurrentUsage: (usage) => {
    try {
      set({ currentUsage: usage, error: null, lastFetchTime: Date.now() })

      // Add to history (once per day)
      const { history, settings } = get()
      const today = new Date().toISOString().split('T')[0]
      const lastEntry = history[history.length - 1]

      if (lastEntry?.date !== today) {
        const newEntry: UsageHistoryEntry = {
          date: today,
          sessionUsage: usage.sessionUsage,
          sessionPercent: usage.sessionPercent,
          weeklyUsage: usage.weeklyUsage,
          weeklyPercent: usage.weeklyPercent,
        }

        // Keep entries within retention period
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - settings.retentionDays)

        const filteredHistory = history.filter(
          (entry) => new Date(entry.date) >= cutoffDate
        )

        set({ history: [...filteredHistory, newEntry] })
      }

      // Fire-and-forget persistence — errors logged but never crash the UI
      window.api.store.set('currentUsage', usage).catch((e) => {
        console.error('Failed to save usage to storage:', e)
      })
      window.api.store.set('lastFetchTime', Date.now()).catch((e) => {
        console.error('Failed to save fetch time to storage:', e)
      })
    } catch (error) {
      console.error('Error in setCurrentUsage:', error)
      set({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
  },

  addToHistory: (entry) =>
    set((state) => ({
      history: [...state.history.slice(-89), entry], // Keep last 90 days
    })),

  updateSettings: async (newSettings) => {
    try {
      const updatedSettings = { ...get().settings, ...newSettings }
      set({ settings: updatedSettings })

      // Save to persistent storage
      await window.api.store.set('settings', updatedSettings)
    } catch (error) {
      console.error('Failed to update settings:', error)
      set({ error: error instanceof Error ? error.message : 'Failed to save settings' })
      throw error // Re-throw for UI to handle
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearHistory: () => set({ history: [] }),

  initializeFromStorage: (storedSettings) => {
    try {
      // Safely merge with defaults - handle partial or invalid data
      const safeSettings: Settings = {
        apiKey: storedSettings?.apiKey || defaultSettings.apiKey,
        baseUrl: storedSettings?.baseUrl || defaultSettings.baseUrl,
        refreshInterval: storedSettings?.refreshInterval ?? defaultSettings.refreshInterval,
        notificationsEnabled: storedSettings?.notificationsEnabled ?? defaultSettings.notificationsEnabled,
        alertThresholds: Array.isArray(storedSettings?.alertThresholds)
          ? storedSettings.alertThresholds
          : defaultSettings.alertThresholds,
        soundAlertEnabled: storedSettings?.soundAlertEnabled ?? defaultSettings.soundAlertEnabled,
        retentionDays: storedSettings?.retentionDays ?? defaultSettings.retentionDays,
        overlayMode: {
          enabled: storedSettings?.overlayMode?.enabled ?? defaultSettings.overlayMode.enabled,
          position: storedSettings?.overlayMode?.position || defaultSettings.overlayMode.position,
          opacity: storedSettings?.overlayMode?.opacity ?? defaultSettings.overlayMode.opacity,
          compact: storedSettings?.overlayMode?.compact ?? defaultSettings.overlayMode.compact,
          clickThrough: storedSettings?.overlayMode?.clickThrough ?? defaultSettings.overlayMode.clickThrough,
          showPercentage: storedSettings?.overlayMode?.showPercentage ?? defaultSettings.overlayMode.showPercentage,
          showProgressBar: storedSettings?.overlayMode?.showProgressBar ?? defaultSettings.overlayMode.showProgressBar,
        },
      }

      set({
        settings: safeSettings,
        isInitialized: true,
      })
    } catch (error) {
      console.error('Failed to initialize from storage, using defaults:', error)
      set({
        settings: defaultSettings,
        isInitialized: true,
      })
    }
  },

  // ---- Multi-account actions ----------------------------------------------

  setAccounts: (accounts) => set({ accounts }),

  addAccount: async (account) => {
    const accounts = [...get().accounts.filter((a) => a.id !== account.id), account]
    set({ accounts })
    set((state) => ({ accountUsage: { ...state.accountUsage, [account.id]: { status: 'loading' } } }))
    try {
      // Persist account metadata without apiKey; store the key encrypted separately
      const metaOnly = accounts.map(({ apiKey: _k, ...meta }) => meta)
      await window.api.store.set('accounts', metaOnly)
      if (account.apiKey) {
        await window.api.store.setSecret(`account-key-${account.id}`, account.apiKey)
      }
    } catch (error) {
      console.error('Failed to persist accounts:', error)
    }
  },

  removeAccount: async (id) => {
    const accounts = get().accounts.filter((a) => a.id !== id)
    const accountUsage = { ...get().accountUsage }
    delete accountUsage[id]
    set({ accounts, accountUsage })
    try {
      const metaOnly = accounts.map(({ apiKey: _k, ...meta }) => meta)
      await window.api.store.set('accounts', metaOnly)
      await window.api.store.deleteSecret(`account-key-${id}`)
    } catch (error) {
      console.error('Failed to persist accounts:', error)
    }
  },

  setAccountUsage: (id, state) =>
    set((s) => ({ accountUsage: { ...s.accountUsage, [id]: state } })),

  setProviders: (providers) => set({ providers }),

  setLocalAccounts: (localAccounts) => set({ localAccounts }),

  appendHistory: (id, sessionPercent, weeklyPercent) =>
    set((state) => {
      const prev = state.accountHistory[id] ?? []
      const next = [...prev, { t: Date.now(), s: sessionPercent, w: weeklyPercent }].slice(-48)
      return { accountHistory: { ...state.accountHistory, [id]: next } }
    }),

  refreshAccount: async (id) => {
    const account = get().accounts.find((a) => a.id === id)
    if (!account) return
    if (get().refreshingIds.includes(id)) return
    set((s) => ({ refreshingIds: [...s.refreshingIds, id] }))
    try {
      const res = await window.api.fetchAccountUsage({ ...account, forceRefresh: true })
      if (res.success && res.data) {
        const usage = res.data as import('@/types').ProviderUsage
        get().setAccountUsage(id, { status: 'ok', usage })
        get().appendHistory(id, usage.sessionPercent, usage.weeklyPercent)
      } else {
        get().setAccountUsage(id, {
          status: 'error',
          error: res.error || 'Failed to fetch usage',
          code: (res as { code?: string }).code,
        })
      }
    } finally {
      set((s) => ({ refreshingIds: s.refreshingIds.filter((x) => x !== id) }))
    }
  },
}))
