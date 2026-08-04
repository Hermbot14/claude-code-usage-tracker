import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, basename, dirname } from 'node:path'

/**
 * API-equivalent cost tracking for Claude Code.
 *
 * Reads the cost ledger written by the ECC cost-tracker hook
 * (~/.claude/metrics/costs.jsonl) and turns it into accurate dollar figures.
 *
 * Two things the raw ledger gets wrong, both corrected here:
 *   1. The hook appends a CUMULATIVE row per session on every Stop event, so
 *      summing rows double-counts. Rows are deduplicated by session_id.
 *   2. The hook's stored `estimated_cost_usd` has historically used stale rates
 *      (Opus at $15/$75 — legacy Opus 3 pricing). We ignore it entirely and
 *      recompute from the raw token counts, which are reliable.
 *
 * Users on a coding plan are not billed per token; this is the "what would this
 * have cost on API billing" view.
 */

/** USD per 1M tokens. Source: platform.claude.com/docs/en/pricing */
const RATES = {
  fable: { in: 10.0, out: 50.0 }, // Claude Fable 5 / Mythos 5
  opus: { in: 5.0, out: 25.0 }, // Opus 5, 4.8, 4.7, 4.6
  opusLegacy: { in: 15.0, out: 75.0 }, // Opus 4.5 and older
  sonnet: { in: 3.0, out: 15.0 }, // Sonnet 5, 4.6
  haiku: { in: 1.0, out: 5.0 } // Haiku 4.5
} as const

interface Rates {
  in: number
  out: number
  cacheWrite: number
  cacheRead: number
}

/**
 * Cache write is billed at 1.25x input for the 5-minute TTL (2x for 1-hour).
 * The ledger does not record which TTL was used, so we assume 5 minutes —
 * the common case. Cache read is 0.1x input.
 */
function ratesFor(model: string | undefined): Rates {
  const m = String(model ?? '').toLowerCase()
  let base: { in: number; out: number }
  if (m.includes('haiku')) base = RATES.haiku
  else if (m.includes('fable') || m.includes('mythos')) base = RATES.fable
  else if (m.includes('opus'))
    base = /opus-(4-5|4-1|4-0)|3-opus/.test(m) ? RATES.opusLegacy : RATES.opus
  else base = RATES.sonnet
  return { ...base, cacheWrite: base.in * 1.25, cacheRead: base.in * 0.1 }
}

interface CostRow {
  timestamp?: string
  session_id?: string
  transcript_path?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
  cache_write_tokens?: number
  cache_read_tokens?: number
  estimated_cost_usd?: number
}

export interface CostSession {
  sessionId: string
  date: string
  model: string
  project: string
  cost: number
  tokens: {
    input: number
    output: number
    cacheWrite: number
    cacheRead: number
  }
}

export interface CostSummary {
  available: boolean
  /** Human-readable reason when `available` is false. */
  reason?: string
  total: number
  today: number
  last7Days: number
  sessionCount: number
  sessions: CostSession[]
  byProject: { project: string; cost: number }[]
  tokens: { input: number; output: number; cacheWrite: number; cacheRead: number }
  /** What the raw ledger claims, for comparison — usually inflated. */
  ledgerReportedTotal: number
  updatedAt: string
}

function costOf(row: CostRow): number {
  const r = ratesFor(row.model)
  return (
    ((row.input_tokens ?? 0) / 1e6) * r.in +
    ((row.output_tokens ?? 0) / 1e6) * r.out +
    ((row.cache_write_tokens ?? 0) / 1e6) * r.cacheWrite +
    ((row.cache_read_tokens ?? 0) / 1e6) * r.cacheRead
  )
}

function tokenWeight(row: CostRow): number {
  return (
    (row.input_tokens ?? 0) +
    (row.output_tokens ?? 0) +
    (row.cache_write_tokens ?? 0) +
    (row.cache_read_tokens ?? 0)
  )
}

function emptySummary(reason: string): CostSummary {
  return {
    available: false,
    reason,
    total: 0,
    today: 0,
    last7Days: 0,
    sessionCount: 0,
    sessions: [],
    byProject: [],
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    ledgerReportedTotal: 0,
    updatedAt: new Date().toISOString()
  }
}

