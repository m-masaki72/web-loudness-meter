// SYNC: loudness-processor.js のインライン版と同一ロジック。
// worklet は blob URL で self-contained が必要なため2ファイル構成を維持する。

export const TWO_PI = 2 * Math.PI

export class BiquadState {
  constructor() { this.x1=0; this.x2=0; this.y1=0; this.y2=0 }
  process(x, c) {
    const y = c[0]*x + c[1]*this.x1 + c[2]*this.x2 - c[3]*this.y1 - c[4]*this.y2
    this.x2=this.x1; this.x1=x; this.y2=this.y1; this.y1=y
    return y
  }
}

export function biquadHP(fc, fs) {
  const w0 = TWO_PI * fc / fs, alpha = Math.sin(w0)/(2*0.7071), cosw = Math.cos(w0), a0=1+alpha
  return [(1+cosw)/2/a0, -(1+cosw)/a0, (1+cosw)/2/a0, -2*cosw/a0, (1-alpha)/a0]
}

export function biquadLP(fc, fs) {
  const w0 = TWO_PI * fc / fs, alpha = Math.sin(w0)/(2*0.7071), cosw = Math.cos(w0), a0=1+alpha
  return [(1-cosw)/2/a0, (1-cosw)/a0, (1-cosw)/2/a0, -2*cosw/a0, (1-alpha)/a0]
}

export function biquadHighShelf(fc, gain_dB, fs) {
  const A=Math.pow(10,gain_dB/40), w0=TWO_PI*fc/fs, cosw=Math.cos(w0), sinw=Math.sin(w0)
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

export function cascade(x, coeffs, states) {
  let s = x
  for (let i=0; i<coeffs.length; i++) s = states[i].process(s, coeffs[i])
  return s
}
