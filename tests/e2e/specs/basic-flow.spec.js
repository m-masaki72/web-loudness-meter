import { test, expect, waitForMeasurement } from '../fixtures.js'

test('初期状態: STOPボタン無効、全値が ---.-', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#btn-stop')).toBeDisabled()
  await expect(page.locator('#val-dbfs')).toHaveText('---.-')
  await expect(page.locator('#val-dba')).toHaveText('---.-')
  await expect(page.locator('#val-lufs-m')).toHaveText('---.-')
})

test('START → 計測開始 → 値がリアルタイム更新される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-start').click()
  await waitForMeasurement(page)

  // 値が更新されていることを確認（"---.-" 以外の値）
  const dbfsText = await page.locator('#val-dbfs').textContent()
  expect(dbfsText).not.toBe('---.-')

  // STOPボタンが有効になる
  await expect(page.locator('#btn-stop')).toBeEnabled()
  // STARTボタンが無効になる
  await expect(page.locator('#btn-start')).toBeDisabled()
})

test('START → STOP → UI がリセットされる', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-start').click()
  await waitForMeasurement(page)

  await page.locator('#btn-stop').click()

  // 値が ---.- に戻る
  await expect(page.locator('#val-dbfs')).toHaveText('---.-')
  // STARTボタンが再有効化
  await expect(page.locator('#btn-start')).toBeEnabled()
  await expect(page.locator('#btn-stop')).toBeDisabled()
})

test('Oscilloscope canvas が描画される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-start').click()
  await waitForMeasurement(page)

  // canvas の幅が0より大きい
  const scopeWidth = await page.locator('#oscilloscope').evaluate(c => c.width)
  expect(scopeWidth).toBeGreaterThan(0)
})

test('計測中は STARTボタンを押しても二重起動しない', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-start').click()
  await waitForMeasurement(page)

  // STARTボタンは disabled なので何も起きない
  await expect(page.locator('#btn-start')).toBeDisabled()
})
