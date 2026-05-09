export class Oscilloscope {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')
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
  }

  draw(waveform) {
    const ctx = this.ctx, w = this.w, h = this.h
    const cx = w / 2, cy = h / 2

    // 背景：フェードアウト（余韻効果）
    ctx.fillStyle = 'rgba(0, 8, 4, 0.35)'
    ctx.fillRect(0, 0, w, h)

    // スキャンライン（CRT感）
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.fillRect(0, y, w, 1)
    }

    if (!waveform || waveform.length === 0) {
      this._drawIdle(ctx, cx, cy, w)
      return
    }

    const N = waveform.length
    const step = w / N

    // グロー外側レイヤー
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)'
    ctx.lineWidth = 6
    ctx.shadowBlur = 0
    this._tracePath(ctx, waveform, N, step, cy, h)
    ctx.stroke()

    // グロー中間レイヤー
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)'
    ctx.lineWidth = 2.5
    this._tracePath(ctx, waveform, N, step, cy, h)
    ctx.stroke()

    // 発光コアライン
    ctx.beginPath()
    ctx.strokeStyle = '#00ff88'
    ctx.lineWidth = 1.2
    ctx.shadowBlur = 14
    ctx.shadowColor = '#00ff88'
    this._tracePath(ctx, waveform, N, step, cy, h)
    ctx.stroke()
    ctx.shadowBlur = 0

    // グリッド
    this._drawGrid(ctx, w, h)
  }

  _tracePath(ctx, waveform, N, step, cy, h) {
    ctx.moveTo(0, cy - waveform[0] * cy * 0.9)
    for (let i = 1; i < N; i++) {
      ctx.lineTo(i * step, cy - waveform[i] * cy * 0.9)
    }
  }

  _drawGrid(ctx, w, h) {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.06)'
    ctx.lineWidth = 0.5
    // 縦線
    for (let x = 0; x <= w; x += w / 8) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    // 横線
    for (let y = 0; y <= h; y += h / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    // 中心線
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke()
  }

  _drawIdle(ctx, cx, cy, w) {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)'
    ctx.lineWidth = 1
    ctx.shadowBlur = 6; ctx.shadowColor = '#00ff88'
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke()
    ctx.shadowBlur = 0
    this._drawGrid(ctx, w, this.h)
  }
}
