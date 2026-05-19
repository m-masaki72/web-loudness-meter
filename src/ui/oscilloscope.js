export class Oscilloscope {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')
    this._offscreen = null  // スキャンライン + グリッドのキャッシュ
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
    this._buildOffscreen()
  }

  // スキャンライン + グリッドをオフスクリーンにキャッシュ（リサイズ時のみ再生成）
  _buildOffscreen() {
    const { w, h } = this
    if (w === 0 || h === 0) return
    const oc = document.createElement('canvas')
    oc.width = w; oc.height = h
    const ctx = oc.getContext('2d')

    // スキャンライン
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)

    // グリッド
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.06)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= w; x += w / 8) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y <= h; y += h / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()

    this._offscreen = oc
  }

  draw(waveform) {
    const ctx = this.ctx, w = this.w, h = this.h
    const cy = h / 2

    // 背景フェードアウト（余韻効果）
    ctx.fillStyle = 'rgba(0, 8, 4, 0.35)'
    ctx.fillRect(0, 0, w, h)

    // キャッシュ済みスキャンライン + グリッドを1回の drawImage で合成
    if (this._offscreen) ctx.drawImage(this._offscreen, 0, 0)

    if (!waveform || waveform.length === 0) {
      this._drawIdle(ctx, cy, w, h)
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
  }

  _tracePath(ctx, waveform, N, step, cy, h) {
    ctx.moveTo(0, cy - waveform[0] * cy * 0.9)
    for (let i = 1; i < N; i++) {
      ctx.lineTo(i * step, cy - waveform[i] * cy * 0.9)
    }
  }

  _drawIdle(ctx, cy, w, h) {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)'
    ctx.lineWidth = 1
    ctx.shadowBlur = 6; ctx.shadowColor = '#00ff88'
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke()
    ctx.shadowBlur = 0
  }
}
