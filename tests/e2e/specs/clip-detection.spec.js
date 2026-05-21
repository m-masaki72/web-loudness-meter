import { test, expect, waitForMeasurement } from '../fixtures.js'

// Chromium の --use-file-for-fake-audio-capture で使用する sine_1k.wav は
// amplitude=0.7（約-3.1dBFS）なので warn クラス（> -12 and <= -3）が付くはず

test('計測中に warn または clip クラスが val-dbfs に付与される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-start').click()

  // warn または clip クラスが付与されるまで待つ
  await page.waitForFunction(
    () => {
      const el = document.getElementById('val-dbfs')
      return el?.classList.contains('clip') || el?.classList.contains('warn')
    },
    { timeout: 10000 }
  )

  const el = page.locator('#val-dbfs')
  const hasWarn = await el.evaluate(e => e.classList.contains('warn'))
  const hasClip = await el.evaluate(e => e.classList.contains('clip'))
  expect(hasWarn || hasClip).toBe(true)
})

test('STOP 後に warn/clip クラスが消える', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-start').click()
  await waitForMeasurement(page)

  await page.locator('#btn-stop').click()

  // 停止後はクラスがリセットされる
  const el = page.locator('#val-dbfs')
  await expect(el).not.toHaveClass(/warn/)
  await expect(el).not.toHaveClass(/clip/)
})

test('EXPERT モードで dBA も更新される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()
  await page.locator('#btn-start').click()
  await page.waitForFunction(
    () => document.getElementById('val-dba')?.textContent !== '---.-',
    { timeout: 12000 }
  )

  const dbaText = await page.locator('#val-dba').textContent()
  expect(dbaText).not.toBe('---.-')
})
