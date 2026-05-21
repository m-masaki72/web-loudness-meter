import { test, expect } from '../fixtures.js'

test('初期状態は SIMPLE モード（EXPERTボタンが表示）', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#btn-mode-toggle')).toHaveText('EXPERT')
  // simple-mode クラスが panel に付いている
  await expect(page.locator('#panel')).toHaveClass(/simple-mode/)
})

test('EXPERT ボタンクリックで EXPERT モードに切替', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()

  await expect(page.locator('#btn-mode-toggle')).toHaveText('SIMPLE')
  await expect(page.locator('#panel')).not.toHaveClass(/simple-mode/)
})

test('モード切替後 localStorage に保存される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()

  const stored = await page.evaluate(() => localStorage.getItem('ui-mode'))
  expect(stored).toBe('expert')
})

test('ページリロード後もモードが維持される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await expect(page.locator('#btn-mode-toggle')).toHaveText('SIMPLE')

  await page.reload()
  await expect(page.locator('#btn-mode-toggle')).toHaveText('SIMPLE')
  await expect(page.locator('#panel')).not.toHaveClass(/simple-mode/)
})

test('EXPERT → SIMPLE に戻せる', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await expect(page.locator('#btn-mode-toggle')).toHaveText('SIMPLE')

  await page.locator('#btn-mode-toggle').click()
  await expect(page.locator('#btn-mode-toggle')).toHaveText('EXPERT')
  await expect(page.locator('#panel')).toHaveClass(/simple-mode/)
})

test('SIMPLE モードでは btn-expert クラスの要素が非表示', async ({ page }) => {
  await page.goto('/')
  // SIMPLEモードのときRECボタン（btn-expert）は非表示
  await expect(page.locator('#btn-rec')).not.toBeVisible()
})

test('EXPERT モードでは btn-expert クラスの要素が表示', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  // EXPERTモードのときRECボタンは表示（ただし計測前はdisabled）
  await expect(page.locator('#btn-rec')).toBeVisible()
})
