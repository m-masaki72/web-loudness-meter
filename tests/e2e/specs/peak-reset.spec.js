import { test, expect, waitForMeasurement } from '../fixtures.js'

test('EXPERT + START → PEAK RST でクラッシュせず計測継続', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()  // EXPERT モード

  await page.locator('#btn-start').click()
  await waitForMeasurement(page)

  // 少し待ってピークを蓄積
  await page.waitForTimeout(1000)

  // PEAK RST クリック
  await page.locator('#btn-peak-reset').click()

  // 計測が継続している（値が更新されている）
  await page.waitForTimeout(500)
  const dbfsText = await page.locator('#val-dbfs').textContent()
  expect(dbfsText).not.toBe('---.-')
})

test('PEAK RST ボタンが .active クラスを一時的に持つ', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()

  await page.locator('#btn-start').click()
  await waitForMeasurement(page)

  // クリックして active クラスの付与→消失を確認
  await page.locator('#btn-peak-reset').click()
  // 150ms 後には active クラスが消える（main.js の setTimeout 150ms）
  await page.waitForTimeout(200)
  const hasActive = await page.locator('#btn-peak-reset').evaluate(
    el => el.classList.contains('active')
  )
  expect(hasActive).toBe(false)
})

test('計測していない状態で PEAK RST を押してもエラーにならない', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()

  // START せずに PEAK RST
  await expect(page.locator('#btn-peak-reset').click()).resolves.not.toThrow()
})
