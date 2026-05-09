/**
 * 計測履歴折れ線グラフ
 * 表示チャンネル: dBFS (緑) / dBA (黄) / LUFS-I (紫)
 */

const DB_MIN = -60
const DB_MAX = 0
const LINES = [
  { key: 'dbfs',  color: '#00ff88', label: 'dBFS'   },
  { key: 'dba',   color: '#ffcc00', label: 'dBA'    },
  { key: 'lufsI', color: '#cc88ff', label: 'LUFS-I' },
]

export class HistoryGraph {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this._samples = []
    this._resize()
    new ResizeObserver(() => { this._resize(); this.draw() }).observe(canvas)
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

  update(samples) {
    this._samples = samples
    this.draw()
  }

  draw() {
    const ctx = this.ctx, w = this.w, h = this.h
    const PAD_B = 14
    const plotH = h - PAD_B

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, w, h)

    if (this._samples.length < 2) {
      ctx.fillStyle = '#333'
      ctx.font = '10px Courier New'
      ctx.textAlign = 'center'
      ctx.fillText('NO DATA', w / 2, h / 2)
      return
    }

    const tMin = this._samples[0].timestamp
    const tMax = this._samples[this._samples.length - 1].timestamp
    const tRange = tMax - tMin || 1

    const xOf = (t) => (t - tMin) / tRange * w
    const yOf = (v) => {
      const clamped = Math.max(DB_MIN, Math.min(DB_MAX, isFinite(v) ? v : DB_MIN))
      return PAD_B + plotH * (1 - (clamped - DB_MIN) / (DB_MAX - DB_MIN))
    }

    // グリッド線（-12dB, -3dB）
    for (const db of [-60, -48, -36, -24, -12, 0]) {
      const y = yOf(db)
      ctx.strokeStyle = db === 0 ? '#3a1a1a' : '#1e1e1e'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    // 時間軸ラベル
    const totalSec = tRange / 1000
    ctx.fillStyle = '#333'
    ctx.font = '8px Courier New'
    ctx.textAlign = 'left'
    ctx.fillText('0s', 2, h - 2)
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(totalSec)}s`, w - 2, h - 2)

    // 折れ線
    for (const line of LINES) {
      ctx.strokeStyle = line.color
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 4
      ctx.shadowColor = line.color
      ctx.beginPath()
      let started = false
      for (const s of this._samples) {
        const val = s[line.key]
        if (!isFinite(val)) { started = false; continue }
        const x = xOf(s.timestamp)
        const y = yOf(val)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0

    // 凡例
    let lx = 4
    ctx.font = '8px Courier New'
    for (const line of LINES) {
      ctx.fillStyle = line.color
      ctx.textAlign = 'left'
      ctx.fillText(line.label, lx, 10)
      lx += ctx.measureText(line.label).width + 10
    }
  }
}
