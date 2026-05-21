import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fakeAudioPath = resolve(__dirname, 'tests/e2e/fixtures/sine_1k.wav')
  .replace(/\\/g, '/')

const fakeMicArgs = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${fakeAudioPath}`,
  // AudioWorklet の Blob URL ロードを CSP がブロックするのを回避
  '--disable-web-security',
  '--allow-running-insecure-content',
]

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'tests/e2e/report', open: 'never' }]],

  use: {
    // vite.config.js の base: '/web-loudness-meter/' に合わせる
    baseURL: 'http://localhost:5173/web-loudness-meter/',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/error-handling.spec.js'],
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: { args: fakeMicArgs },
      },
    },
    {
      name: 'mobile-chrome',
      testIgnore: ['**/error-handling.spec.js'],
      use: {
        ...devices['Pixel 5'],
        permissions: ['microphone'],
        launchOptions: { args: fakeMicArgs },
      },
    },
    // マイク拒否テスト専用（権限拒否でgetUserMediaが失敗する）
    {
      name: 'no-mic',
      testMatch: ['**/error-handling.spec.js'],
      use: {
        ...devices['Desktop Chrome'],
        // permissions を付与しない = getUserMedia が NotAllowedError になる
        launchOptions: {
          args: [
            '--disable-web-security',
            // fake-ui を使わないことで許可ダイアログが出るが headless では自動拒否
            '--deny-permission-prompts',
          ],
        },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/web-loudness-meter/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
