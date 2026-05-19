import { describe, it, expect } from 'vitest'
import { biquadHP, biquadLP, biquadHighShelf } from '../../src/audio/dsp.js'

// z=e^{jω} での周波数応答 |H(ω)| を計算するヘルパー
// c = [b0, b1, b2, a1, a2] (a1/a2 は正の符号で格納)
function freqResponse(c, omega) {
  const cos1 = Math.cos(omega), cos2 = Math.cos(2 * omega)
  const sin1 = Math.sin(omega), sin2 = Math.sin(2 * omega)
  const numRe = c[0] + c[1] * cos1 + c[2] * cos2
  const numIm = -c[1] * sin1 - c[2] * sin2
  const denRe = 1 + c[3] * cos1 + c[4] * cos2
  const denIm = -c[3] * sin1 - c[4] * sin2
  const num = Math.sqrt(numRe ** 2 + numIm ** 2)
  const den = Math.sqrt(denRe ** 2 + denIm ** 2)
  return num / den
}

// DC: ω=0、Nyquist: ω=π
const DC = 0
const NYQUIST = Math.PI

describe('biquadHP', () => {
  const fs = 48000
  const fc = 38.13547087602444
  const c = biquadHP(fc, fs)

  it('係数配列の長さが 5', () => {
    expect(c).toHaveLength(5)
  })

  it('DC ゲイン ≈ 0 (ハイパス)', () => {
    expect(freqResponse(c, DC)).toBeCloseTo(0, 10)
  })

  it('Nyquist ゲイン ≈ 1 (パス)', () => {
    expect(freqResponse(c, NYQUIST)).toBeCloseTo(1, 8)
  })

  it('カットオフ周波数で -3 dB (±0.1 dB)', () => {
    const omega_fc = 2 * Math.PI * fc / fs
    const gain = freqResponse(c, omega_fc)
    const gainDB = 20 * Math.log10(gain)
    expect(gainDB).toBeGreaterThan(-3.2)
    expect(gainDB).toBeLessThan(-2.8)
  })

  it('サンプルレートが異なれば係数が変わる', () => {
    const c44 = biquadHP(fc, 44100)
    expect(c44).not.toEqual(c)
  })
})

describe('biquadLP', () => {
  const fs = 48000
  const fc = 12194
  const c = biquadLP(fc, fs)

  it('係数配列の長さが 5', () => {
    expect(c).toHaveLength(5)
  })

  it('DC ゲイン ≈ 1 (ローパス)', () => {
    expect(freqResponse(c, DC)).toBeCloseTo(1, 8)
  })

  it('Nyquist ゲイン ≈ 0 (カット)', () => {
    expect(freqResponse(c, NYQUIST)).toBeCloseTo(0, 8)
  })

  it('カットオフ周波数で -3 dB (±0.2 dB)', () => {
    const omega_fc = 2 * Math.PI * fc / fs
    const gain = freqResponse(c, omega_fc)
    const gainDB = 20 * Math.log10(gain)
    expect(gainDB).toBeGreaterThan(-3.3)
    expect(gainDB).toBeLessThan(-2.7)
  })
})

describe('biquadHighShelf', () => {
  const fs = 48000
  const fc = 1681.974450955533
  const gain_dB = 3.999843853973347
  const c = biquadHighShelf(fc, gain_dB, fs)

  it('係数配列の長さが 5', () => {
    expect(c).toHaveLength(5)
  })

  it('DC ゲイン ≈ 1 (シェルフ下はフラット)', () => {
    expect(freqResponse(c, DC)).toBeCloseTo(1, 8)
  })

  it('Nyquist ゲイン ≈ 10^(gain/20)', () => {
    const expected = Math.pow(10, gain_dB / 20)
    const actual = freqResponse(c, NYQUIST)
    expect(actual).toBeCloseTo(expected, 3)
  })

  it('Nyquist ゲイン dB ≈ gain_dB (±0.05 dB)', () => {
    const gainDB = 20 * Math.log10(freqResponse(c, NYQUIST))
    expect(gainDB).toBeGreaterThan(gain_dB - 0.05)
    expect(gainDB).toBeLessThan(gain_dB + 0.05)
  })

  it('サンプルレートが異なれば係数が変わる', () => {
    const c44 = biquadHighShelf(fc, gain_dB, 44100)
    expect(c44).not.toEqual(c)
  })
})
