import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * First-run onboarding: with no accounts, the app must render the click-through
 * setup guide (CLI probe, Sign in button, rescan) instead of a dead empty state.
 * Local-account detection is forced off via opt-out tombstones so the test is
 * deterministic regardless of what CLIs are logged in on the host machine.
 */

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'usage-tracker-e2e-onboard-'))
  writeFileSync(
    join(userDataDir, 'usage-tracker-store.json'),
    JSON.stringify({ dismissedLocalAccounts: ['anthropic', 'openai', 'qwen'] }),
  )
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

test('onboarding: empty state renders the click-through setup guide', async () => {
  await expect(page.getByRole('heading', { name: 'Connect your Claude Code account' })).toBeVisible()

  // Step 1 resolves the CLI probe to either "installed ✓" or an Install button.
  await expect(
    page.getByText(/Claude Code is installed|Install Claude Code/),
  ).toBeVisible({ timeout: 45_000 })

  // Step 2 always offers the one-click login.
  await expect(page.getByRole('button', { name: /^(Sign in|Opening…)$/ })).toBeVisible()

  // Escape hatches: manual rescan + API-key path.
  await expect(page.getByRole('button', { name: /Scan for accounts|Scanning…/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add API-key account instead' })).toBeVisible()

  await page.screenshot({ path: 'e2e/artifacts/05-onboarding.png' })
})

test('onboarding: scan reports when no CLI login is found', async () => {
  // Tombstones are cleared by an explicit scan; on a machine with a real CLI
  // login this adds the account, otherwise a guidance message appears. Both
  // outcomes are valid — assert the state converges to one of them.
  await page.getByRole('button', { name: /Scan for accounts|Scanning…/ }).click()
  await expect(
    page
      .getByText(/No CLI login found yet/)
      .or(page.getByText('1 account tracked')),
  ).toBeVisible({ timeout: 30_000 })
})
