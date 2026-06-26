/**
 * Provider engine types
 *
 * Every supported coding-plan provider is normalized to a single shape:
 * a 5-hour "session" window percentage and a longer "weekly"/monthly window
 * percentage, plus reset timestamps. This mirrors the model extracted from
 * Aperant (apps/desktop/src/main/claude-profile/usage-monitor.ts) and is what
 * lets one UI render Claude, GLM, Codex and friends side by side.
 */

/** Canonical provider identifiers. */
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

/**
 * How a provider's usage credential is obtained.
 * - `apiKey`     : user pastes an API key (ZAI/Zhipu/Deepseek/Kimi/Minimax)
 * - `oauthLocal` : read the subscription OAuth token the provider's CLI already
 *                  stored on disk / in the OS keychain (Claude Code, Codex, Qwen)
 * - `oauthPaste` : user pastes an OAuth access token manually (fallback)
 */
export type AuthKind = 'apiKey' | 'oauthLocal' | 'oauthPaste'

/**
 * What kind of usage data the provider exposes.
 * - `quota`   : session/weekly utilization percentages (the rich case)
 * - `balance` : only a remaining-credit/balance figure (no session window)
 * - `none`    : no public usage endpoint yet — scaffolded for future support
 */
export type ProviderCapability = 'quota' | 'balance' | 'none'

/** Where a locally-stored OAuth token lives, for `oauthLocal` providers. */
export type LocalCredentialSource = 'claude' | 'codex' | 'qwen'

export interface ProviderDescriptor {
  id: ProviderId
  /** Human-readable label, e.g. "Claude Code". */
  label: string
  /** Short tag shown on the account card. */
  shortLabel: string
  /** Default API base URL for this provider's coding plan. */
  baseUrl: string
  /**
   * Usage endpoint path appended to the ORIGIN of the account's base URL.
   * `null` when the provider has no usage endpoint (capability !== 'quota').
   */
  usagePath: string | null
  auth: AuthKind
  capability: ProviderCapability
  /** Source to auto-read a token from, when auth === 'oauthLocal'. */
  localCredential?: LocalCredentialSource
  /** Hostnames permitted for outbound usage requests (SSRF guard). */
  allowedHosts: string[]
  /** Tailwind classes for the provider badge. */
  badgeClass: string
  /** Label for the short (≈5h) window, e.g. "5-hour". */
  sessionWindowLabel: string
  /** Label for the long window, e.g. "7-day" or "monthly". */
  weeklyWindowLabel: string
  /**
   * Minimum interval between live usage fetches for this provider, in ms.
   * Polls inside this window are served from the last good snapshot. Anthropic's
   * usage endpoint rate-limits aggressively, so it needs a higher floor than the
   * UI refresh interval (which suits ZAI's 5s polling).
   */
  minPollMs?: number
  /**
   * `true`  → a real adapter is wired and the provider fetches live data.
   * `false` → registry stub; selecting it explains it's not yet supported.
   */
  implemented: boolean
  /** Optional note surfaced in the UI (e.g. "balance only"). */
  notes?: string
}

/** Normalized usage snapshot — provider-agnostic. */
export interface NormalizedUsage {
  provider: ProviderId
  /** 0–100, short (~5h) window. */
  sessionPercent: number
  /** 0–100, long (weekly/monthly) window. */
  weeklyPercent: number
  /** ISO timestamp when the session window resets. */
  sessionResetTime: string
  /** ISO timestamp when the weekly window resets. */
  weeklyResetTime: string
  /** Raw token/credit figures when the provider exposes them. */
  sessionUsage?: number
  sessionLimit?: number
  weeklyUsage?: number
  weeklyLimit?: number
  sessionWindowLabel: string
  weeklyWindowLabel: string
  /** Which window is closest to its limit. */
  limitType?: 'session' | 'weekly'
  /** Account email if the provider returns one. */
  email?: string
  /** Human-readable plan label if the provider returns one (e.g. "Max 20x", "Pro"). */
  planLabel?: string
  /** ISO timestamp of capture. */
  lastUpdated: string
}

/** Result of a usage fetch attempt. */
export type FetchUsageResult =
  | { ok: true; usage: NormalizedUsage }
  | { ok: false; error: string; code?: 'auth' | 'rate_limit' | 'unsupported' | 'no_credential' | 'network' }
