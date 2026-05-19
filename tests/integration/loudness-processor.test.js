import { describe, it, expect, beforeEach } from 'vitest'
import '../../src/audio/worklet/loudness-processor.js'

// setup.js でスタブ済みの registerProcessor からクラスを取得
const LoudnessProcessor = globalThis.__registeredProcessors['loudness-processor']

// 無音ブロック生成
function silence() { return [[new Float32Array(128)]] }

// サイン波ブロック生成 (blockIndex で位相を継続させる)
function sineBlock(freq, amp, fs, blockIndex) {
  const block = new Float32Array(128)
  for (let i = 0; i < 128; i++) {
    block[i] = amp * Math.sin(2 * Math.PI * freq * (blockIndex * 128 + i) / fs)
  }
  return [[block]]
}

// processor を生成してメッセージをキャプチャできる状態にする
function makeProc(fs = 48000) {
  const proc = new LoudnessProcessor()
  const messages = []
  proc.port.postMessage = (msg) => messages.push(msg)
  proc._init(fs)
  return { proc, messages }
}

// N ブロック分のサイン波を流して最後のメッセージを返す
function runSine(proc, messages, freq, amp, fs, nBlocks) {
  for (let b = 0; b < nBlocks; b++) {
    proc.process(sineBlock(freq, amp, fs, b))
  }
  return messages[messages.length - 1]
}

// N ブロック分の無音を流して最後のメッセージを返す
function runSilence(proc, messages, nBlocks) {
  for (let b = 0; b < nBlocks; b++) proc.process(silence())
  return messages[messages.length - 1]
}

describe('LoudnessProcessor — 基本動作', () => {
  it('process() は true を返す', () => {
    const { proc } = makeProc()
    expect(proc.process(sineBlock(1000, 1, 48000, 0))).toBe(true)
  })

  it('_init 前に process() してもメッセージを送らない', () => {
    const proc = new LoudnessProcessor()
    const messages = []
    proc.port.postMessage = (msg) => messages.push(msg)
    proc.process(sineBlock(1000, 1, 48000, 0))
    expect(messages).toHaveLength(0)
  })

  it('_init 後は _ready = true', () => {
    const { proc } = makeProc()
    expect(proc._ready).toBe(true)
  })

  it('空 input でクラッシュしない', () => {
    const { proc } = makeProc()
    expect(() => proc.process([[]])).not.toThrow()
  })

  it('メッセージに必要なキーがすべて含まれる', () => {
    const { proc, messages } = makeProc()
    proc.process(sineBlock(1000, 1, 48000, 0))
    const msg = messages[0]
    expect(msg).toHaveProperty('dbfs')
    expect(msg).toHaveProperty('dba')
    expect(msg).toHaveProperty('dbc')
    expect(msg).toHaveProperty('lufsM')
    expect(msg).toHaveProperty('lufsS')
    expect(msg).toHaveProperty('lufsI')
  })
})

describe('LoudnessProcessor — 無音', () => {
  it('lufsM は非常に低い (<-90)', () => {
    const { proc, messages } = makeProc()
    const msg = runSilence(proc, messages, 375) // 1s @ 48kHz
    expect(msg.lufsM).toBeLessThan(-90)
  })

  it('lufsI は絶対ゲートにより -Infinity', () => {
    const { proc, messages } = makeProc()
    const msg = runSilence(proc, messages, 375)
    expect(msg.lufsI).toBe(-Infinity)
  })

  it('dbfs は負値 (フロア)', () => {
    const { proc, messages } = makeProc()
    const msg = runSilence(proc, messages, 375)
    expect(msg.dbfs).toBeLessThan(-100)
  })
})

describe('LoudnessProcessor — 0 dBFS 1 kHz サイン波 (5秒)', () => {
  // K-weighting: 1 kHz で +0.45 dB のため lufsM ≈ -3.25 LU
  // raw dBFS = 20*log10(1/√2) ≈ -3.01 dBFS だが 128サンプル境界で若干ずれる
  const FS = 48000
  const nBlocks = 1875  // 5s

  it('lufsM が収束して [-3.40, -3.15] に入る', () => {
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 1000, 1.0, FS, nBlocks)
    expect(msg.lufsM).toBeGreaterThan(-3.40)
    expect(msg.lufsM).toBeLessThan(-3.15)
  })

  it('lufsS が収束して [-3.40, -3.15] に入る', () => {
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 1000, 1.0, FS, nBlocks)
    expect(msg.lufsS).toBeGreaterThan(-3.40)
    expect(msg.lufsS).toBeLessThan(-3.15)
  })

  it('lufsI が収束して [-3.40, -3.15] に入る', () => {
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 1000, 1.0, FS, nBlocks)
    expect(msg.lufsI).toBeGreaterThan(-3.40)
    expect(msg.lufsI).toBeLessThan(-3.15)
  })

  it('dBFS が [-3.15, -2.99] に入る (サイン波 RMS = 1/√2)', () => {
    // 128サンプルブロック境界で RMS が厳密に 1/√2 にならないため ±0.1 dB を許容
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 1000, 1.0, FS, nBlocks)
    expect(msg.dbfs).toBeGreaterThan(-3.15)
    expect(msg.dbfs).toBeLessThan(-2.99)
  })
})

describe('LoudnessProcessor — -23 LUFS 参照信号 (5秒)', () => {
  // K-weighting 補正済み振幅: amp = sqrt(2 * target_ms / k_gain^2) ≈ 0.10292
  // k_gain @ 1kHz, 48kHz ≈ 1.05328 (+0.451 dB)
  const FS = 48000
  const K_GAIN_1K = 1.0532826961259134  // 実測値
  const TARGET_MS = Math.pow(10, (-23 + 0.691) / 10)
  const AMP = Math.sqrt(2 * TARGET_MS / (K_GAIN_1K ** 2))
  const nBlocks = 1875

  it('lufsM が [-23.3, -22.7] に入る (±0.3 LU 許容)', () => {
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 1000, AMP, FS, nBlocks)
    expect(msg.lufsM).toBeGreaterThan(-23.3)
    expect(msg.lufsM).toBeLessThan(-22.7)
  })

  it('lufsI が [-23.3, -22.7] に入る', () => {
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 1000, AMP, FS, nBlocks)
    expect(msg.lufsI).toBeGreaterThan(-23.3)
    expect(msg.lufsI).toBeLessThan(-22.7)
  })
})

describe('LoudnessProcessor — 44100 Hz', () => {
  it('44100 Hz でも lufsM が合理的な値 (<0) を返す', () => {
    const FS = 44100
    const { proc, messages } = makeProc(FS)
    // ブロック数: 5s @ 44100 Hz
    const nBlocks = Math.ceil(5 * FS / 128)
    const msg = runSine(proc, messages, 1000, 1.0, FS, nBlocks)
    expect(msg.lufsM).toBeLessThan(0)
    expect(isFinite(msg.lufsM)).toBe(true)
  })
})
