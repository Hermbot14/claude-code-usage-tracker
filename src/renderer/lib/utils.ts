// shadcn's `cn` package, the same one the generated components in
// components/ui import. components.json points its `utils` alias here.
export { cn } from 'cn'

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

  if (diff <= 0) return 'Resetting soon'

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
