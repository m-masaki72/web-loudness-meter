/**
 * FFTスペクトラムアナライザー
 * 対数周波数スケール（20Hz〜20kHz）でバー表示
 */

const FREQ_MIN = 20
const FREQ_MAX = 20000
const DB_MIN = -90
const DB_MAX = 0
const BAR_WIDTH = 2

const GRID_FREQS = [100, 200, 500, 1000, 2000, 5000, 10000]

function freqToX(freq, w) {
  return w * (Math.log10(freq / FREQ_MIN) / Math.log10(FREQ_MAX / FREQ_MIN))
}

function dbToY(db, h) {
  return h * (1 - (db - DB_MIN) / (DB_MAX - DB_MIN))
}

export class SpectrumAnalyzer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this._sampleRate = 48000
    this._barBins = null   // リサイズ時に事前計算した bin インデックス配列
    this._resize()
    new ResizeObserver(() => { this._resize(); this.draw(null) }).observe(canvas)
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width  = rect.width  * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.scale(dpr, dpr)
    this.w = rect.width
    this.h = rect.height
    this._buildBarBins()
  }

  // 各バーの対数周波数→bin インデックスを事前計算（resize 時のみ）
  _buildBarBins() {
    const steps = Math.floor(this.w / BAR_WIDTH)
    const logMin = Math.log10(FREQ_MIN)
    const logMax = Math.log10(FREQ_MAX)
    this._barBins = new Float32Array(steps)
    for (let i = 0; i < steps; i++) {
      const logF = logMin + (i / steps) * (logMax - logMin)
      this._barBins[i] = Math.pow(10, logF)  // 周波数 (Hz) を保存
    }
  }

  draw(freqData, sampleRate) {
    if (sampleRate != null) this._sampleRate = sampleRate
    sampleRate = this._sampleRate
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

    if (!freqData || !this._barBins) return

    const binCount = freqData.length
    const nyquist = sampleRate / 2
    const steps = this._barBins.length

    for (let i = 0; i < steps; i++) {
      const bin = Math.round(this._barBins[i] / nyquist * binCount)
      if (bin < 0 || bin >= binCount) continue

      const db = freqData[bin]
      const y  = dbToY(Math.max(DB_MIN, Math.min(DB_MAX, db)), h - 10)
      const barH = h - 10 - y
      if (barH <= 0) continue

      const frac = 1 - y / (h - 10)
      ctx.fillStyle = frac > 0.9 ? '#ff3333' : frac > 0.75 ? '#ffcc00' : '#00ff88'
      ctx.fillRect(i * BAR_WIDTH, y, BAR_WIDTH - 1, barH)
    }
  }
}
