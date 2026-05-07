/**
 * Biquad係数生成：A特性・C特性・K特性（LUFS用）
 * サンプルレートに応じて動的計算。
 * 各係数は [b0, b1, b2, a1, a2] の形式（a0正規化済み）。
 */

const TWO_PI = 2 * Math.PI

function biquadLP(fc, fs) {
  const w0 = TWO_PI * fc / fs
  const alpha = Math.sin(w0) / (2 * 0.7071)
  const cosw = Math.cos(w0)
  const a0 = 1 + alpha
  return [
    (1 - cosw) / 2 / a0,
    (1 - cosw) / a0,
    (1 - cosw) / 2 / a0,
    -2 * cosw / a0,
    (1 - alpha) / a0,
  ]
}

function biquadHP(fc, fs) {
  const w0 = TWO_PI * fc / fs
  const alpha = Math.sin(w0) / (2 * 0.7071)
  const cosw = Math.cos(w0)
  const a0 = 1 + alpha
  return [
    (1 + cosw) / 2 / a0,
    -(1 + cosw) / a0,
    (1 + cosw) / 2 / a0,
    -2 * cosw / a0,
    (1 - alpha) / a0,
  ]
}

function biquadHighShelf(fc, gain_dB, fs) {
  const A = Math.pow(10, gain_dB / 40)
  const w0 = TWO_PI * fc / fs
  const cosw = Math.cos(w0)
  const sinw = Math.sin(w0)
  const S = 1
  const alpha = sinw / 2 * Math.sqrt((A + 1/A) * (1/S - 1) + 2)
  const a0 = (A+1) - (A-1)*cosw + 2*Math.sqrt(A)*alpha
  return [
    (A * ((A+1) + (A-1)*cosw + 2*Math.sqrt(A)*alpha)) / a0,
    (-2 * A * ((A-1) + (A+1)*cosw)) / a0,
    (A * ((A+1) + (A-1)*cosw - 2*Math.sqrt(A)*alpha)) / a0,
    (2 * ((A-1) - (A+1)*cosw)) / a0,
    ((A+1) - (A-1)*cosw - 2*Math.sqrt(A)*alpha) / a0,
  ]
}

// A特性：4次カスケード（近似）
export function getAWeightingCoeffs(fs) {
  // IEC 61672-1 A-weighting poles: 20.6, 107.7, 737.9, 12194 Hz
  const hp1 = biquadHP(20.6, fs)
  const hp2 = biquadHP(107.7, fs)
  const hp3 = biquadHP(737.9, fs)
  const lp1 = biquadLP(12194, fs)
  return [hp1, hp2, hp3, lp1]
}

// C特性：2次カスケード
export function getCWeightingCoeffs(fs) {
  const hp = biquadHP(20.6, fs)
  const lp = biquadLP(12194, fs)
  return [hp, lp]
}

// K特性（ITU-R BS.1770-4 LUFS用）：2段
export function getKWeightingCoeffs(fs) {
  const stage1 = biquadHighShelf(1681.974450955533, 3.999843853973347, fs)
  const stage2 = biquadHP(38.13547087602444, fs)
  return [stage1, stage2]
}

// Biquadフィルター状態（Direct Form I）
export class BiquadState {
  constructor() { this.x1=0; this.x2=0; this.y1=0; this.y2=0 }
  process(x, c) {
    const y = c[0]*x + c[1]*this.x1 + c[2]*this.x2 - c[3]*this.y1 - c[4]*this.y2
    this.x2=this.x1; this.x1=x; this.y2=this.y1; this.y1=y
    return y
  }
}

// 複数フィルターのカスケード適用
export function applyCascade(sample, coeffsList, states) {
  let s = sample
  for (let i = 0; i < coeffsList.length; i++) {
    s = states[i].process(s, coeffsList[i])
  }
  return s
}
