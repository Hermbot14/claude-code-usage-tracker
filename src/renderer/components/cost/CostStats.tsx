import type { CostSummary } from '@/types'
import { compactTokens, usd } from './format'

interface Stat {
  label: string
  value: string
  hint?: string
}

/**
 * Vercel's stat panel: one bordered panel split into cells by 1px gaps over
 * the border colour, not separate floating cards. Then the token mix, each
 * colour always beside its word.
 */
export function CostStats({ summary }: { summary: CostSummary }) {
  const stats: Stat[] = [
    { label: 'Today', value: usd(summary.today) },
    { label: 'Last 7 days', value: usd(summary.last7Days) },
    {
      label: 'All time',
      value: usd(summary.total),
      hint: `${summary.sessionCount.toLocaleString()} sessions`,
    },
  ]
  const { tokens } = summary
  const total = tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead
  const mix = [
    { label: 'Input', value: tokens.input, dot: 'bg-chart-1' },
    { label: 'Output', value: tokens.output, dot: 'bg-chart-4' },
    { label: 'Cache write', value: tokens.cacheWrite, dot: 'bg-chart-3' },
    { label: 'Cache read', value: tokens.cacheRead, dot: 'bg-chart-2' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border min-[420px]:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-1 bg-card p-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="truncate text-xl font-semibold tracking-tight tabular-nums" title={s.value}>
              {s.value}
            </dd>
            {s.hint && <dd className="text-xs text-muted-foreground">{s.hint}</dd>}
          </div>
        ))}
      </dl>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {mix.map((m) => (
          <li key={m.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-full ${m.dot}`} />
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-mono font-medium tabular-nums">{compactTokens(m.value)}</span>
          </li>
        ))}
        <li className="ml-auto font-mono text-muted-foreground tabular-nums">
          {compactTokens(total)} tokens
        </li>
      </ul>
    </div>
  )
}
