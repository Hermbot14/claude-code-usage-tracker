import { format } from 'date-fns'
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { spanLabel, within, type HistoryPoint } from '@/lib/usage-history'

/** The session window the trend covers. */
const SPAN_MS = 5 * 60 * 60 * 1000

const config = {
  s: { label: 'Session', color: 'var(--data)' },
} satisfies ChartConfig

/**
 * Session usage over the last five hours, one point per real reading.
 *
 * - Time runs along the x axis, so a gap in readings looks like a gap.
 * - The y axis is zoomed to the data (at least 0 to 10%), so a move from
 *   6% to 9% is visible instead of a pixel on a 0 to 100% scale.
 * - Until there are two readings it says so rather than drawing a flat line
 *   that looks like a measurement.
 * - The change is written out with an arrow and a sign; hovering shows each
 *   reading. The chart itself is not a Tab stop, the sentence is read out.
 */
export function SessionTrend({ points }: { points: readonly HistoryPoint[] }) {
  const recent = within(points, Date.now(), SPAN_MS)
  if (recent.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Session trend: collecting readings (about one a minute).
      </p>
    )
  }

  const first = recent[0]
  const last = recent[recent.length - 1]
  const delta = last.s - first.s
  const span = spanLabel(last.t - first.t)
  const top = Math.min(100, Math.max(10, Math.ceil((Math.max(...recent.map((p) => p.s)) + 5) / 10) * 10))
  const Arrow = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : ArrowRight
  const change = delta === 0 ? 'no change' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} pts`

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Session trend, last {span}</span>
        <span className="flex shrink-0 items-center gap-1 font-mono tabular-nums">
          <Arrow className="size-3" aria-hidden />
          {change}
        </span>
      </div>
      <div className="w-full min-w-0 overflow-hidden" aria-hidden>
        <ChartContainer
          config={config}
          className="aspect-auto h-12 w-full"
          initialDimension={{ width: 300, height: 48 }}
        >
          <LineChart data={[...recent]} accessibilityLayer={false} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" hide />
            <YAxis hide domain={[0, top]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const t = (payload?.[0]?.payload as HistoryPoint | undefined)?.t
                    return t ? format(new Date(t), 'HH:mm') : ''
                  }}
                  formatter={(value) => (
                    <span className="font-mono tabular-nums">Session {String(value)}%</span>
                  )}
                />
              }
            />
            <Line
              dataKey="s"
              type="linear"
              stroke="var(--color-s)"
              strokeWidth={1.75}
              dot={recent.length <= 12}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
      <p className="sr-only">
        Session usage went from {first.s}% to {last.s}% over the last {span}.
      </p>
    </div>
  )
}
