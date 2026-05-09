/**
 * AudioWorkletProcessor: サンプル単位でLUFS / dBA / dBC を計算。
 * ITU-R BS.1770-4 準拠。
 */

// --- インライン Biquad（Workletはimport不可なため） ---
class BiquadState {
  constructor() { this.x1=0; this.x2=0; this.y1=0; this.y2=0 }
  process(x, c) {
    const y = c[0]*x + c[1]*this.x1 + c[2]*this.x2 - c[3]*this.y1 - c[4]*this.y2
    this.x2=this.x1; this.x1=x; this.y2=this.y1; this.y1=y
    return y
  }
}

const TWO_PI = 2 * Math.PI

function biquadHP(fc, fs) {
  const w0 = TWO_PI * fc / fs, alpha = Math.sin(w0)/(2*0.7071), cosw = Math.cos(w0), a0=1+alpha
  return [(1+cosw)/2/a0, -(1+cosw)/a0, (1+cosw)/2/a0, -2*cosw/a0, (1-alpha)/a0]
}
function biquadLP(fc, fs) {
  const w0 = TWO_PI * fc / fs, alpha = Math.sin(w0)/(2*0.7071), cosw = Math.cos(w0), a0=1+alpha
  return [(1-cosw)/2/a0, (1-cosw)/a0, (1-cosw)/2/a0, -2*cosw/a0, (1-alpha)/a0]
}
function biquadHighShelf(fc, gain_dB, fs) {
  const A=Math.pow(10,gain_dB/40), w0=TWO_PI*fc/fs, cosw=Math.cos(w0), sinw=Math.sin(w0)
  // S=1 shelf slope → alpha = sinw/2 * sqrt(2), per Audio EQ Cookbook
  const alpha = sinw / 2 * Math.sqrt(2)
  const a0=(A+1)-(A-1)*cosw+2*Math.sqrt(A)*alpha
  return [
    A*((A+1)+(A-1)*cosw+2*Math.sqrt(A)*alpha)/a0,
    -2*A*((A-1)+(A+1)*cosw)/a0,
    A*((A+1)+(A-1)*cosw-2*Math.sqrt(A)*alpha)/a0,
    2*((A-1)-(A+1)*cosw)/a0,
    ((A+1)-(A-1)*cosw-2*Math.sqrt(A)*alpha)/a0,
  ]
}
function cascade(x, coeffs, states) {
  let s = x
  for (let i=0; i<coeffs.length; i++) s = states[i].process(s, coeffs[i])
  return s
}

// --- LUFSパラメータ ---
const BLOCK_SIZE  = 128
const MOMENTARY_WINDOW  = 0.4   // 400ms
const SHORTTERM_WINDOW  = 3.0   // 3s
const GATE_ABSOLUTE_DB  = -70   // 絶対ゲート
const GATE_RELATIVE_LU  = -10   // 相対ゲート
// Integrated LUFS用リングバッファ上限（~10分 @ 44.1kHz: 44100/128≈345 blocks/s × 600s）
const MAX_GATED = 207000

class LoudnessProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._ready = false
    this.port.onmessage = (e) => {
      if (e.data.type === 'init') this._init(e.data.sampleRate)
    }
  }

  _init(fs) {
    this.fs = fs

    // K-weighting（LUFS）
    this.kCoeffs = [biquadHighShelf(1681.974450955533, 3.999843853973347, fs), biquadHP(38.13547087602444, fs)]
    this.kState  = [new BiquadState(), new BiquadState()]

    // A-weighting
    this.aCoeffs = [biquadHP(20.6,fs), biquadHP(107.7,fs), biquadHP(737.9,fs), biquadLP(12194,fs)]
    this.aState  = [new BiquadState(), new BiquadState(), new BiquadState(), new BiquadState()]

    // C-weighting
    this.cCoeffs = [biquadHP(20.6,fs), biquadLP(12194,fs)]
    this.cState  = [new BiquadState(), new BiquadState()]

    // リングバッファ（モーメンタリ・ショートタームのためのMSブロック履歴）
    const mBlocks = Math.ceil(MOMENTARY_WINDOW * fs / BLOCK_SIZE)
    const sBlocks = Math.ceil(SHORTTERM_WINDOW * fs / BLOCK_SIZE)
    this.msHistory  = new Float64Array(sBlocks)
    this.msHead     = 0
    this.totalBlocks = sBlocks
    this.mBlocks    = mBlocks

    // Integrated用リングバッファ（メモリ上限付き）
    this.gatedBuf   = new Float64Array(MAX_GATED)
    this.gatedHead  = 0
    this.gatedFull  = false
    this.ungatedMSSum = 0
    this.ungatedCount = 0

    this._ready = true
  }

  process(inputs) {
    if (!this._ready) return true
    const input = inputs[0]
    if (!input || !input[0]) return true
    const samples = input[0]
    const N = samples.length

    // 全フィルタとRawを1ループで計算
    let msK = 0, msA = 0, msC = 0, msRaw = 0
    for (let i = 0; i < N; i++) {
      const s = samples[i]
      const ks = cascade(s, this.kCoeffs, this.kState)
      const as = cascade(s, this.aCoeffs, this.aState)
      const cs = cascade(s, this.cCoeffs, this.cState)
      msK  += ks * ks
      msA  += as * as
      msC  += cs * cs
      msRaw += s * s
    }
    msK /= N; msA /= N; msC /= N; msRaw /= N

    // リングバッファに格納
    this.msHistory[this.msHead % this.totalBlocks] = msK
    this.msHead++

    // Momentary（直近mBlocks）
    const mStart = Math.max(0, this.msHead - this.mBlocks)
    let mSum = 0, mCount = 0
    for (let i = mStart; i < this.msHead; i++) {
      mSum += this.msHistory[i % this.totalBlocks]
      mCount++
    }
    const lufsM = mCount > 0 ? -0.691 + 10 * Math.log10(mSum / mCount + 1e-10) : -Infinity

    // Short-term（直近totalBlocks）
    const sCount = Math.min(this.msHead, this.totalBlocks)
    let sSum = 0
    for (let i = 0; i < sCount; i++) sSum += this.msHistory[i]
    const lufsS = sCount > 0 ? -0.691 + 10 * Math.log10(sSum / sCount + 1e-10) : -Infinity

    // Integrated（相対ゲーティング）
    const absGate = Math.pow(10, (GATE_ABSOLUTE_DB + 0.691) / 10)
    if (msK > absGate) {
      this.ungatedMSSum += msK
      this.ungatedCount++
      this.gatedBuf[this.gatedHead] = msK
      this.gatedHead++
      if (this.gatedHead >= MAX_GATED) { this.gatedHead = 0; this.gatedFull = true }
    }
    let lufsI = -Infinity
    if (this.ungatedCount > 0) {
      const ungatedLUFS = -0.691 + 10 * Math.log10(this.ungatedMSSum / this.ungatedCount)
      const relGate = Math.pow(10, (ungatedLUFS + GATE_RELATIVE_LU + 0.691) / 10)
      const gatedLen = this.gatedFull ? MAX_GATED : this.gatedHead
      let rSum = 0, rCount = 0
      for (let i = 0; i < gatedLen; i++) {
        const ms = this.gatedBuf[i]
        if (ms > relGate) { rSum += ms; rCount++ }
      }
      if (rCount > 0) lufsI = -0.691 + 10 * Math.log10(rSum / rCount)
    }

    const dbfs = 20 * Math.log10(Math.sqrt(msRaw) + 1e-10)
    const dba  = -0.691 + 10 * Math.log10(msA + 1e-10)
    const dbc  = -0.691 + 10 * Math.log10(msC + 1e-10)

    this.port.postMessage({ dbfs, dba, dbc, lufsM, lufsS, lufsI })
    return true
  }
}

registerProcessor('loudness-processor', LoudnessProcessor)
