// Checks WCAG 2.2 AA contrast for every theme and mode in
// src/renderer/styles/themes.css, before anything is rendered.
//
//   node scripts/check-theme-contrast.mjs
//
// Text pairs need 4.5:1 (1.4.3). Non-text pairs need 3:1 (1.4.11): the data
// colour against the card and the progress track, the focus ring, and the
// field and switch border (--input). Status colours are also checked on their
// own 10% badge tint over the card, which is what a Badge actually sits on.
//
// This is the first check only. The rendered page is the real test (tinted
// layers, opacity), so e2e/visual-qa.spec.ts runs __contrast() on the app.
// Exits 1 when any pair fails.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cssPath = fileURLToPath(new URL('../src/renderer/styles/themes.css', import.meta.url))
const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const blocks = {}
for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const vars = {}
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim()
  blocks[selector.trim()] = vars
}

const themeIds = [
  'default',
  ...new Set(
    Object.keys(blocks)
      .map((s) => s.match(/data-theme='([\w-]+)'/)?.[1])
      .filter(Boolean),
  ),
]

function resolve(theme, dark) {
  const layers = [blocks[':root']]
  if (dark) layers.push(blocks['.dark'])
  if (theme !== 'default') layers.push(blocks[`[data-theme='${theme}']`] ?? {})
  if (theme !== 'default' && dark) layers.push(blocks[`[data-theme='${theme}'].dark`] ?? {})
  const vars = Object.assign({}, ...layers)
  const get = (name, depth = 0) => {
    const v = vars[name]
    const ref = v?.match(/^var\(--([\w-]+)\)$/)
    return ref && depth < 5 ? get(ref[1], depth + 1) : v
  }
  return get
}

const rgb = (hex) => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lum = (c) =>
  c
    .map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (a, b) => {
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const mix = (fg, bg, alpha) => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)))

const TEXT = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['ok', 'card'],
  ['ok', 'background'],
  ['warn', 'card'],
  ['warn', 'background'],
  ['destructive', 'card'],
  ['destructive', 'background'],
]
const NON_TEXT = [
  ['data', 'card'],
  ['data', 'muted'],
  ['ring', 'card'],
  ['ring', 'background'],
  ['input', 'card'],
  ['input', 'background'],
]
const TINTED = ['ok', 'warn', 'destructive', 'data']

let failures = 0
for (const theme of themeIds) {
  for (const dark of [false, true]) {
    const get = resolve(theme, dark)
    const label = `${theme}${dark ? ' dark' : ''}`
    const bad = []
    const check = (fgName, bgName, min, fgRgb, bgRgb) => {
      const r = ratio(fgRgb ?? rgb(get(fgName)), bgRgb ?? rgb(get(bgName)))
      if (r < min) bad.push(`${fgName} on ${bgName} ${r.toFixed(2)} < ${min}`)
    }
    for (const [fg, bg] of TEXT) check(fg, bg, 4.5)
    for (const [fg, bg] of NON_TEXT) check(fg, bg, 3)
    // A badge: the hue as text on a 10% tint of itself, over the card and
    // over the page (badges sit on both).
    for (const hue of TINTED.slice(0, 3)) {
      for (const ground of ['card', 'background']) {
        const tint = mix(rgb(get(hue)), rgb(get(ground)), 0.1)
        check(hue, `${hue} tint on ${ground}`, 4.5, undefined, tint)
      }
    }
    // shadcn's destructive Alert draws its description at 90% opacity.
    const faded = mix(rgb(get('destructive')), rgb(get('card')), 0.9)
    check('destructive 90%', 'card', 4.5, faded)
    failures += bad.length
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${label.padEnd(18)} ${bad.join('; ')}`)
  }
}
console.log(failures ? `\n${failures} pair(s) below AA` : '\nEvery theme passes')
process.exit(failures ? 1 : 0)
