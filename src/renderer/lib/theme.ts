import { useSyncExternalStore } from 'react'

/**
 * Theme state: which colour theme, and light or dark.
 *
 * One store, so the header's light/dark button and the theme menu can never
 * disagree (they used to hold separate copies). The preloader in index.html
 * applies the saved choice before first paint; this module keeps it in sync
 * afterwards and follows the OS until the user picks a mode themselves.
 *
 * Colours live in styles/themes.css. `background` repeats each theme's
 * --background so the native window fill matches during a resize; the
 * preloader in index.html holds the same table.
 */
export type ThemeId =
  | 'default'
  | 'olive'
  | 'dusk'
  | 'lime'
  | 'ocean'
  | 'retro'
  | 'neo'
  | 'forest'
  | 'sportslink'
  | 'blossom'

export interface ThemeInfo {
  id: ThemeId
  name: string
  /** The theme's data colour, shown as its swatch in the menu. */
  swatch: string
  /** [light, dark] page background. */
  background: readonly [string, string]
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'default', name: 'Geist', swatch: '#0062e6', background: ['#fafafa', '#000000'] },
  { id: 'olive', name: 'Olive', swatch: '#7d7e45', background: ['#f2f2ed', '#0b0b0f'] },
  { id: 'dusk', name: 'Dusk', swatch: '#86874f', background: ['#f5f5f0', '#131419'] },
  { id: 'lime', name: 'Lime', swatch: '#7c3aed', background: ['#e8f5a3', '#0f0f1a'] },
  { id: 'ocean', name: 'Ocean', swatch: '#0284c7', background: ['#e0f2fe', '#082f49'] },
  { id: 'retro', name: 'Retro', swatch: '#d97706', background: ['#fef3c7', '#1c1917'] },
  { id: 'neo', name: 'Neo', swatch: '#c026d3', background: ['#fdf4ff', '#0f0720'] },
  { id: 'forest', name: 'Forest', swatch: '#16a34a', background: ['#dcfce7', '#052e16'] },
  { id: 'sportslink', name: 'SportsLink', swatch: '#1575bd', background: ['#f4f7fb', '#071626'] },
  { id: 'blossom', name: 'Blossom', swatch: '#ec4899', background: ['#fff7fb', '#14101c'] },
]

const THEME_KEY = 'usage-tracker-theme'
const DARK_KEY = 'usage-tracker-dark'

interface ThemeState {
  theme: ThemeId
  dark: boolean
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable; the choice then lasts for this session only.
  }
}

/** 'vercel' was folded into the default when the default became Geist. */
function savedTheme(): ThemeId {
  const id = read(THEME_KEY)
  if (id === 'vercel') return 'default'
  return THEMES.some((t) => t.id === id) ? (id as ThemeId) : 'default'
}

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

let state: ThemeState = {
  theme: savedTheme(),
  dark: read(DARK_KEY) === null ? systemDark() : read(DARK_KEY) === 'true',
}
const listeners = new Set<() => void>()

function apply(next: ThemeState): void {
  state = next
  const root = document.documentElement
  if (next.theme === 'default') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', next.theme)
  root.classList.toggle('dark', next.dark)
  const info = THEMES.find((t) => t.id === next.theme) ?? THEMES[0]
  window.api?.setWindowBackground(info.background[next.dark ? 1 : 0])
  listeners.forEach((fn) => fn())
}

export function setTheme(theme: ThemeId): void {
  write(THEME_KEY, theme)
  apply({ ...state, theme })
}

export function setDark(dark: boolean): void {
  write(DARK_KEY, String(dark))
  apply({ ...state, dark })
}

/** Applies the saved choice and follows the OS until the user picks a mode. */
export function startTheme(): () => void {
  // The preloader paints <html> inline for the first frame; from here the
  // theme's own --background owns it, so a later theme change shows.
  document.documentElement.style.backgroundColor = ''
  apply(state)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = (e: MediaQueryListEvent) => {
    if (read(DARK_KEY) === null) apply({ ...state, dark: e.matches })
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useTheme(): ThemeState {
  return useSyncExternalStore(subscribe, () => state)
}
