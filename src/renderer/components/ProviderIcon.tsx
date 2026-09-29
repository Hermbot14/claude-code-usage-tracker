import type { CSSProperties } from 'react'
import type { ProviderId } from '@/types'
import { cn } from '@/lib/utils'

/**
 * Provider mark: a flat brand-coloured monogram. These are stylised marks,
 * not official logos, to stay clear of trademark issues. Decorative (the
 * provider's name is always written next to it), but every colour still
 * holds its white glyph at 4.5:1 or better.
 */
const MARKS: Record<string, { color: string; glyph: string }> = {
  anthropic: { color: '#a94f2f', glyph: 'C' },
  zai: { color: '#1e63d6', glyph: 'Z' },
  zhipu: { color: '#7c3aed', glyph: '智' },
  openai: { color: '#0b7a60', glyph: 'O' },
  deepseek: { color: '#3a52e0', glyph: 'D' },
  kimi: { color: '#5b6577', glyph: 'K' },
  qwen: { color: '#9333ea', glyph: 'Q' },
  minimax: { color: '#e11d48', glyph: 'M' },
  opencode: { color: '#b45309', glyph: '◇' },
  unknown: { color: '#6b7280', glyph: '?' },
}

export function ProviderIcon({
  provider,
  size = 'md',
}: {
  provider: ProviderId
  size?: 'sm' | 'md'
}) {
  const mark = MARKS[provider] ?? MARKS.unknown
  return (
    <span
      aria-hidden
      style={{ '--mark': mark.color } as CSSProperties}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-(--mark) font-semibold text-white select-none',
        size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm',
      )}
    >
      {mark.glyph}
    </span>
  )
}
