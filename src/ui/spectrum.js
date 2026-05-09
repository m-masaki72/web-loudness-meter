/**
 * FFTスペクトラムアナライザー
 * 対数周波数スケール（20Hz〜20kHz）でバー表示
 */

const FREQ_MIN = 20
const FREQ_MAX = 20000
const DB_MIN = -90
const DB_MAX = 0

// 表示する周波数グリッド線
const GRID_FREQS = [100, 200, 500, 1000, 2000, 5000, 10000]

function freqToX(freq, w) {
  return w * (Math.log10(freq / FREQ_MIN) / Math.log10(FREQ_MAX / FREQ_MIN))
}

function dbToY(db, h) {
  return h * (1 - (db - DB_MIN) / (DB_MAX - DB_MIN))
}

function binToFreq(bin, binCount, sampleRate) {
  return (bin / binCount) * (sampleRate / 2)
}

export class SpectrumAnalyzer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this._resize()
    new ResizeObserver(() => { this._resize(); this.draw(null, 48000) }).observe(canvas)
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width  = rect.width  * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.scale(dpr, dpr)
    this.w = rect.width
    this.h = rect.height
  }

  draw(freqData, sampleRate) {
    const ctx = this.ctx, w = this.w, h = this.h
    ctx.clearRect(0, 0, w, h)

    // 背景
    ctx.fillStyle = '#0d0d0d'
    ctx.fillRect(0, 0, w, h)

    // グリッド線 & 周波数ラベル
    ctx.strokeStyle = '#1e1e1e'
    ctx.lineWidth = 1
    ctx.fillStyle = '#333'
    ctx.font = '8px Courier New'
    ctx.textAlign = 'center'
    for (const f of GRID_FREQS) {
      const x = freqToX(f, w)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`
      ctx.fillText(label, x, h - 2)
    }

    if (!freqData) return

    const binCount = freqData.length
    const BAR_WIDTH = 2

    // 各バーを対数スケールで描画
    const logMin = Math.log10(FREQ_MIN)
    const logMax = Math.log10(FREQ_MAX)
    const steps = Math.floor(w / BAR_WIDTH)

    for (let i = 0; i < steps; i++) {
      const logF = logMin + (i / steps) * (logMax - logMin)
      const freq  = Math.pow(10, logF)
      const bin   = Math.round(freq / (sampleRate / 2) * binCount)
      if (bin < 0 || bin >= binCount) continue

      const db = freqData[bin]
      const y  = dbToY(Math.max(DB_MIN, Math.min(DB_MAX, db)), h - 10)
      const barH = h - 10 - y

      if (barH <= 0) continue

      // 高さに応じて色変え（緑→黄→赤）
      const frac = 1 - y / (h - 10)
      let color
      if (frac > 0.9)       color = '#ff3333'
      else if (frac > 0.75) color = '#ffcc00'
      else                  color = '#00ff88'

      ctx.fillStyle = color
      ctx.fillRect(i * BAR_WIDTH, y, BAR_WIDTH - 1, barH)
    }
  }
}
