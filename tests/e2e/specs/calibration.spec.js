import { test, expect, waitForMeasurement } from '../fixtures.js'

async function startMeasurement(page) {
  await page.locator('#btn-start').click()
  await waitForMeasurement(page)
}

test('計測開始前に CAL ボタンを押してもパネルが開かない', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()  // EXPERT モード（CALボタンを表示）
  await page.locator('#btn-calibrate').click()
  // パネルは hidden のまま
  await expect(page.locator('#calibration-panel')).toHaveClass(/hidden/)
})

test('計測中に CAL ボタンでパネルが開く', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()  // EXPERT モード
  await startMeasurement(page)

  await page.locator('#btn-calibrate').click()
  await expect(page.locator('#calibration-panel')).not.toHaveClass(/hidden/)
})

test('CAL パネルに現在の dBFS 値が表示される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await startMeasurement(page)

  await page.locator('#btn-calibrate').click()

  const calCurrent = await page.locator('#cal-current').textContent()
  expect(calCurrent).not.toBe('---.-')
})

test('無効値（-10）入力でエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await startMeasurement(page)

  await page.locator('#btn-calibrate').click()
  await page.locator('#cal-input').fill('-10')
  await page.locator('#cal-save').click()

  await expect(page.locator('#cal-error')).not.toHaveClass(/hidden/)
  // パネルはまだ開いている
  await expect(page.locator('#calibration-panel')).not.toHaveClass(/hidden/)
})

test('有効値（75）入力で保存・パネルが閉じる', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await startMeasurement(page)

  await page.locator('#btn-calibrate').click()
  await page.locator('#cal-input').fill('75')
  await page.locator('#cal-save').click()

  await expect(page.locator('#calibration-panel')).toHaveClass(/hidden/)
})

test('保存後に localStorage にオフセットが記録される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await startMeasurement(page)

  await page.locator('#btn-calibrate').click()
  await page.locator('#cal-input').fill('94')
  await page.locator('#cal-save').click()

  const offset = await page.evaluate(() => localStorage.getItem('loudness-meter-cal-offset'))
  expect(offset).not.toBeNull()
  expect(parseFloat(offset)).not.toBeNaN()
})

test('dBSPL ON でラベルが dBSPL に変わる', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await startMeasurement(page)

  // キャリブレーション実施
  await page.locator('#btn-calibrate').click()
  await page.locator('#cal-input').fill('94')
  await page.locator('#cal-save').click()

  await page.locator('#btn-spl-toggle').click()
  await expect(page.locator('#lbl-dbfs')).toHaveText('dBSPL')
})

test('dBSPL OFF でラベルが dBFS に戻る', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await startMeasurement(page)

  await page.locator('#btn-spl-toggle').click()  // ON
  await page.locator('#btn-spl-toggle').click()  // OFF
  await expect(page.locator('#lbl-dbfs')).toHaveText('dBFS')
})

test('キャンセルボタンでパネルが閉じる', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await startMeasurement(page)

  await page.locator('#btn-calibrate').click()
  await expect(page.locator('#calibration-panel')).not.toHaveClass(/hidden/)

  await page.locator('#cal-cancel').click()
  await expect(page.locator('#calibration-panel')).toHaveClass(/hidden/)
})
