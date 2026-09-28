export function usd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function compactTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

/** "claude-haiku-4-5-20251001" -> "Haiku 4.5"; the raw id when unrecognised. */
export function prettyModel(model: string): string {
  const m = model.toLowerCase()
  const family = ['fable', 'mythos', 'opus', 'sonnet', 'haiku'].find((f) => m.includes(f))
  if (!family) return model
  const version = (m.split(family)[1] ?? '')
    .replace(/^[-_]/, '')
    .replace(/-?\d{8}$/, '') // drop the release-date suffix
    .replace(/-/g, '.')
  const label = family[0].toUpperCase() + family.slice(1)
  return version ? `${label} ${version}` : label
}
