import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { LEVEL_BADGE, LEVEL_LABEL, type UsageLevel } from '@/lib/usage-level'
import { cn } from '@/lib/utils'

const ICON = {
  ok: CircleCheck,
  elevated: TriangleAlert,
  high: TriangleAlert,
  critical: OctagonAlert,
} as const

/** A level as Geist's subtle badge: icon shape, word and tint together. */
export function LevelBadge({ level, className }: { level: UsageLevel; className?: string }) {
  const Icon = ICON[level]
  return (
    <Badge className={cn(LEVEL_BADGE[level], className)}>
      <Icon data-icon="inline-start" aria-hidden />
      {LEVEL_LABEL[level]}
    </Badge>
  )
}
