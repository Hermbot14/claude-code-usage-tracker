// ZAI API Response Types
export interface ZAILimit {
  type: 'TOKENS_LIMIT' | 'TIME_LIMIT'
  percentage: number
  unit?: string
  number?: number
  usage: number
  currentValue: number
  remaining?: number
  nextResetTime: number
  usageDetails?: {
    unit: string
    window: string
  }
}

export interface ZAIUsageResponse {
  data: {
    limits: ZAILimit[]
  }
}

// Application Types
export interface UsageData {
  sessionUsage: number
  sessionLimit: number
  sessionPercent: number
  sessionResetTime: string
  weeklyUsage: number
  weeklyLimit: number
  weeklyPercent: number
  weeklyResetTime: string
  lastUpdated: string
}

export interface UsageHistoryEntry {
  date: string
  sessionUsage: number
  sessionPercent: number
  weeklyUsage: number
  weeklyPercent: number
}

export interface Account {
  id: string
  name: string
  provider: 'zai' | 'anthropic' | 'openai'
  apiKey: string
  baseUrl: string
  isActive: boolean
}

// Overlay Mode Types
export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface OverlaySettings {
  enabled: boolean
  position: OverlayPosition
  opacity: number // 50-100
  compact: boolean
  clickThrough: boolean
  showPercentage: boolean
  showProgressBar: boolean
}

export interface Settings {
  apiKey: string
  baseUrl: string
  refreshInterval: number // seconds
  notificationsEnabled: boolean
  alertThresholds: number[] // [80, 90, 100]
  soundAlertEnabled: boolean
  retentionDays: number
  overlayMode: OverlaySettings
}

export interface UsageSnapshot extends UsageData {
  accountId: string
  timestamp: number
}

export interface StoreState {
  accounts: Account[]
  activeAccountId: string | null
  currentUsage: UsageData | null
  history: UsageHistoryEntry[]
  settings: Settings
  isLoading: boolean
  error: string | null
  lastFetchTime: number | null
}

// ---------------------------------------------------------------------------
// Multi-provider types (mirror of src/main/providers/types.ts NormalizedUsage)
// ---------------------------------------------------------------------------

export type ProviderId =
  | 'anthropic'
  | 'zai'
  | 'zhipu'
  | 'openai'
  | 'kimi'
  | 'minimax'
  | 'qwen'
  | 'deepseek'
  | 'opencode'
  | 'unknown'

/** Provider catalog entry returned by window.api.listProviders(). */
export interface ProviderInfo {
  id: ProviderId
  label: string
  shortLabel: string
  baseUrl: string
  auth: 'apiKey' | 'oauthLocal' | 'oauthPaste'
  capability: 'quota' | 'balance' | 'none'
  implemented: boolean
  badgeClass: string
  sessionWindowLabel: string
  weeklyWindowLabel: string
  notes?: string
}

/** A configured account the user tracks. */
export interface AccountConfig {
  id: string
  name: string
  provider: ProviderId
  /** API key for apiKey/oauthPaste providers; omitted for oauthLocal. */
  apiKey?: string
  /** Optional base-URL override. */
  baseUrl?: string
}

/** Normalized usage for one account (matches main-process NormalizedUsage). */
export interface ProviderUsage {
  provider: ProviderId
  sessionPercent: number
  weeklyPercent: number
  sessionResetTime: string
  weeklyResetTime: string
  sessionUsage?: number
  sessionLimit?: number
  weeklyUsage?: number
  weeklyLimit?: number
  sessionWindowLabel: string
  weeklyWindowLabel: string
  limitType?: 'session' | 'weekly'
  email?: string
  /** Human-readable plan label if the provider returns one (e.g. "Max 20x", "Pro"). */
  planLabel?: string
  lastUpdated: string
}

/** Per-account live state held in the store. */
export type AccountUsageState =
  | { status: 'loading' }
  | { status: 'ok'; usage: ProviderUsage }
  | { status: 'error'; error: string; code?: string }

/** A locally-detected OAuth login (Claude Code / Codex / Qwen). */
export interface LocalAccountInfo {
  provider: ProviderId
  email?: string | null
}

// Usage Status
export type UsageStatus = 'healthy' | 'warning' | 'critical'

export function getUsageStatus(percent: number): UsageStatus {
  if (percent >= 80) return 'critical'
  if (percent >= 50) return 'warning'
  return 'healthy'
}

// IPC Channel Types
export interface IpcChannels {
  'fetch-usage': { apiKey: string; baseUrl: string }
  'store-get': { key: string; defaultValue?: unknown }
  'store-set': { key: string; value: unknown }
  'store-delete': { key: string }
  'store-clear': never
  'store-getAll': never
  'show-notification': { title: string; body: string }
  'update-tray': { usage: UsageData | null }
  'minimize-to-tray': never
  'get-app-version': never
}
