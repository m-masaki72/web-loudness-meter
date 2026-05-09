/**
 * LEDバーグラフ × 3本（dBFS / dBA / LUFS-I）
 * セグメント単位でグロー付き（緑→黄→赤）
 */

const DB_MIN = -60
const DB_MAX = 0
const WARN_DB = -12
const CLIP_DB = -3

const SEG_COUNT = 40

function dbToFrac(db) {
  return Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)))
}

function segColor(frac) {
  if (frac > 0.9)  return { fill: '#ff3333', glow: 'rgba(255,51,51,0.6)' }
  if (frac > 0.75) return { fill: '#ffcc00', glow: 'rgba(255,204,0,0.5)' }
  return             { fill: '#00ff88', glow: 'rgba(0,255,136,0.45)' }
}

export class BarMeter {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')
    this._resize()
    this._vals = [DB_MIN, DB_MIN, DB_MIN]
    this._peaks = [DB_MIN, DB_MIN, DB_MIN]
    this._peakTimers = [0, 0, 0]
    this._labels = ['dBFS', 'dBA', 'LUFS-I']
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

  update(dbfs, dba, lufsI) {
    this._vals[0] = isFinite(dbfs)  ? dbfs  : DB_MIN
    this._vals[1] = isFinite(dba)   ? dba   : DB_MIN
    this._vals[2] = isFinite(lufsI) ? lufsI : DB_MIN

    for (let i = 0; i < 3; i++) {
      if (this._vals[i] > this._peaks[i]) {
        this._peaks[i] = this._vals[i]
        this._peakTimers[i] = 60 // ~1s @ 60fps
      }
      if (this._peakTimers[i] > 0) this._peakTimers[i]--
      else if (this._peakTimers[i] === 0) {
        this._peaks[i] = Math.max(this._peaks[i] - 0.5, this._vals[i])
      }
    }
  }

  draw() {
    const ctx = this.ctx, w = this.w, h = this.h
    ctx.clearRect(0, 0, w, h)

    const colW   = w / 3
    const labH   = 14
    const barH   = h - labH - 4
    const segH   = Math.floor(barH / SEG_COUNT)
    const gap    = 2
    const padX   = 4

    for (let col = 0; col < 3; col++) {
      const x0 = col * colW + padX
      const bw  = colW - padX * 2
      const frac = dbToFrac(this._vals[col])
      const litSegs = Math.round(frac * SEG_COUNT)

      for (let s = 0; s < SEG_COUNT; s++) {
        const segFrac = s / SEG_COUNT
        const y = labH + barH - (s + 1) * segH + gap / 2
        const sh = segH - gap

        if (s < litSegs) {
          const c = segColor(segFrac + 1 / SEG_COUNT)
          ctx.fillStyle = c.fill
          ctx.shadowBlur = 5
          ctx.shadowColor = c.glow
        } else {
          // 消灯セグメント
          ctx.fillStyle = '#1a1a1a'
          ctx.shadowBlur = 0
        }
        ctx.fillRect(x0, y, bw, sh)
      }
      ctx.shadowBlur = 0

      // ピークホールド
      const peakFrac = dbToFrac(this._peaks[col])
      const peakSeg  = Math.round(peakFrac * SEG_COUNT)
      if (peakSeg > 0 && peakSeg < SEG_COUNT) {
        const py  = labH + barH - peakSeg * segH + gap / 2
        const psh = segH - gap
        const pc = segColor(peakFrac)
        ctx.fillStyle = pc.fill
        ctx.shadowBlur = 8
        ctx.shadowColor = pc.glow
        ctx.fillRect(x0, py, bw, psh)
        ctx.shadowBlur = 0
      }

      // ラベル
      ctx.fillStyle = '#555'
      ctx.font = '9px Courier New'
      ctx.textAlign = 'center'
      ctx.fillText(this._labels[col], x0 + bw / 2, h - 2)

      // 区切り線
      if (col < 2) {
        ctx.strokeStyle = '#2a2a2a'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo((col + 1) * colW, labH)
        ctx.lineTo((col + 1) * colW, h)
        ctx.stroke()
      }
    }
  }
}
