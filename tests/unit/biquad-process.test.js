import { describe, it, expect } from 'vitest'
import { BiquadState, biquadHP, biquadLP, cascade } from '../../src/audio/dsp.js'

describe('BiquadState.process()', () => {
  it('インパルス応答の y[0] === b0 (= c[0])', () => {
    const c = biquadHP(38.135, 48000)
    const state = new BiquadState()
    const y0 = state.process(1, c)
    expect(y0).toBeCloseTo(c[0], 14)
  })

  it('HP ステップ応答が 0 に収束 (10000 サンプル後)', () => {
    const c = biquadHP(38.135, 48000)
    const state = new BiquadState()
    let y = 0
    for (let i = 0; i < 10000; i++) y = state.process(1, c)
    expect(Math.abs(y)).toBeLessThan(1e-10)
  })

  it('LP ステップ応答が 1 に収束 (10000 サンプル後)', () => {
    const c = biquadLP(12194, 48000)
    const state = new BiquadState()
    let y = 0
    for (let i = 0; i < 10000; i++) y = state.process(1, c)
    expect(y).toBeCloseTo(1, 8)
  })

  it('インスタンスは独立した状態を持つ', () => {
    const c = biquadHP(100, 48000)
    const s1 = new BiquadState()
    const s2 = new BiquadState()
    s1.process(1, c)
    s1.process(0.5, c)
    // s2 は別状態
    const y2_0 = s2.process(1, c)
    expect(y2_0).toBeCloseTo(c[0], 14)
  })

  it('状態リセット: 新しいインスタンスは同じ y[0] を返す', () => {
    const c = biquadHP(38.135, 48000)
    const s1 = new BiquadState()
    const y1 = s1.process(1, c)
    const s2 = new BiquadState()
    const y2 = s2.process(1, c)
    expect(y1).toBe(y2)
  })
})

describe('cascade()', () => {
  it('2段 HP をカスケードしてもインパルス y[0] = b0_1 * b0_2', () => {
    const c1 = biquadHP(20.6, 48000)
    const c2 = biquadHP(107.7, 48000)
    const states = [new BiquadState(), new BiquadState()]
    const y = cascade(1, [c1, c2], states)
    expect(y).toBeCloseTo(c1[0] * c2[0], 12)
  })

  it('空のカスケードは入力をそのまま返す', () => {
    expect(cascade(0.5, [], [])).toBe(0.5)
  })
})
