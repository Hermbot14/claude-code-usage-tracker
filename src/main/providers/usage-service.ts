/**
 * Multi-provider usage service
 *
 * Replaces the single-provider api-service.ts. Given an account, it resolves the
 * usage endpoint and credential from the registry, fetches, and normalizes the
 * response to NormalizedUsage. This is the runtime core extracted from Aperant's
 * usage-monitor.ts, minus the auto-switch/profile-scoring machinery (not needed
 * for a usage tracker).
 */

import type { UsageData } from '../../renderer/types'
import type { FetchUsageResult, NormalizedUsage, ProviderId } from './types'
import { getProvider, getUsageEndpoint } from './registry'
import { readLocalCredential } from './credentials'
import { getFreshClaudeToken } from './claude-token'
import { normalizeAnthropic, normalizeCodex, normalizeZai } from './normalizers'

const REQUEST_TIMEOUT_MS = 12_000
/** How long to back off an account after the provider returns 429. */
const RATE_LIMIT_COOLDOWN_MS = 90_000

// Per-account caches (account.id keyed). Module-level so they persist across polls.
const lastGood = new Map<string, NormalizedUsage>()
const lastFetchAt = new Map<string, number>()
const lastAttemptAt = new Map<string, number>()
const cooldownUntil = new Map<string, number>()

export interface UsageAccount {
  id: string
  name: string
  provider: ProviderId
  /** API key for `apiKey`/`oauthPaste` providers. Ignored for `oauthLocal`. */
  apiKey?: string
  /** Optional base-URL override (e.g. a regional ZAI/Zhipu endpoint). */
  baseUrl?: string
  /** When true, clears any active cooldown before fetching (used by manual refresh). */
  forceRefresh?: boolean
}

interface ResolvedCredential {
  token: string | null
  accountId?: string | null
  email?: string | null
  error?: string
}

async function resolveCredential(account: UsageAccount, forceRefresh = false): Promise<ResolvedCredential> {
  const desc = getProvider(account.provider)
  if (desc.auth === 'oauthLocal' && desc.localCredential) {
    // Anthropic tokens expire every ~8h — refresh (and persist) when needed.
    if (account.provider === 'anthropic') {
      const fresh = await getFreshClaudeToken(forceRefresh)
      return { token: fresh.token, email: fresh.email, error: fresh.error }
    }
    const local = readLocalCredential(desc.localCredential)
    return { token: local.token, accountId: local.accountId, email: local.email, error: local.error }
  }
  // apiKey or pasted OAuth token
  const key = account.apiKey?.trim()
  return key ? { token: key } : { token: null, error: 'No API key configured for this account' }
}

function buildHeaders(provider: ProviderId, token: string, accountId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (provider === 'anthropic') {
    // OAuth usage endpoint requires the Claude Code beta headers.
    headers['anthropic-beta'] = 'claude-code-20250219,oauth-2025-04-20'
    headers['anthropic-version'] = '2023-06-01'
  } else if (provider === 'openai' && accountId) {
    headers['ChatGPT-Account-Id'] = accountId
  }
  return headers
}

function normalize(provider: ProviderId, json: unknown): NormalizedUsage {
  switch (provider) {
    case 'anthropic':
      return normalizeAnthropic(json as never)
    case 'openai':
      return normalizeCodex(json as never)
    case 'zai':
    case 'zhipu':
      return normalizeZai(json as never, provider)
    default:
      throw new Error(`No normalizer for provider: ${provider}`)
  }
}

