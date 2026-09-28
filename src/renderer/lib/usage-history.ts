/**
 * Usage history for the trend: one point per real reading.
 *
 * The renderer polls every few seconds but the main process fetches at most
 * once a minute and hands back its cached reading in between. Keying points
 * on the reading's own fetch time (`lastUpdated`) means a cached copy is not
 * a new point; before, dozens of identical copies filled the buffer and the
 * trend drew a flat line.
 */
export interface HistoryPoint {
  /** When the reading was fetched (ms since epoch). */
  t: number
  /** Session percent. */
  s: number
  /** Weekly percent. */
  w: number
}

/** Points older than this are dropped. */
export const HISTORY_KEEP_MS = 24 * 60 * 60 * 1000
/** A hard cap, far above one reading a minute for a day. */
const HISTORY_MAX = 2000

/** Adds a reading unless it is the one already last in the list. */
export function addReading(points: readonly HistoryPoint[], reading: HistoryPoint): HistoryPoint[] {
  const last = points[points.length - 1]
  if (last && last.t >= reading.t) return points as HistoryPoint[]
  const cutoff = reading.t - HISTORY_KEEP_MS
  return [...points.filter((p) => p.t >= cutoff), reading].slice(-HISTORY_MAX)
}

/** Drops expired points and anything malformed (history read back from disk). */
export function pruneHistory(points: unknown, now: number): HistoryPoint[] {
  if (!Array.isArray(points)) return []
  return points
    .filter(
      (p): p is HistoryPoint =>
        !!p &&
        typeof p.t === 'number' &&
        typeof p.s === 'number' &&
        typeof p.w === 'number' &&
        p.t >= now - HISTORY_KEEP_MS &&
        p.t <= now + 60_000,
    )
    .sort((a, b) => a.t - b.t)
}

/** Points inside the last `spanMs`. */
export function within(points: readonly HistoryPoint[], now: number, spanMs: number): HistoryPoint[] {
  return points.filter((p) => p.t >= now - spanMs)
}

/** "1h 20m", "35m", "under a minute". */
export function spanLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
