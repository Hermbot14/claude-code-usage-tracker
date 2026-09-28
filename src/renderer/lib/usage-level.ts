/**
 * How close an account is to its limit, in words and in theme tokens.
 *
 * The thresholds are the tracker's own (they drive notifications too): under
 * 71% is fine, 71% up is elevated, 91% up is high, 95% up is critical.
 * Colour never carries the level alone (WCAG 1.4.1): every place that
 * colours a level also shows its word or an icon.
 */
export type UsageLevel = 'ok' | 'elevated' | 'high' | 'critical'

export function usageLevel(percent: number): UsageLevel {
  if (percent >= 95) return 'critical'
  if (percent >= 91) return 'high'
  if (percent >= 71) return 'elevated'
  return 'ok'
}

export const LEVEL_LABEL: Record<UsageLevel, string> = {
  ok: 'OK',
  elevated: 'Elevated',
  high: 'High',
  critical: 'Critical',
}

/** Text colour for a level; each is AA on the card and on its own tint. */
export const LEVEL_TEXT: Record<UsageLevel, string> = {
  ok: 'text-ok',
  elevated: 'text-warn',
  high: 'text-warn',
  critical: 'text-destructive',
}

/** Bar fill: the theme's data colour until the level needs attention. */
export const LEVEL_FILL: Record<UsageLevel, string> = {
  ok: '[&_[data-slot=progress-indicator]]:bg-data',
  elevated: '[&_[data-slot=progress-indicator]]:bg-warn',
  high: '[&_[data-slot=progress-indicator]]:bg-warn',
  critical: '[&_[data-slot=progress-indicator]]:bg-destructive',
}

/** Badge tint: the level's hue at 10% under its own text. */
export const LEVEL_BADGE: Record<UsageLevel, string> = {
  ok: 'bg-ok/10 text-ok',
  elevated: 'bg-warn/10 text-warn',
  high: 'bg-warn/10 text-warn',
  critical: 'bg-destructive/10 text-destructive',
}
