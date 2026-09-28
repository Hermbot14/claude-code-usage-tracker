import { OctagonAlert, TriangleAlert } from 'lucide-react'
import { Progress, ProgressLabel } from '@/components/ui/progress'
import { LEVEL_FILL, LEVEL_LABEL, LEVEL_TEXT, usageLevel } from '@/lib/usage-level'
import { cn, formatTimeRemaining } from '@/lib/utils'

/**
 * One usage window as shadcn's Progress: the label and window on the left,
 * the percentage on the right, the reset time under the bar.
 *
 * Past 70% the figure takes the level's colour AND an icon, and the level's
 * word is read out, so the warning never rests on colour alone.
 */
export function UsageMeter({
  label,
  windowLabel,
  percent,
  resetTime,
}: {
  label: string
  windowLabel: string
  percent: number
  resetTime: string
}) {
  const level = usageLevel(percent)
  const reset = formatTimeRemaining(resetTime)
  const Icon = level === 'critical' ? OctagonAlert : TriangleAlert
  return (
    <div className="flex flex-col gap-1">
      <Progress
        value={Math.min(Math.max(percent, 0), 100)}
        getAriaValueText={() => `${percent}% used, ${LEVEL_LABEL[level]}, resets in ${reset}`}
        className={cn(
          'gap-x-2 gap-y-1.5 [&_[data-slot=progress-track]]:h-1.5',
          LEVEL_FILL[level],
        )}
      >
        <ProgressLabel className="min-w-0 flex-1 truncate font-normal">
          {label} <span className="text-muted-foreground">· {windowLabel}</span>
        </ProgressLabel>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 font-mono text-sm font-medium tabular-nums',
            level !== 'ok' && LEVEL_TEXT[level],
          )}
        >
          {level !== 'ok' && <Icon className="size-3.5" aria-hidden />}
          {percent}%
        </span>
      </Progress>
      <p className="text-right font-mono text-xs text-muted-foreground">resets in {reset}</p>
    </div>
  )
}
