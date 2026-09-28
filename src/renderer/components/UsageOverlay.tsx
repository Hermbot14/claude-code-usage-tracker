import { Maximize2, OctagonAlert, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LevelBadge } from '@/components/usage/LevelBadge'
import { LEVEL_FILL, LEVEL_LABEL, LEVEL_TEXT, usageLevel } from '@/lib/usage-level'
import { cn, formatTime, formatTimeRemaining } from '@/lib/utils'
import { useUsageStore } from '@stores/useUsageStore'

export interface UsageOverlayProps {
  onExpand?: () => void
}

/**
 * The 200x200 always-on-top overlay: session usage and time to reset.
 *
 * The whole card drags the window (-webkit-app-region); the expand button
 * opts out so it stays clickable. With click-through on, the window ignores
 * the mouse until the pointer is over the card. Before the first reading
 * the figure is "--", never 0%: nothing has been measured yet.
 *
 * `usage-overlay`, `overlay-header` and `overlay-percent` are hooks for
 * e2e/overlay.spec.ts, not styles.
 */
export function UsageOverlay({ onExpand }: UsageOverlayProps) {
  const { currentUsage, settings } = useUsageStore()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [time, setTime] = useState(formatTime(new Date()))
  const { showPercentage, showProgressBar, clickThrough } = settings.overlayMode

  useEffect(() => {
    const timer = setInterval(() => setTime(formatTime(new Date())), 1000)
    return () => clearInterval(timer)
  }, [])

  // The window is transparent; only the card should paint.
  useEffect(() => {
    const layers = [document.documentElement, document.body]
    layers.forEach((el) => el.classList.add('bg-transparent'))
    return () => layers.forEach((el) => el.classList.remove('bg-transparent'))
  }, [])

  // Click-through: interactive while hovered, click-through again on leave.
  useEffect(() => {
    const card = overlayRef.current
    if (!clickThrough || !card) return
    const enter = () => window.api?.setClickThrough(false)
    const leave = () => window.api?.setClickThrough(true)
    card.addEventListener('mouseenter', enter)
    card.addEventListener('mouseleave', leave)
    return () => {
      card.removeEventListener('mouseenter', enter)
      card.removeEventListener('mouseleave', leave)
    }
  }, [clickThrough])

  const percent = currentUsage ? currentUsage.sessionPercent : null
  const level = usageLevel(percent ?? 0)
  const reset = currentUsage?.sessionResetTime ? formatTimeRemaining(currentUsage.sessionResetTime) : '--'
  const Icon = level === 'critical' ? OctagonAlert : TriangleAlert

  return (
    <div
      ref={overlayRef}
      className="usage-overlay flex h-[200px] w-[200px] cursor-move flex-col gap-2 overflow-hidden rounded-2xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10 select-none [-webkit-app-region:drag]"
    >
      <div className="overlay-header flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{time}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onExpand}
          aria-label="Expand to full view"
          title="Expand to full view"
          className="cursor-pointer [-webkit-app-region:no-drag]"
        >
          <Maximize2 />
        </Button>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1">
        {showPercentage && (
          <div
            className={cn(
              'overlay-percent flex items-center gap-1.5 text-4xl leading-none font-semibold tracking-tight tabular-nums',
              percent !== null && level !== 'ok' && LEVEL_TEXT[level],
            )}
          >
            {percent !== null && level !== 'ok' && <Icon className="size-6" aria-hidden />}
            {percent === null ? '--' : `${percent}%`}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Session resets in <span className="font-mono text-foreground">{reset}</span>
        </p>
      </div>

      {showProgressBar && percent !== null && (
        <Progress
          value={Math.min(Math.max(percent, 0), 100)}
          aria-label="Session usage"
          getAriaValueText={() => `${percent}% used, ${LEVEL_LABEL[level]}`}
          className={cn('[&_[data-slot=progress-track]]:h-1.5', LEVEL_FILL[level])}
        />
      )}
      {percent !== null && level !== 'ok' && <LevelBadge level={level} className="self-start" />}
    </div>
  )
}