/** Fetch and normalize usage for a single account. */
export async function fetchAccountUsage(account: UsageAccount): Promise<FetchUsageResult> {
  const desc = getProvider(account.provider)

  if (!desc.implemented || desc.capability !== 'quota') {
    return {
      ok: false,
      code: 'unsupported',
      error: `${desc.label} usage tracking isn't wired yet${desc.notes ? ` — ${desc.notes}` : ''}`,
    }
  }

  const baseUrl = account.baseUrl || desc.baseUrl
  const endpoint = getUsageEndpoint(account.provider, baseUrl)
  if (!endpoint) {
    return { ok: false, code: 'unsupported', error: `No usage endpoint configured for ${desc.label}` }
  }

  // SSRF guard: only allow the provider's known hosts.
  let hostname: string
  try {
    hostname = new URL(endpoint).hostname
  } catch {
    return { ok: false, code: 'network', error: `Invalid usage endpoint: ${endpoint}` }
  }
  const hostAllowed = desc.allowedHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))
  if (!hostAllowed) {
    return { ok: false, code: 'network', error: `Unauthorized domain: ${hostname}` }
  }

  const now = Date.now()

  // Manual refresh clears any active cooldown so the user can force a retry.
  if (account.forceRefresh) {
    cooldownUntil.delete(account.id)
  }

  // Serve the last good snapshot while in a rate-limit cooldown.
  const cooldown = cooldownUntil.get(account.id)
  if (cooldown && now < cooldown) {
    const cached = lastGood.get(account.id)
    if (cached) return { ok: true, usage: cached }
    const secsLeft = Math.ceil((cooldown - now) / 1000)
    return { ok: false, code: 'rate_limit', error: `${desc.label} rate-limited — retrying in ${secsLeft}s` }
  }

  // Throttle providers with a minimum poll interval (e.g. Anthropic 60s).
  // Applied even when there is no cached data so a polling loop can't hammer the endpoint.
  const minPoll = desc.minPollMs ?? 0
  const lastAttempt = lastAttemptAt.get(account.id)
  if (minPoll && lastAttempt && now - lastAttempt < minPoll) {
    const cached = lastGood.get(account.id)
    if (cached) return { ok: true, usage: cached }
    return { ok: false, code: 'throttled', error: '' }
  }
  lastAttemptAt.set(account.id, now)

  const performFetch = async (forceRefresh: boolean): Promise<FetchUsageResult> => {
    const cred = await resolveCredential(account, forceRefresh)
    if (!cred.token) {
      return {
        ok: false,
        code: 'no_credential',
        error:
          cred.error ??
          (desc.auth === 'oauthLocal'
            ? `No local ${desc.label} login found — sign in with the ${desc.label} CLI first`
            : 'No credential configured'),
      }
    }

    lastFetchAt.set(account.id, Date.now())
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: buildHeaders(account.provider, cred.token, cred.accountId),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, code: 'auth', error: `Authentication failed (${response.status}) for ${desc.label}` }
      }
      if (response.status === 429) {
        cooldownUntil.set(account.id, Date.now() + RATE_LIMIT_COOLDOWN_MS)
        const prev = lastGood.get(account.id)
        if (prev) return { ok: true, usage: prev }
        return { ok: false, code: 'rate_limit', error: `Rate limited by ${desc.label} — backing off` }
      }
      return { ok: false, code: 'network', error: `${desc.label} request failed: ${response.status} ${response.statusText}` }
    }

    const json = await response.json()
    const usage = normalize(account.provider, json)
    // Prefer the email the local credential gave us if the API didn't return one.
    if (!usage.email && cred.email) usage.email = cred.email
    lastGood.set(account.id, usage)
    cooldownUntil.delete(account.id)
    return { ok: true, usage }
  }

  try {
    let result = await performFetch(false)
    // For Anthropic a 401 usually means the cached token just expired — force a
    // token refresh and retry once.
    if (!result.ok && result.code === 'auth' && account.provider === 'anthropic') {
      result = await performFetch(true)
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch usage'
    return { ok: false, code: 'network', error: message }
  }
}

/**
 * Map a NormalizedUsage to the legacy UsageData shape so existing renderer
 * components (UsageDisplay, tray, overlay) keep working unchanged.
 */
export function toLegacyUsageData(u: NormalizedUsage): UsageData {
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
