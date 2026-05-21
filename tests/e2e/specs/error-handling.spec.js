import { test, expect } from '../fixtures.js'

// このファイルは no-mic プロジェクトで実行される（マイク権限なし）

test('マイク拒否時に alert が表示される', async ({ page }) => {
  await page.goto('/')

  const alertPromise = page.waitForEvent('dialog', { timeout: 10000 })
  await page.locator('#btn-start').click()

  const dialog = await alertPromise
  expect(dialog.type()).toBe('alert')
  expect(dialog.message()).toContain('マイク')
  await dialog.dismiss()
})

test('マイク拒否後に START ボタンが再有効化される', async ({ page }) => {
  await page.goto('/')

  const alertPromise = page.waitForEvent('dialog', { timeout: 10000 })
  await page.locator('#btn-start').click()

  const dialog = await alertPromise
  await dialog.dismiss()

  // START ボタンが再有効化されること
  await expect(page.locator('#btn-start')).toBeEnabled({ timeout: 3000 })
})

test('マイク拒否後に計測が開始されない（値が ---.- のまま）', async ({ page }) => {
  await page.goto('/')

  const alertPromise = page.waitForEvent('dialog', { timeout: 10000 })
  await page.locator('#btn-start').click()

  const dialog = await alertPromise
  await dialog.dismiss()

  await page.waitForTimeout(1000)
  await expect(page.locator('#val-dbfs')).toHaveText('---.-')
})
