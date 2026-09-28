// shadcn's `cn` package, the same one the generated components in
// components/ui import. components.json points its `utils` alias here.
export { cn } from 'cn'

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

/**
 * Format abbreviated time (HH:MM) for overlay header
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatTimeRemaining(resetTime: string): string {
  const now = new Date()
  const reset = new Date(resetTime)
  const diff = reset.getTime() - now.getTime()

  if (diff <= 0) return 'Reseting soon...'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Get CSS variable color based on usage percentage
 * Uses design system semantic colors
 */
export function getUsageColor(percent: number): string {
  if (percent >= 95) return 'var(--color-semantic-error)'
  if (percent >= 91) return 'var(--color-semantic-warning)'
  if (percent >= 71) return 'var(--color-semantic-warning)'
  return 'var(--color-semantic-success)'
}

/**
 * Get gradient class based on usage percentage
 */
export function getGradientClass(percent: number): string {
  if (percent >= 95) return 'linear-gradient(90deg, #DC2626, #EF4444)'
  if (percent >= 91) return 'linear-gradient(90deg, #D97706, #F59E0B)'
  if (percent >= 71) return 'linear-gradient(90deg, #D2D714, #EAB308)'
  return 'linear-gradient(90deg, #059669, #10B981)'
}

/**
 * Get usage status category
 */
export function getUsageStatus(percent: number): 'healthy' | 'elevated' | 'warning' | 'critical' {
  if (percent >= 95) return 'critical'
  if (percent >= 91) return 'warning'
  if (percent >= 71) return 'elevated'
  return 'healthy'
}

/**
 * Get icon for usage status
 */
export function getStatusIcon(percent: number): string {
  if (percent >= 91) {
    // Warning/alert icon
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`
  }
  if (percent >= 71) {
    // Trending up icon
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>`
  }
  // Checkmark/activity icon
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>`
}
