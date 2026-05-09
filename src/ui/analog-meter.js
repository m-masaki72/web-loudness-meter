/**
 * アナログ針メーター（VU風）
 * 物理バネモデルで慣性のある針アニメーション。
 * Radial Gradient で金属盤面質感。
 */

const DB_MIN = -40
const DB_MAX = 0
// 針の角度：左端=-135°、右端=-45°（上方向を0°として）
const ANGLE_MIN = -Math.PI * 0.78
const ANGLE_MAX = -Math.PI * 0.22

const SPRING   = 0.12
const DAMPING  = 0.55

function dbToAngle(db) {
  const t = Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)))
  return ANGLE_MIN + t * (ANGLE_MAX - ANGLE_MIN)
}

export class AnalogMeter {
  constructor(canvas) {
    this.canvas   = canvas
    this.ctx      = canvas.getContext('2d')
    this._angle   = ANGLE_MIN
    this._vel     = 0
    this._target  = ANGLE_MIN
    this._resize()
    this._drawStatic()
    new ResizeObserver(() => { this._resize(); this._drawStatic() }).observe(canvas)
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

  setValue(db) {
    this._target = dbToAngle(isFinite(db) ? db : DB_MIN)
  }

  _drawStatic() {
    const ctx = this.ctx, w = this.w, h = this.h
    const cx = w / 2
    const cy = h * 0.78
    const R  = Math.min(w, h) * 0.72

    // 盤面（ラジアルグラデーション）
    const grad = ctx.createRadialGradient(cx, cy - R*0.1, R*0.1, cx, cy, R*1.1)
    grad.addColorStop(0,   '#2e2e2e')
    grad.addColorStop(0.4, '#1a1a1a')
    grad.addColorStop(0.8, '#0d0d0d')
    grad.addColorStop(1,   '#000')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, R * 1.05, Math.PI * 1.0, Math.PI * 2.0)
    ctx.fill()

    // 目盛り
    const ticks = [
      { db: -40, label: '-40' },
      { db: -30, label: '-30' },
      { db: -20, label: '-20' },
      { db: -10, label: '-10' },
      { db:  -7, label: '-7' },
      { db:  -5, label: '-5' },
      { db:  -3, label: '-3' },
      { db:   0, label: '0' },
    ]
    ticks.forEach(({ db, label }) => {
      const ang = dbToAngle(db)
      const isClip = db >= -3
      const tickR = isClip ? R * 0.88 : R * 0.84
      const x1 = cx + Math.cos(ang) * tickR
      const y1 = cy + Math.sin(ang) * tickR
      const x2 = cx + Math.cos(ang) * R * 0.95
      const y2 = cy + Math.sin(ang) * R * 0.95
      ctx.strokeStyle = isClip ? '#ff5533' : '#888'
      ctx.lineWidth   = isClip ? 2 : 1
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()

      const lx = cx + Math.cos(ang) * (tickR - 10)
      const ly = cy + Math.sin(ang) * (tickR - 10)
      ctx.fillStyle = isClip ? '#ff5533' : '#666'
      ctx.font = `${isClip ? 9 : 8}px Courier New`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, lx, ly)
    })

    // 細目盛り（5dBごと）
    for (let db = DB_MIN; db <= DB_MAX; db += 2) {
      const ang = dbToAngle(db)
      const r1 = R * 0.92, r2 = R * 0.95
      ctx.strokeStyle = 'rgba(100,100,100,0.4)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
      ctx.stroke()
    }

    // VUラベル
    ctx.fillStyle = '#888'
    ctx.font = '10px Courier New'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('VU', cx, cy - R * 0.35)

    this._cx = cx; this._cy = cy; this._R = R
  }

  draw() {
    // バネ物理アニメーション
    this._vel += (this._target - this._angle) * SPRING
    this._vel *= DAMPING
    this._angle += this._vel

    // 盤面を再描画（針の残像を消すため）_cx/_cy/_R もここで更新される
    this._drawStatic()

    const ctx = this.ctx, cx = this._cx, cy = this._cy, R = this._R

    // 針
    const needleLen = R * 0.85
    const nx = cx + Math.cos(this._angle) * needleLen
    const ny = cy + Math.sin(this._angle) * needleLen

    ctx.strokeStyle = '#eee'
    ctx.lineWidth   = 1.5
    ctx.shadowBlur  = 4
    ctx.shadowColor = 'rgba(255,255,255,0.3)'
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke()
    ctx.shadowBlur = 0

    // 針軸
    const axisGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8)
    axisGrad.addColorStop(0, '#ccc')
    axisGrad.addColorStop(1, '#444')
    ctx.fillStyle = axisGrad
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill()
  }
}
