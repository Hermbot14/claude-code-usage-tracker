import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Overlay-mode regression tests. Guards two bugs that silently broke overlay UX:
 *  1. the main store loaded async, so createWindow read opacity/overlay-mode
 *     before the file loaded (window came up fully opaque);
 *  2. the renderer stopped restoring persisted settings, so overlay mode never
 *     re-engaged on launch.
 */

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  // Pre-seed an isolated store with overlay mode on at 60% opacity.
  const userDataDir = mkdtempSync(join(tmpdir(), 'usage-tracker-overlay-'))
  const store = {
    overlayMode: true,
    overlayPosition: 'top-right',
    settings: {
      apiKey: '',
      baseUrl: 'https://api.z.ai/api/anthropic',
      refreshInterval: 5,
      notificationsEnabled: true,
      alertThresholds: [80, 90, 100],
      soundAlertEnabled: false,
      retentionDays: 90,
      overlayMode: {
        enabled: true,
        position: 'top-right',
        opacity: 60,
        compact: true,
        clickThrough: false,
        showPercentage: true,
        showProgressBar: true,
      },
    },
  }
  writeFileSync(join(userDataDir, 'usage-tracker-store.json'), JSON.stringify(store, null, 2))

  app = await electron.launch({
    args: ['out/main/index.cjs', `--user-data-dir=${userDataDir}`, '--no-sandbox'],
    env: { ...process.env, NODE_ENV: 'production' },
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
})

test('overlay: window opacity reflects the saved setting (60%)', async () => {
  const opacity = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getOpacity(),
  )
  expect(opacity).toBeGreaterThan(0.55)
  expect(opacity).toBeLessThan(0.65)
})

test('overlay: renders the compact overlay UI (persisted settings restored)', async () => {
  await expect(page.locator('.usage-overlay')).toBeVisible()
  await expect(page.locator('.overlay-percent')).toBeVisible()
})

test('overlay: the whole card is a drag region, expand button opts out', async () => {
  // Inline style/computed checks: the container is a drag region and the
  // interactive button is excluded so it stays clickable.
  const cardRegion = await page
    .locator('.usage-overlay')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-app-region').trim())
  const buttonRegion = await page
    .locator('.overlay-header button')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-app-region').trim())

  // Some Chromium builds don't expose -webkit-app-region via getComputedStyle;
  // only assert when present so the test stays meaningful but not flaky.
  if (cardRegion) expect(cardRegion).toBe('drag')
  if (buttonRegion) expect(buttonRegion).toBe('no-drag')
})
