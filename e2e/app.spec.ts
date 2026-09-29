import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  // Isolate userData so the test's single-instance lock + store never collide
  // with a real running instance, and start from a clean account list.
  const userDataDir = mkdtempSync(join(tmpdir(), 'usage-tracker-e2e-'))
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

test('smoke: main window renders the app shell', async () => {
  await expect(page.locator('h1')).toHaveText('Usage Tracker')
  await expect(page.getByText('Coding-Plan Usage Monitor')).toBeVisible()
  await page.screenshot({ path: 'e2e/artifacts/01-main.png' })
})

test('e2e: settings → provider manager, oauth-local detection, add account, render card', async () => {
  // --- open settings -------------------------------------------------------
  await page.getByRole('button', { name: 'Open settings' }).click()
  // The dialog's title is its only heading named exactly "Settings".
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  // Accounts is a fieldset in the Settings dialog, so it is a named group.
  await expect(page.getByRole('group', { name: 'Accounts', exact: true })).toBeVisible()

  // --- provider catalog (shadcn Select on Base UI) --------------------------
  const select = page.getByRole('combobox', { name: 'Provider' })
  await expect(select).toBeVisible()
  await select.click()
  const options = await page.getByRole('option').allTextContents()
  const joined = options.join(' | ')
  expect(joined).toContain('Claude Code')
  expect(joined).toContain('Z.AI GLM Coding Plan')
  expect(joined).toContain('OpenAI Codex')
  // Scaffolded providers are flagged, not silently broken
  expect(options.some((o) => o.includes('(coming soon)'))).toBeTruthy()
  await page.screenshot({ path: 'e2e/artifacts/02-settings.png' })

  // --- oauth-local provider hides the API-key field ------------------------
  await page.getByRole('option', { name: 'Claude Code', exact: true }).click()
  await expect(page.locator('#acct-key')).toHaveCount(0)
  await expect(page.getByText(/local Claude Code login/i)).toBeVisible()

  // --- api-key provider reveals key + base URL, add gated on key -----------
  await select.click()
  await page.getByRole('option', { name: 'Z.AI GLM Coding Plan', exact: true }).click()
  await expect(page.locator('#acct-key')).toBeVisible()
  await expect(page.locator('#acct-url')).toBeVisible()
  const addBtn = page.getByRole('button', { name: 'Add account', exact: true })
  await expect(addBtn).toBeDisabled()
  await page.locator('#acct-key').fill('test-zai-key-123')
  await expect(addBtn).toBeEnabled()
  await addBtn.click()

  // On success the add-form resets (provider cleared → key field unmounts),
  // and a Z.AI row appears in the in-settings manager list.
  await expect(page.locator('#acct-key')).toHaveCount(0)
  await expect(select).toHaveText(/Select a provider/)
  await page.screenshot({ path: 'e2e/artifacts/03-account-added.png' })

  // --- close settings → account renders as a card in the main view ---------
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(0)
  // With settings closed, only the main-view card carries this exact text.
  await expect(page.getByText('Z.AI GLM Coding Plan', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'e2e/artifacts/04-account-card.png' })
})
