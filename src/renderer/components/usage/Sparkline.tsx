import { Line, LineChart, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

const config = {
  value: { label: 'Session', color: 'var(--data)' },
} satisfies ChartConfig

/**
 * Session trend as shadcn's Chart at a fixed small size. Decorative (the
 * figures sit beside it), so it is not a Tab stop, does not animate on every
 * poll, and joins samples with straight lines: a curve would draw values
 * nobody measured. A single sample shows as a flat line.
 */
export function Sparkline({ points }: { points: number[] }) {
  const series = points.length >= 2 ? points : [points[0] ?? 0, points[0] ?? 0]
  const data = series.map((value, i) => ({ i, value }))
  return (
    <ChartContainer
      config={config}
      aria-hidden
      className="aspect-auto h-7 w-[120px]"
      initialDimension={{ width: 120, height: 28 }}
    >
      <LineChart data={data} accessibilityLayer={false} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={[0, 100]} />
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-value)"
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
