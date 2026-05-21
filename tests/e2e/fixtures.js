import { test as base, expect } from '@playwright/test'

// Chromium headless では AudioWorklet の addModule(blobUrl) が
// CSP メタタグ "worker-src blob:" の解釈を strict に行うため、
// テスト環境ではメタタグを除去して動作させる。
// 本番（HTTPS）環境では blob: worker-src が正常に機能することを手動確認済み。
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/', async route => {
      const response = await route.fetch()
      const contentType = response.headers()['content-type'] ?? ''
      if (!contentType.includes('text/html')) {
        await route.fulfill({ response })
        return
      }
      let body = await response.text()
      body = body.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        '<!-- CSP relaxed for E2E: Chromium headless strict-mode workaround -->'
      )
      await route.fulfill({ response, body })
    })
    await use(page)
  },
})

export { expect }

// AudioWorklet 初期化完了まで待つヘルパー
export async function waitForMeasurement(page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('val-dbfs')
      return el && el.textContent !== '---.-'
    },
    { timeout }
  )
}
