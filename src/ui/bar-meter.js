/**
 * LEDバーグラフ × 3本（dBFS / dBA / LUFS-I）
 * セグメント単位でグロー付き（緑→黄→赤）
 */

const DB_MIN = -60
const DB_MAX = 0
const WARN_DB = -12
const CLIP_DB = -3

const SEG_COUNT = 40
// 色域境界（セグメントインデックス）
const SEG_YELLOW = Math.floor(SEG_COUNT * 0.75)  // 30
const SEG_RED    = Math.floor(SEG_COUNT * 0.90)  // 36

// ピークホールド後のdecay速度（dB/frame）。~2 dB/s @ 60fps
const PEAK_DECAY_RATE = 0.033

function dbToFrac(db) {
  return Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)))
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

  resetPeaks() {
    this._peaks = [DB_MIN, DB_MIN, DB_MIN]
    this._peakTimers = [0, 0, 0]
  }

  update(dbfs, dba, lufsI) {
    this._vals[0] = isFinite(dbfs)  ? dbfs  : DB_MIN
    this._vals[1] = isFinite(dba)   ? dba   : DB_MIN
    this._vals[2] = isFinite(lufsI) ? lufsI : DB_MIN

    for (let i = 0; i < 3; i++) {
      if (this._vals[i] > this._peaks[i]) {
        this._peaks[i] = this._vals[i]
        this._peakTimers[i] = 60  // ~1s @ 60fps ホールド
      }
      if (this._peakTimers[i] > 0) {
        this._peakTimers[i]--
      } else {
        // ホールド終了後、約2 dB/s で decay
        this._peaks[i] = Math.max(this._peaks[i] - PEAK_DECAY_RATE, this._vals[i])
      }
    }
  }

  draw() {
    const ctx = this.ctx, w = this.w, h = this.h
    ctx.clearRect(0, 0, w, h)

    const colW = w / 3
    const labH = 14
    const barH = h - labH - 4
    const segH = Math.floor(barH / SEG_COUNT)
    const gap  = 2
    const padX = 4

    for (let col = 0; col < 3; col++) {
      const x0   = col * colW + padX
      const bw   = colW - padX * 2
      const frac = dbToFrac(this._vals[col])
      const litSegs = Math.round(frac * SEG_COUNT)

      // 消灯セグメント（shadow なし）
      ctx.shadowBlur = 0
      ctx.fillStyle = '#1a1a1a'
      for (let s = litSegs; s < SEG_COUNT; s++) {
        const y = labH + barH - (s + 1) * segH + gap / 2
        ctx.fillRect(x0, y, bw, segH - gap)
      }

      // 点灯セグメント（色グループ単位でshadow設定をまとめる）
      ctx.shadowBlur = 5
      const colorGroups = [
        { lo: 0,          hi: SEG_YELLOW, fill: '#00ff88', glow: 'rgba(0,255,136,0.45)' },
        { lo: SEG_YELLOW, hi: SEG_RED,    fill: '#ffcc00', glow: 'rgba(255,204,0,0.5)'  },
        { lo: SEG_RED,    hi: SEG_COUNT,  fill: '#ff3333', glow: 'rgba(255,51,51,0.6)'  },
      ]
      for (const g of colorGroups) {
        const hi = Math.min(g.hi, litSegs)
        if (g.lo >= hi) continue
        ctx.fillStyle  = g.fill
        ctx.shadowColor = g.glow
        for (let s = g.lo; s < hi; s++) {
          const y = labH + barH - (s + 1) * segH + gap / 2
          ctx.fillRect(x0, y, bw, segH - gap)
        }
      }
      ctx.shadowBlur = 0

      // ピークホールド
      const peakFrac = dbToFrac(this._peaks[col])
      const peakSeg  = Math.round(peakFrac * SEG_COUNT)
      if (peakSeg > 0 && peakSeg < SEG_COUNT) {
        const py  = labH + barH - peakSeg * segH + gap / 2
        const psh = segH - gap
        const isRed = peakSeg >= SEG_RED, isYellow = peakSeg >= SEG_YELLOW
        ctx.fillStyle  = isRed ? '#ff3333' : isYellow ? '#ffcc00' : '#00ff88'
        ctx.shadowBlur = 8
        ctx.shadowColor = isRed ? 'rgba(255,51,51,0.6)' : isYellow ? 'rgba(255,204,0,0.5)' : 'rgba(0,255,136,0.45)'
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