/** Strip the Claude-Code project-directory mangling into something readable. */
function projectLabel(transcriptPath: string | undefined): string {
  const raw = basename(dirname(transcriptPath ?? ''))
  if (!raw) return 'Unknown'
  // e.g. "C--Repositories-claude-code-usage-tracker" -> "claude-code-usage-tracker"
  return raw.replace(/^[A-Za-z]--/, '').replace(/^.*?Repositories-/, '') || raw
}

export async function getCostSummary(): Promise<CostSummary> {
  const ledgerPath = join(homedir(), '.claude', 'metrics', 'costs.jsonl')

  let text: string
  try {
    text = await readFile(ledgerPath, 'utf8')
  } catch {
    return emptySummary(
      'No cost ledger found. Expected ~/.claude/metrics/costs.jsonl (written by the ECC cost-tracker hook).'
    )
  }

  const rows: CostRow[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      rows.push(JSON.parse(t) as CostRow)
    } catch {
      /* skip malformed line */
    }
  }
  if (rows.length === 0) return emptySummary('Cost ledger is empty.')

  // Group by session so cumulative rows can be both collapsed (for totals) and
  // differenced (for per-day attribution).
  const bySession = new Map<string, CostRow[]>()
  for (const r of rows) {
    const key = r.session_id ?? `${r.timestamp}`
    const list = bySession.get(key)
    if (list) list.push(r)
    else bySession.set(key, [r])
  }

  // Per-day spend. Each row restates the session's running total, so the amount
  // earned on a given day is the increase over the previous row — attributing a
  // long session's whole cost to its last active day would badly overstate it.
  const daily = new Map<string, number>()
  const best = new Map<string, CostRow>()

  for (const [key, list] of bySession) {
    list.sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')))
    let running = 0
    for (const r of list) {
      const c = costOf(r)
      // Clamp: a truncated or out-of-order row must not subtract from a day.
      const delta = Math.max(0, c - running)
      if (delta > 0) {
        const day = String(r.timestamp ?? '').slice(0, 10)
        daily.set(day, (daily.get(day) ?? 0) + delta)
      }
      if (c > running) running = c
    }
    // Heaviest row represents the session as a whole (identity + final total).
    best.set(key, list.reduce((a, b) => (tokenWeight(b) > tokenWeight(a) ? b : a)))
  }

  const sessions: CostSession[] = [...best.values()]
    .map((r) => ({
      sessionId: r.session_id ?? '',
      date: String(r.timestamp ?? '').slice(0, 10),
      model: r.model ?? 'unknown',
      project: projectLabel(r.transcript_path),
      cost: costOf(r),
      tokens: {
        input: r.input_tokens ?? 0,
        output: r.output_tokens ?? 0,
        cacheWrite: r.cache_write_tokens ?? 0,
        cacheRead: r.cache_read_tokens ?? 0
      }
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.cost - a.cost))

  const todayStr = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)

  const byProjectMap = new Map<string, number>()
  const tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
  let total = 0

  // Windowed figures come from the per-day deltas, not from session totals.
  let today = 0
  let last7Days = 0
  for (const [day, amount] of daily) {
    if (day === todayStr) today += amount
    if (day >= weekAgo) last7Days += amount
  }

  for (const s of sessions) {
    total += s.cost
    byProjectMap.set(s.project, (byProjectMap.get(s.project) ?? 0) + s.cost)
    tokens.input += s.tokens.input
    tokens.output += s.tokens.output
    tokens.cacheWrite += s.tokens.cacheWrite
    tokens.cacheRead += s.tokens.cacheRead
  }

  return {
    available: true,
    total,
    today,
    last7Days,
    sessionCount: sessions.length,
    sessions: sessions.slice(0, 25),
    byProject: [...byProjectMap.entries()]
      .map(([project, cost]) => ({ project, cost }))
      .sort((a, b) => b.cost - a.cost),
    tokens,
    ledgerReportedTotal: [...best.values()].reduce(
      (sum, r) => sum + (r.estimated_cost_usd ?? 0),
      0
    ),
    updatedAt: new Date().toISOString()
  }
}
