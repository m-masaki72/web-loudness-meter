import { test, expect, waitForMeasurement } from '../fixtures.js'

async function goExpert(page) {
  await page.goto('/')
  await page.locator('#btn-mode-toggle').click()  // EXPERT モード
}

function countIndexedDB(page) {
  return page.evaluate(() => new Promise(resolve => {
    const req = indexedDB.open('loudness-history')
    req.onsuccess = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('samples')) { resolve(0); return }
      const tx = db.transaction('samples', 'readonly')
      const countReq = tx.objectStore('samples').count()
      countReq.onsuccess = () => resolve(countReq.result)
      countReq.onerror  = () => resolve(0)
    }
    req.onerror = () => resolve(0)
  }))
}

async function startAndWait(page, minSamples = 2) {
  await page.locator('#btn-start').click()
  await waitForMeasurement(page)
  // sampleInterval は1秒ごとに保存する。余裕を持って (minSamples + 1) 秒待つ
  await page.waitForTimeout((minSamples + 1) * 1000)
}

test('HIST ボタンで履歴パネルが開く', async ({ page }) => {
  await goExpert(page)
  await expect(page.locator('#history-panel')).toHaveClass(/hidden/)

  await page.locator('#btn-history-toggle').click()
  await expect(page.locator('#history-panel')).not.toHaveClass(/hidden/)
})

test('HIST ボタン再押下でパネルが閉じる', async ({ page }) => {
  await goExpert(page)
  await page.locator('#btn-history-toggle').click()
  await page.locator('#btn-history-toggle').click()
  await expect(page.locator('#history-panel')).toHaveClass(/hidden/)
})

test('計測後 HIST を開くと Canvas が描画される', async ({ page }) => {
  await goExpert(page)
  await startAndWait(page, 3)
  await page.locator('#btn-stop').click()

  await page.locator('#btn-history-toggle').click()
  await page.waitForTimeout(500)  // 非同期loadRecent待ち

  const graphWidth = await page.locator('#history-graph').evaluate(c => c.width)
  expect(graphWidth).toBeGreaterThan(0)
})

test('5min / 30min / ALL ボタンで範囲切替できる', async ({ page }) => {
  await goExpert(page)
  await page.locator('#btn-history-toggle').click()

  // 30min ボタンをクリック
  await page.locator('.btn-range[data-range="30"]').click()
  await expect(page.locator('.btn-range[data-range="30"]')).toHaveClass(/active/)

  // ALL ボタンをクリック
  await page.locator('.btn-range[data-range="0"]').click()
  await expect(page.locator('.btn-range[data-range="0"]')).toHaveClass(/active/)

  // 5min に戻す
  await page.locator('.btn-range[data-range="5"]').click()
  await expect(page.locator('.btn-range[data-range="5"]')).toHaveClass(/active/)
})

test('CLEAR ボタンで履歴が削除される', async ({ page }) => {
  await goExpert(page)
  await startAndWait(page, 2)
  await page.locator('#btn-stop').click()

  await page.locator('#btn-history-toggle').click()
  await page.waitForTimeout(300)

  await page.locator('#btn-history-clear').click()

  const count = await countIndexedDB(page)
  expect(count).toBe(0)
})

test('計測中に履歴が蓄積される', async ({ page }) => {
  await goExpert(page)
  await startAndWait(page, 2)
  await page.locator('#btn-stop').click()

  const count = await countIndexedDB(page)
  expect(count).toBeGreaterThanOrEqual(2)
})
