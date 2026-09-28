import { test, expect } from '@playwright/test'
import { addReading, pruneHistory, spanLabel, within, HISTORY_KEEP_MS } from '../src/renderer/lib/usage-history'

/**
 * The trend's history rules, without launching the app. The bug these guard:
 * every poll (every few seconds) appended the main process's cached reading
 * again, so the buffer filled with identical copies and the trend drew a
 * flat line.
 */

const T0 = Date.UTC(2026, 8, 29, 9, 0, 0)
const MIN = 60_000

test('history: a cached copy of the last reading is not a new point', () => {
  let points = addReading([], { t: T0, s: 6, w: 50 })
  for (let i = 0; i < 20; i++) points = addReading(points, { t: T0, s: 6, w: 50 })
  expect(points).toHaveLength(1)
  const same = points
  expect(addReading(same, { t: T0, s: 6, w: 50 })).toBe(same) // unchanged: no re-render, no disk write
})

test('history: each fresh reading is kept, in order', () => {
  let points = addReading([], { t: T0, s: 6, w: 50 })
  points = addReading(points, { t: T0 + MIN, s: 7, w: 50 })
  points = addReading(points, { t: T0 + 2 * MIN, s: 9, w: 51 })
  expect(points.map((p) => p.s)).toEqual([6, 7, 9])
  // An older reading arriving late does not rewrite the past.
  expect(addReading(points, { t: T0, s: 1, w: 1 })).toBe(points)
})

test('history: keeps a day, not 48 samples', () => {
  let points = addReading([], { t: T0, s: 1, w: 1 })
  for (let i = 1; i <= 120; i++) points = addReading(points, { t: T0 + i * MIN, s: i % 100, w: 1 })
  expect(points).toHaveLength(121) // two hours at one a minute all survive
  points = addReading(points, { t: T0 + HISTORY_KEEP_MS + 5 * MIN, s: 5, w: 5 })
  expect(points[0].t).toBeGreaterThanOrEqual(T0 + 5 * MIN) // older than a day is dropped
})

test('history: what comes back from disk is cleaned', () => {
  const now = T0 + 10 * MIN
  const stored = [
    { t: T0 + 2 * MIN, s: 8, w: 1 },
    { t: T0 + MIN, s: 7, w: 1 },
    { t: now - HISTORY_KEEP_MS - MIN, s: 1, w: 1 }, // expired
    { t: 'x', s: 1, w: 1 }, // malformed
    null,
  ]
  expect(pruneHistory(stored, now).map((p) => p.s)).toEqual([7, 8])
  expect(pruneHistory('not an array', now)).toEqual([])
})

test('history: window and span labels', () => {
  const points = [0, 60, 200, 290].map((m) => ({ t: T0 + m * MIN, s: m, w: 0 }))
  // The window is inclusive at its start.
  expect(within(points, T0 + 300 * MIN, 300 * MIN).map((p) => p.s)).toEqual([0, 60, 200, 290])
  expect(within(points, T0 + 300 * MIN, 250 * MIN).map((p) => p.s)).toEqual([60, 200, 290])
  expect(spanLabel(20_000)).toBe('under a minute')
  expect(spanLabel(35 * MIN)).toBe('35m')
  expect(spanLabel(120 * MIN)).toBe('2h')
  expect(spanLabel(80 * MIN)).toBe('1h 20m')
})
