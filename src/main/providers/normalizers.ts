/**
 * Per-provider response normalizers → NormalizedUsage
 *
 * Each provider returns usage in its own shape; these map them all onto the
 * common { sessionPercent, weeklyPercent, resets } model. Field facts ported
 * from Aperant (usage-monitor.ts normalizeAnthropic/normalizeZAIResponse and
 * codex-usage-fetcher.ts normalizeCodexResponse).
 */

import type { NormalizedUsage, ProviderId } from './types'
import { getProvider } from './registry'

const clampPct = (n: unknown): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return Math.min(100, Math.max(0, Math.round(v)))
}

function windowLabels(provider: ProviderId) {
  const d = getProvider(provider)
  return { session: d.sessionWindowLabel, weekly: d.weeklyWindowLabel }
}

function inFiveHours(): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
}

function startOfNextMonth(): string {
  const now = new Date()
  const next = new Date(now)
  next.setUTCMonth(now.getUTCMonth() + 1, 1)
  next.setUTCHours(0, 0, 0, 0)
  return next.toISOString()
}

function inSevenDays(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
}

function pickLimitType(session: number, weekly: number): 'session' | 'weekly' | undefined {
  if (session >= 95) return 'session'
  if (weekly >= 95) return 'weekly'
  return session >= weekly ? 'session' : 'weekly'
}

// ---------------------------------------------------------------------------
// Anthropic — GET /api/oauth/usage
//   New:    { five_hour: { utilization: 0-100, resets_at }, seven_day: {...} }
//   Legacy: { five_hour_utilization: 0-1, five_hour_reset_at, seven_day_* }
// ---------------------------------------------------------------------------

interface AnthropicWindow {
  utilization?: number
  resets_at?: string
}
interface AnthropicUsageResponse {
  five_hour?: AnthropicWindow
  seven_day?: AnthropicWindow
  five_hour_utilization?: number
  five_hour_reset_at?: string
  seven_day_utilization?: number
  seven_day_reset_at?: string
  email?: string
  // Plan / subscription fields — Anthropic may return any of these.
  plan?: string
  plan_name?: string
  subscription?: { type?: string; plan?: string; tier?: string }
}

