import { test, expect, _electron as electron } from '@playwright/test'
import type { CDPSession, ElectronApplication, Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Visual QA on the running app: layout at every window size, WCAG AA
 * contrast in every theme and mode, a visible focus ring on every Tab stop,
 * and a quiet console. The checks are e2e/qa/qa-check.js (__qa, __contrast,
 * __focus), the method the SportsLink hub uses.
 *
 * Real window sizes go up to the display's work area; wider sizes are
 * emulated in the viewport and labelled "(emulated)" in the report.
 * The seeded account is a scaffolded provider, so its card shows the error
 * state without any network call; a locally signed-in CLI adds a live card.
 * Results: one JSON file per section in e2e/artifacts/qa, screenshots beside them.
 */

const QA_SCRIPT = 'e2e/qa/qa-check.js'
const OUT = 'e2e/artifacts/qa'
const SIZES: [number, number][] = [
  [400, 300],
  [500, 700],
  [800, 800],
  [1280, 900],
  [1536, 900],
  [1920, 1080],
  [2560, 1440],
]
const SEQUENCES: [number, number][][] = [
  [
    [400, 700],
    [1536, 900],
    [400, 700],
  ],
  [
    [500, 700],
    [2560, 1440],
    [500, 700],
  ],
]
const THEMES = [
  'default',
  'olive',
  'dusk',
  'lime',
  'ocean',
  'retro',
  'neo',
  'forest',
  'sportslink',
  'blossom',
]

interface QaResult {
  verdict: string
  fails: string[]
}
interface FocusResult {
  id: string
  tag: string
  name: string
  visible: boolean
}
/** The helpers e2e/qa/qa-check.js installs on the page. */
type QaWindow = Window & {
  __qa: (label: string) => QaResult
  __contrast: (label: string) => QaResult
  __focus: () => FocusResult | null
  __snapshotRest: () => number
}

let app: ElectronApplication
let page: Page
let cdp: CDPSession
let emulated = false
let workWidth = 0
const consoleNoise: string[] = []

/** Writes one section of the report as soon as its test ends. A failed test
 *  restarts the worker, so a report kept in memory until the end is lost. */
function save(section: string, rows: unknown[]): void {
  writeFileSync(join(OUT, `${section}.json`), JSON.stringify(rows, null, 2))
}

async function ready(): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof (window as unknown as QaWindow).__qa === 'function')
  // A hidden or mid-transition window reports stale colours (hub trap T4).
  await page.addStyleTag({
    content: '*,*::before,*::after{transition:none!important;animation:none!important}',
  })
  await page.waitForTimeout(400)
}

async function setTheme(theme: string, dark: boolean): Promise<void> {
  await page.evaluate(
    ([t, d]) => {
      localStorage.setItem('usage-tracker-theme', t as string)
      localStorage.setItem('usage-tracker-dark', String(d))
    },
    [theme, dark] as const,
  )
  await page.reload()
  await ready()
}

/** Resizes the real window when the display allows it, else the viewport. */
async function setSize(width: number, height: number): Promise<string> {
  if (width <= workWidth) {
    if (emulated) {
      await cdp.send('Emulation.clearDeviceMetricsOverride')
      emulated = false
    }
    await app.evaluate(
      ({ BrowserWindow }, [w, h]) => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win.isMaximized()) win.unmaximize()
        win.setContentSize(w, h)
      },
      [width, height] as const,
    )
    await page.waitForTimeout(250)
    return `${width}x${height}`
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 0,
    mobile: false,
  })
  emulated = true
  await page.waitForTimeout(250)
  return `${width}x${height} (emulated)`
}

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'usage-tracker-qa-'))
  writeFileSync(
    join(userDataDir, 'usage-tracker-store.json'),
    JSON.stringify({ accounts: [{ id: 'deepseek-qa', name: 'DeepSeek', provider: 'deepseek' }] }),
  )
  app = await electron.launch({
    args: ['out/main/index.cjs', `--user-data-dir=${userDataDir}`, '--no-sandbox'],
    env: { ...process.env, NODE_ENV: 'production' },
  })
  await app.context().addInitScript({ path: QA_SCRIPT })
  page = await app.firstWindow()
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error')
      consoleNoise.push(`${m.type()}: ${m.text()}`)
  })
  cdp = await page.context().newCDPSession(page)
  workWidth = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workAreaSize.width)
  mkdirSync(OUT, { recursive: true })
  await page.reload()
  await ready()
})

test.afterEach(async ({}, info) => {
  save(`console-${info.title.split(':')[0]}`, consoleNoise)
  expect.soft(consoleNoise, 'console warnings or errors').toEqual([])
  consoleNoise.length = 0
})

test.afterAll(async () => {
  await app?.close()
})

