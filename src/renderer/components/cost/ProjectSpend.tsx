import { Progress, ProgressLabel } from '@/components/ui/progress'
import { usd } from './format'

/**
 * Spend by project as shadcn Progress rows, each bar a share of the top
 * project: length carries the comparison, the figure the value.
 */
export function ProjectSpend({ projects }: { projects: { project: string; cost: number }[] }) {
  const top = projects[0]?.cost || 1
  return (
    <section aria-labelledby="cost-by-project" className="flex flex-col gap-3">
      <h3 id="cost-by-project" className="text-xs font-medium text-muted-foreground">
        By project
      </h3>
      {projects.map((p) => (
        <Progress
          key={p.project}
          value={Math.max(2, (p.cost / top) * 100)}
          getAriaValueText={() => usd(p.cost)}
          className="gap-x-2 gap-y-1.5 [&_[data-slot=progress-indicator]]:bg-data [&_[data-slot=progress-track]]:h-1.5"
        >
          <ProgressLabel className="min-w-0 flex-1 truncate font-normal" title={p.project}>
            {p.project}
          </ProgressLabel>
          <span className="shrink-0 font-mono text-sm font-medium tabular-nums">{usd(p.cost)}</span>
        </Progress>
      ))}
    </section>
  )
}
