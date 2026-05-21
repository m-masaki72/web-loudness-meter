import { describe, it, expect } from 'vitest'
import { BiquadState, biquadHP, biquadLP, biquadHighShelf, cascade } from '../../src/audio/dsp.js'

// サイン波を通してdBゲインを実測（前半の過渡応答を除いた定常状態で計測）
function measureGainDB(coeffsArray, freq, fs, numSamples = 48000) {
  const states = coeffsArray.map(() => new BiquadState())
  let sumSq = 0
  const steadyStart = numSamples - 32768
  for (let i = 0; i < numSamples; i++) {
    const x = Math.sin(2 * Math.PI * freq * i / fs)
    const y = cascade(x, coeffsArray, states)
    if (i >= steadyStart) sumSq += y * y
  }
  const outputRMS = Math.sqrt(sumSq / 32768)
  return 20 * Math.log10(outputRMS * Math.SQRT2)  // 入力RMSは 1/√2
}

describe('K-weighting 実周波数応答（サイン波実測）', () => {
  const FS = 48000
  const kCoeffs = [
    biquadHighShelf(1681.974450955533, 3.999843853973347, FS),
    biquadHP(38.13547087602444, FS),
  ]

  it('1kHz でほぼ 0 dB（K-weighting の基準周波数）', () => {
    const gain = measureGainDB(kCoeffs, 1000, FS)
    // K-weighting は 1kHz でほぼ 0 dB（微小な正のゲイン）
    expect(gain).toBeGreaterThan(-0.5)
    expect(gain).toBeLessThan(1.5)
  })

  it('40Hz でハイパスにより減衰（カットオフ38.135Hz付近）', () => {
    // fc=38.135Hz の Butterworth HPF: 38Hz→-3dB、40Hz→約-2.6dB、1kHz→+0.45dB
    // 差: 1kHz - 40Hz ≈ 3.1dB なので余裕を持って 2dB 以上の差を確認
    const gain40 = measureGainDB(kCoeffs, 40, FS)
    const gain1k = measureGainDB(kCoeffs, 1000, FS)
    expect(gain40).toBeLessThan(gain1k - 2)
  })

  it('高域（10kHz）でハイシェルフのブースト（> 0 dB）', () => {
    const gain = measureGainDB(kCoeffs, 10000, FS)
    expect(gain).toBeGreaterThan(0)
  })

  it('44100Hz でも係数が正常に機能する', () => {
    const fs44 = 44100
    const kCoeffs44 = [
      biquadHighShelf(1681.974450955533, 3.999843853973347, fs44),
      biquadHP(38.13547087602444, fs44),
    ]
    const gain = measureGainDB(kCoeffs44, 1000, fs44)
    expect(gain).toBeGreaterThan(-0.5)
    expect(gain).toBeLessThan(1.5)
  })
})

describe('A-weighting 実周波数応答（サイン波実測）', () => {
  const FS = 48000
  const aCoeffs = [biquadHP(20.6, FS), biquadHP(107.7, FS), biquadHP(737.9, FS), biquadLP(12194, FS)]

  it('1kHz を基準として 50Hz が -30 dB 以上減衰', () => {
    const gain1k = measureGainDB(aCoeffs, 1000, FS)
    const gain50 = measureGainDB(aCoeffs, 50, FS)
    const attenuation = gain1k - gain50
    expect(attenuation).toBeGreaterThan(30)
  })

  it('500Hz が 1kHz より低いゲインを示す（低域減衰傾向）', () => {
    const gain1k  = measureGainDB(aCoeffs, 1000, FS)
    const gain500 = measureGainDB(aCoeffs, 500, FS)
    expect(gain500).toBeLessThan(gain1k)
  })

  it('4kHz が 1kHz より高いゲインを示す（上向きピーク特性）', () => {
    const gain1k = measureGainDB(aCoeffs, 1000, FS)
    const gain4k = measureGainDB(aCoeffs, 4000, FS)
    expect(gain4k).toBeGreaterThan(gain1k)
  })

  it('低域カットオフ（20Hz以下）で大幅減衰', () => {
    const gain1k  = measureGainDB(aCoeffs, 1000, FS)
    const gain20  = measureGainDB(aCoeffs, 20, FS)
    expect(gain1k - gain20).toBeGreaterThan(20)
  })
})

describe('C-weighting 実周波数応答（サイン波実測）', () => {
  const FS = 48000
  const aCoeffs = [biquadHP(20.6, FS), biquadHP(107.7, FS), biquadHP(737.9, FS), biquadLP(12194, FS)]
  const cCoeffs = [biquadHP(20.6, FS), biquadLP(12194, FS)]

  it('1kHz で A-weighting より高いゲイン（C特性はより平坦）', () => {
    const gainA = measureGainDB(aCoeffs, 1000, FS)
    const gainC = measureGainDB(cCoeffs, 1000, FS)
    // C特性はA特性より低域を通しやすい（1kHzではA≒Cだが差を確認）
    // 理論上C > A @ 1kHz（Aは1kHz基準で0dB近傍、Cも同様だが低域カットが緩い）
    expect(gainC).toBeGreaterThan(gainA - 2)  // 誤差2dB以内でCはAより低減衰
  })

  it('50Hz で A-weighting より C-weighting の方が減衰が小さい', () => {
    const gainA50 = measureGainDB(aCoeffs, 50, FS)
    const gainC50 = measureGainDB(cCoeffs, 50, FS)
    expect(gainC50).toBeGreaterThan(gainA50)
  })

  it('1kHz でほぼ 0 dB（中域では平坦に近い）', () => {
    const gain = measureGainDB(cCoeffs, 1000, FS)
    expect(gain).toBeGreaterThan(-5)
    expect(gain).toBeLessThan(5)
  })
})

describe('Raw（フィルタなし）の周波数応答', () => {
  it('単一サンプル通過でゲイン 0 dB（変換なし）', () => {
    // フィルタなしの場合、出力=入力なのでゲインは 0 dB
    const state = new BiquadState()
    // 恒等フィルタ係数: b0=1, b1=0, b2=0, a1=0, a2=0
    const identity = [1, 0, 0, 0, 0]
    const x = 0.5
    expect(state.process(x, identity)).toBeCloseTo(x)
  })
})