test('layout: clean at every window size, light and dark', async () => {
  const rows: QaResult[] = []
  try {
    for (const dark of [false, true]) {
      await setTheme('default', dark)
      for (const [w, h] of SIZES) {
        const size = await setSize(w, h)
        const label = `${dark ? 'dark' : 'light'} ${size}`
        const res = await page.evaluate((l) => (window as unknown as QaWindow).__qa(l), label)
        rows.push(res)
        if (w === 400 || w === 500 || w === 1280) {
          await page.screenshot({
            path: join(OUT, `layout-${dark ? 'dark' : 'light'}-${w}.png`),
            fullPage: true,
          })
        }
        expect.soft(res.verdict, JSON.stringify(res)).toBe('clean')
      }
      for (const seq of SEQUENCES) {
        const steps: string[] = []
        for (const [w, h] of seq) steps.push(await setSize(w, h))
        const label = `${dark ? 'dark' : 'light'} resize ${steps.join(' > ')}`
        const res = await page.evaluate((l) => (window as unknown as QaWindow).__qa(l), label)
        rows.push(res)
        expect.soft(res.verdict, JSON.stringify(res)).toBe('clean')
      }
    }
  } finally {
    save('layout', rows)
  }
})

test('contrast: WCAG AA text in every theme, light and dark', async () => {
  await setSize(500, 700)
  const rows: QaResult[] = []
  try {
    for (const theme of THEMES) {
      for (const dark of [false, true]) {
        await setTheme(theme, dark)
        const label = `${theme} ${dark ? 'dark' : 'light'}`
        const res = await page.evaluate((l) => (window as unknown as QaWindow).__contrast(l), label)
        rows.push(res)
        await page.screenshot({ path: join(OUT, `theme-${theme}-${dark ? 'dark' : 'light'}.png`) })
        expect.soft(res.fails, label).toEqual([])
      }
    }
  } finally {
    save('contrast', rows)
  }
})

test('focus: every Tab stop shows a visible focus indicator', async () => {
  await setSize(500, 700)
  const rows: unknown[] = []
  try {
    for (const dark of [false, true]) {
      await setTheme('default', dark)
      await page.evaluate(() => (window as unknown as QaWindow).__snapshotRest())
      const seen = new Set<string>()
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab')
        const f = await page.evaluate(() => (window as unknown as QaWindow).__focus())
        if (!f) continue
        const key = f.id
        if (seen.has(key)) break
        seen.add(key)
        rows.push({ mode: dark ? 'dark' : 'light', ...f })
        expect.soft(f.visible, `${dark ? 'dark' : 'light'} ${JSON.stringify(f)}`).toBe(true)
      }
      expect(seen.size).toBeGreaterThan(3)
    }
  } finally {
    save('focus', rows)
  }
})

test('settings dialog: layout, contrast and focus, light and dark', async () => {
  const rows: unknown[] = []
  try {
    for (const dark of [false, true]) {
      await setTheme('default', dark)
      for (const [w, h] of [
        [400, 300],
        [500, 700],
        [1280, 900],
      ] as [number, number][]) {
        const size = await setSize(w, h)
        await page.getByRole('button', { name: 'Open settings' }).click()
        await page.getByRole('dialog').waitFor()
        // Wait for the focus trap: until focus is inside, Tab can leave.
        await page.waitForFunction(() =>
          document.querySelector('[role="dialog"]')?.contains(document.activeElement),
        )
        await page.waitForTimeout(200)
        const label = `settings ${dark ? 'dark' : 'light'} ${size}`
        const layout = await page.evaluate((l) => (window as unknown as QaWindow).__qa(l), label)
        const contrast = await page.evaluate((l) => (window as unknown as QaWindow).__contrast(l), label)
        rows.push(layout, contrast)
        if (w === 500) {
          await page.screenshot({ path: join(OUT, `settings-${dark ? 'dark' : 'light'}.png`) })
          // Focus: every Tab stop inside the dialog (focus is trapped in it).
          await page.evaluate(() => (window as unknown as QaWindow).__snapshotRest())
          const seen = new Set<string>()
          for (let i = 0; i < 40; i++) {
            await page.keyboard.press('Tab')
            const f = await page.evaluate(() => (window as unknown as QaWindow).__focus())
            if (!f) continue
            const key = f.id
            if (seen.has(key)) break
            seen.add(key)
            rows.push({ label, ...f })
            expect.soft(f.visible, `${label} ${JSON.stringify(f)}`).toBe(true)
          }
        }
        expect.soft(layout.verdict, JSON.stringify(layout)).toBe('clean')
        expect.soft(contrast.fails, label).toEqual([])
        await page.keyboard.press('Escape')
        await page.getByRole('dialog').waitFor({ state: 'detached' })
      }
    }
  } finally {
    save('settings', rows)
  }
})
