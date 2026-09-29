/**
 * Provider registry
 *
 * Declarative catalog of supported coding-plan providers. Adding a new provider
 * is (ideally) a new entry here plus, if it has a novel response shape, one
 * normalizer in normalizers.ts. Entries with `implemented: false` are scaffolds:
 * they appear in the picker but the service returns an "unsupported" result
 * until an adapter is wired — we deliberately do NOT invent endpoints that don't
 * exist.
 *
 * Endpoint facts ported from Aperant
 * (apps/desktop/src/main/claude-profile/usage-monitor.ts):
 *   anthropic → /api/oauth/usage          (OAuth, anthropic-beta header)
 *   openai    → /backend-api/wham/usage    (ChatGPT OAuth)
 *   zai/zhipu → /api/monitor/usage/quota/limit (API key)
 */

import type { ProviderDescriptor, ProviderId } from './types'

export const PROVIDERS: Record<ProviderId, ProviderDescriptor> = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude Code',
    shortLabel: 'Claude',
    baseUrl: 'https://api.anthropic.com',
    usagePath: '/api/oauth/usage',
    auth: 'oauthLocal',
    localCredential: 'claude',
    capability: 'quota',
    allowedHosts: ['api.anthropic.com'],
    badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    sessionWindowLabel: '5-hour',
    weeklyWindowLabel: '7-day',
    minPollMs: 60_000, // Anthropic's usage endpoint rate-limits frequent polls
    implemented: true,
    notes: 'Reads the OAuth token Claude Code stored locally (~/.claude); auto-refreshes when expired.',
  },

  zai: {
    id: 'zai',
    label: 'Z.AI GLM Coding Plan',
    shortLabel: 'Z.AI',
    baseUrl: 'https://api.z.ai/api/anthropic',
    usagePath: '/api/monitor/usage/quota/limit',
    auth: 'apiKey',
    capability: 'quota',
    allowedHosts: ['api.z.ai', 'z.ai'],
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    sessionWindowLabel: '5-hour',
    weeklyWindowLabel: 'monthly',
    implemented: true,
  },

  zhipu: {
    id: 'zhipu',
    label: 'Zhipu GLM (BigModel)',
    shortLabel: 'Zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    usagePath: '/api/monitor/usage/quota/limit',
    auth: 'apiKey',
    capability: 'quota',
    allowedHosts: ['open.bigmodel.cn', 'bigmodel.cn'],
    badgeClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    sessionWindowLabel: '5-hour',
    weeklyWindowLabel: 'monthly',
    implemented: true,
    notes: 'Same quota API shape as Z.AI (CN endpoint).',
  },

  openai: {
    id: 'openai',
    label: 'OpenAI Codex',
    shortLabel: 'Codex',
    baseUrl: 'https://chatgpt.com',
    usagePath: '/backend-api/wham/usage',
    auth: 'oauthLocal',
    localCredential: 'codex',
    capability: 'quota',
    allowedHosts: ['chatgpt.com'],
    badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20',
    sessionWindowLabel: '5-hour',
    weeklyWindowLabel: 'weekly',
    minPollMs: 60_000,
    implemented: true,
    notes: 'Reads the ChatGPT OAuth token Codex stored locally (~/.codex).',
  },

  // ---- Scaffolded providers (no wired adapter yet) -------------------------
  // These have either a balance-only API or no public usage endpoint. They are
  // listed so they show in the picker and so wiring them later is a small,
  // localized change rather than a refactor.

  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    usagePath: null, // balance endpoint exists (/user/balance) but it's credit, not a session window
    auth: 'apiKey',
    capability: 'balance',
    allowedHosts: ['api.deepseek.com'],
    badgeClass: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    sessionWindowLabel: 'n/a',
    weeklyWindowLabel: 'balance',
    implemented: false,
    notes: 'Exposes account balance only, no session/weekly quota window.',
  },

  kimi: {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    shortLabel: 'Kimi',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    usagePath: null, // /v1/users/me/balance is balance, not a quota window
    auth: 'apiKey',
    capability: 'balance',
    allowedHosts: ['api.moonshot.ai', 'api.moonshot.cn'],
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    sessionWindowLabel: 'n/a',
    weeklyWindowLabel: 'balance',
    implemented: false,
    notes: 'Balance API only; coding-plan quota window not publicly exposed.',
  },

  qwen: {
    id: 'qwen',
    label: 'Qwen Code',
    shortLabel: 'Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com',
    usagePath: null, // Qwen Code uses its own OAuth; no documented usage-window endpoint yet
    auth: 'oauthLocal',
    localCredential: 'qwen',
    capability: 'none',
    allowedHosts: ['dashscope.aliyuncs.com', 'chat.qwen.ai'],
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
    sessionWindowLabel: 'n/a',
    weeklyWindowLabel: 'n/a',
    implemented: false,
    notes: 'Qwen Code OAuth; no public usage-window endpoint confirmed.',
  },

  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    shortLabel: 'MiniMax',
    baseUrl: 'https://api.minimax.chat',
    usagePath: null,
    auth: 'apiKey',
    capability: 'none',
    allowedHosts: ['api.minimax.chat', 'api.minimaxi.com'],
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    sessionWindowLabel: 'n/a',
    weeklyWindowLabel: 'n/a',
    implemented: false,
    notes: 'No public usage/quota endpoint confirmed.',
  },

  opencode: {
    id: 'opencode',
    label: 'OpenCode Zen',
    shortLabel: 'OpenCode',
    baseUrl: 'https://opencode.ai',
    usagePath: null,
    auth: 'apiKey',
    capability: 'none',
    allowedHosts: ['opencode.ai', 'api.opencode.ai'],
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    sessionWindowLabel: 'n/a',
    weeklyWindowLabel: 'n/a',
    implemented: false,
    notes: 'Placeholder: confirm the usage endpoint before wiring.',
  },

  unknown: {
    id: 'unknown',
    label: 'Custom / Unknown',
    shortLabel: 'Custom',
    baseUrl: '',
    usagePath: null,
    auth: 'apiKey',
    capability: 'none',
    allowedHosts: [],
    badgeClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    sessionWindowLabel: 'n/a',
    weeklyWindowLabel: 'n/a',
    implemented: false,
  },
}

/** All providers in display order (implemented first). */
export const PROVIDER_LIST: ProviderDescriptor[] = Object.values(PROVIDERS)
  .filter((p) => p.id !== 'unknown')
  .sort((a, b) => Number(b.implemented) - Number(a.implemented))

export function getProvider(id: ProviderId | string): ProviderDescriptor {
  return PROVIDERS[id as ProviderId] ?? PROVIDERS.unknown
}

/**
 * Detect provider from a base URL by hostname (ported from Aperant's
 * shared/utils/provider-detection.ts).
 */
export function detectProvider(baseUrl: string): ProviderId {
  try {
    const host = new URL(baseUrl).hostname
    for (const p of Object.values(PROVIDERS)) {
      if (p.id === 'unknown') continue
      for (const h of p.allowedHosts) {
        if (host === h || host.endsWith(`.${h}`)) return p.id
      }
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Build the full usage endpoint URL for an account: the provider's usagePath
 * applied to the ORIGIN of the (possibly user-overridden) base URL.
 */
export function getUsageEndpoint(provider: ProviderId, baseUrl: string): string | null {
  const desc = getProvider(provider)
  if (!desc.usagePath) return null
  try {
    const url = new URL(baseUrl || desc.baseUrl)
    url.pathname = desc.usagePath
    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}
