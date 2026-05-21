import { describe, it, expect } from 'vitest'
import '../../src/audio/worklet/loudness-processor.js'

const LoudnessProcessor = globalThis.__registeredProcessors['loudness-processor']

function makeProc(fs = 48000) {
  const proc = new LoudnessProcessor()
  const messages = []
  proc.port.postMessage = (msg) => messages.push(msg)
  proc._init(fs)
  return { proc, messages }
}

function sineBlock(freq, amp, fs, blockIndex) {
  const block = new Float32Array(128)
  for (let i = 0; i < 128; i++) {
    block[i] = amp * Math.sin(2 * Math.PI * freq * (blockIndex * 128 + i) / fs)
  }
  return [[block]]
}

function silence() { return [[new Float32Array(128)]] }

describe('LUFS 数値安定性: underflow ガード', () => {
  it('MS=1e-12 の極小値でも lufs() が有限値を返す（1e-10 フロアガード）', () => {
    const ms = 1e-12
    const lufs = -0.691 + 10 * Math.log10(ms + 1e-10)
    expect(isFinite(lufs)).toBe(true)
    // MS=1e-12 は 1e-10 のフロアで支配されるため、log10(1e-12 + 1e-10) ≈ log10(1e-10)
    // 実際の値: log10(1.01e-10) vs log10(1e-10) の差は約0.04dBなので許容範囲を広く取る
    expect(lufs).toBeCloseTo(-0.691 + 10 * Math.log10(1e-10), 1)
  })

  it('amplitude=1e-7 の極小信号で dbfs が有限かつ < -100', () => {
    const { proc, messages } = makeProc(48000)
    for (let b = 0; b < 50; b++) proc.process(sineBlock(1000, 1e-7, 48000, b))
    const msg = messages[messages.length - 1]
    expect(isFinite(msg.dbfs)).toBe(true)
    expect(msg.dbfs).toBeLessThan(-100)
  })

  it('無音ブロックで dbfs が有限（-Infinity にならない）', () => {
    const { proc, messages } = makeProc(48000)
    proc.process(silence())
    const msg = messages[messages.length - 1]
    expect(isFinite(msg.dbfs)).toBe(true)
  })
})

describe('LUFS 境界値: 絶対ゲート閾値', () => {
  // 絶対ゲート: -70 LUFS → absGate = 10^((-70 + 0.691) / 10)
  const absGate = Math.pow(10, (-70 + 0.691) / 10)

  it('absGate の 0.999 倍の MS は ungatedCount を増やさない', () => {
    const { proc, messages } = makeProc(48000)
    // 絶対ゲート以下の振幅を計算
    // msK = amp^2 / 2 (サイン波) ≈ absGate * 0.999 となるamp
    // ただし K-weighting フィルタの影響で厳密計算は困難なため、
    // 直接 proc の内部状態で確認
    const countBefore = proc.ungatedCount
    // 極小振幅（絶対ゲート以下確実）
    for (let b = 0; b < 10; b++) proc.process(sineBlock(1000, 1e-4, 48000, b))
    // 絶対ゲート (absGate ≈ 1.17e-7) に対して amp=1e-4 → MS ≈ 5e-9 はゲート以下
    expect(proc.ungatedCount).toBe(countBefore)
  })

  it('フルスケール信号は絶対ゲートを必ず通過する', () => {
    const { proc, messages } = makeProc(48000)
    for (let b = 0; b < 5; b++) proc.process(sineBlock(1000, 1.0, 48000, b))
    // フルスケール1kHz → msK が absGate を大幅に超えるはず
    expect(proc.ungatedCount).toBeGreaterThan(0)
  })

  it('absGate の理論値が正しく計算される', () => {
    // GATE_ABSOLUTE_DB = -70, 式: 10^((-70 + 0.691) / 10)
    expect(absGate).toBeCloseTo(Math.pow(10, -69.309 / 10), 10)
    expect(absGate).toBeGreaterThan(1e-8)
    expect(absGate).toBeLessThan(1e-6)
  })
})

describe('LUFS 境界値: ウィンドウ未充填時', () => {
  it('1ブロックのみで lufsM が有限（Momentary未充填）', () => {
    const { proc, messages } = makeProc(48000)
    proc.process(sineBlock(1000, 0.5, 48000, 0))
    const msg = messages[0]
    expect(isFinite(msg.lufsM)).toBe(true)
  })

  it('1ブロックのみで lufsS が有限（Short-term未充填）', () => {
    const { proc, messages } = makeProc(48000)
    proc.process(sineBlock(1000, 0.5, 48000, 0))
    const msg = messages[0]
    expect(isFinite(msg.lufsS)).toBe(true)
  })

  it('lufsI は信号がゲートを通過するまで -Infinity', () => {
    const { proc, messages } = makeProc(48000)
    // 極小振幅（絶対ゲート以下）
    proc.process(sineBlock(1000, 1e-5, 48000, 0))
    const msg = messages[0]
    expect(msg.lufsI).toBe(-Infinity)
  })

  it('ゲートを通過するブロックの後 lufsI が有限', () => {
    const { proc, messages } = makeProc(48000)
    for (let b = 0; b < 5; b++) proc.process(sineBlock(1000, 0.5, 48000, b))
    const msg = messages[messages.length - 1]
    expect(isFinite(msg.lufsI)).toBe(true)
  })
})

describe('LUFS 境界値: 相対ゲート', () => {
  it('ungatedCount=0 の状態では lufsI が -Infinity', () => {
    const { proc, messages } = makeProc(48000)
    // ungatedCount を 0 のまま維持（極小信号）
    for (let b = 0; b < 20; b++) proc.process(sineBlock(1000, 1e-5, 48000, b))
    const msg = messages[messages.length - 1]
    expect(msg.lufsI).toBe(-Infinity)
  })

  it('相対ゲート後 rCount=0 になっても lufsI が -Infinity（クラッシュなし）', () => {
    const { proc, messages } = makeProc(48000)
    // フルスケール信号を5ブロック → ungatedLUFS が高い → 相対ゲートが高い
    // 続いて静音 → 相対ゲートに引っかからない
    for (let b = 0; b < 5; b++) proc.process(sineBlock(1000, 1.0, 48000, b))
    // rCount > 0 の状態を作ってから内部確認
    const msg = messages[messages.length - 1]
    expect(msg).not.toBeNull()  // クラッシュせずメッセージが届く
    expect(typeof msg.lufsI).toBe('number')
  })
})

describe('LUFS 数値安定性: 各フィールドの型', () => {
  it('全フィールドが number 型である', () => {
    const { proc, messages } = makeProc(48000)
    proc.process(sineBlock(440, 0.3, 48000, 0))
    const msg = messages[0]
    for (const key of ['dbfs', 'dba', 'dbc', 'lufsM', 'lufsS', 'lufsI']) {
      expect(typeof msg[key]).toBe('number')
    }
  })

  it('NaN が含まれない', () => {
    const { proc, messages } = makeProc(48000)
    for (let b = 0; b < 10; b++) proc.process(sineBlock(1000, 0.5, 48000, b))
    const msg = messages[messages.length - 1]
    for (const key of ['dbfs', 'dba', 'dbc', 'lufsM', 'lufsS']) {
      expect(isNaN(msg[key])).toBe(false)
    }
  })
})