/** Map the raw plan string returned by Anthropic → a readable label. */
function normalizePlanLabel(data: AnthropicUsageResponse): string | undefined {
  const raw =
    data.plan ??
    data.plan_name ??
    data.subscription?.type ??
    data.subscription?.plan ??
    data.subscription?.tier
  if (!raw) return undefined
  const p = raw.toLowerCase().replace(/[-\s]/g, '_')
  if (p.includes('max_20') || p.includes('max20')) return 'Max 20x'
  if (p.includes('max_5') || p.includes('max5')) return 'Max 5x'
  if (p.includes('max')) return 'Max'
  if (p.includes('pro')) return 'Pro'
  if (p.includes('team')) return 'Team'
  if (p.includes('enterprise')) return 'Enterprise'
  if (p.includes('free')) return 'Free'
  // Unknown string — title-case it as a fallback.
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function normalizeAnthropic(data: AnthropicUsageResponse): NormalizedUsage {
  let sessionPercent: number
  let weeklyPercent: number
  let sessionReset: string | undefined
  let weeklyReset: string | undefined

  if (data.five_hour !== undefined || data.seven_day !== undefined) {
    // New nested format — utilization is already 0-100.
    sessionPercent = clampPct(data.five_hour?.utilization)
    weeklyPercent = clampPct(data.seven_day?.utilization)
    sessionReset = data.five_hour?.resets_at
    weeklyReset = data.seven_day?.resets_at
  } else {
    // Legacy flat format — utilization is a 0-1 float.
    sessionPercent = clampPct((data.five_hour_utilization ?? 0) * 100)
    weeklyPercent = clampPct((data.seven_day_utilization ?? 0) * 100)
    sessionReset = data.five_hour_reset_at
    weeklyReset = data.seven_day_reset_at
  }

  const labels = windowLabels('anthropic')
  return {
    provider: 'anthropic',
    sessionPercent,
    weeklyPercent,
    sessionResetTime: sessionReset ?? inFiveHours(),
    weeklyResetTime: weeklyReset ?? inSevenDays(),
    sessionWindowLabel: labels.session,
    weeklyWindowLabel: labels.weekly,
    limitType: pickLimitType(sessionPercent, weeklyPercent),
    email: data.email,
    planLabel: normalizePlanLabel(data),
    lastUpdated: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// OpenAI Codex — GET /backend-api/wham/usage
//   { rate_limit: { primary_window: { used_percent, reset_at }, secondary_window } }
//   reset_at is a Unix timestamp in SECONDS.
// ---------------------------------------------------------------------------

interface CodexWindow {
  used_percent?: number
  reset_at?: number
}
interface CodexUsageResponse {
  email?: string
  rate_limit?: {
    primary_window?: CodexWindow
    secondary_window?: CodexWindow | null
  }
}

export function normalizeCodex(data: CodexUsageResponse): NormalizedUsage {
  const primary = data.rate_limit?.primary_window
  const secondary = data.rate_limit?.secondary_window ?? undefined
  const sessionPercent = clampPct(primary?.used_percent)
  const weeklyPercent = clampPct(secondary?.used_percent)
  const toISO = (s?: number) => (s ? new Date(s * 1000).toISOString() : undefined)

  const labels = windowLabels('openai')
  return {
    provider: 'openai',
    sessionPercent,
    weeklyPercent,
    sessionResetTime: toISO(primary?.reset_at) ?? inFiveHours(),
    weeklyResetTime: toISO(secondary?.reset_at) ?? inSevenDays(),
    sessionWindowLabel: labels.session,
    weeklyWindowLabel: labels.weekly,
    limitType: pickLimitType(sessionPercent, weeklyPercent),
    email: data.email,
    lastUpdated: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Z.AI / Zhipu — GET /api/monitor/usage/quota/limit
//   { data: { limits: [ { type: 'TOKENS_LIMIT'|'TIME_LIMIT', percentage,
//                          currentValue, usage, nextResetTime(ms) } ] } }
// TOKENS_LIMIT → session (5h), TIME_LIMIT → weekly/monthly.
// ---------------------------------------------------------------------------

interface ZaiLimit {
  type?: string
  percentage?: number
  currentValue?: number
  usage?: number
  nextResetTime?: number
}
interface ZaiUsageResponse {
  data?: { limits?: ZaiLimit[] }
  limits?: ZaiLimit[]
}

export function normalizeZai(raw: ZaiUsageResponse, provider: ProviderId = 'zai'): NormalizedUsage {
  const limits = raw?.data?.limits ?? raw?.limits ?? []
  if (!Array.isArray(limits)) {
    throw new Error('Invalid Z.AI/Zhipu response: missing limits array')
  }
  const tokens = limits.find((l) => l.type === 'TOKENS_LIMIT')
  const time = limits.find((l) => l.type === 'TIME_LIMIT')

  const sessionPercent = clampPct(tokens?.percentage)
  const weeklyPercent = clampPct(time?.percentage)
  const toISO = (ms?: number) => (ms ? new Date(ms).toISOString() : undefined)

  const labels = windowLabels(provider)
  return {
    provider,
    sessionPercent,
    weeklyPercent,
    sessionResetTime: toISO(tokens?.nextResetTime) ?? inFiveHours(),
    weeklyResetTime: toISO(time?.nextResetTime) ?? startOfNextMonth(),
    sessionUsage: tokens?.currentValue,
    sessionLimit: tokens?.usage,
    weeklyUsage: time?.currentValue,
    weeklyLimit: time?.usage,
    sessionWindowLabel: labels.session,
    weeklyWindowLabel: labels.weekly,
    limitType: pickLimitType(sessionPercent, weeklyPercent),
    lastUpdated: new Date().toISOString(),
  }
}
