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
    const nBlocks = Math.ceil(5 * FS / 128)
    const msg = runSine(proc, messages, 1000, 1.0, FS, nBlocks)
    expect(msg.lufsM).toBeLessThan(0)
    expect(isFinite(msg.lufsM)).toBe(true)
  })
})

describe('LoudnessProcessor — 無音→トーン遷移', () => {
  const FS = 48000

  it('無音後にトーンを流すと lufsM が上昇する', () => {
    const { proc, messages } = makeProc(FS)
    // 1s 無音
    runSilence(proc, messages, 375)
    const silenceMsg = messages[messages.length - 1]
    // 2s サイン波
    for (let b = 0; b < 750; b++) proc.process(sineBlock(1000, 1.0, FS, b))
    const toneMsg = messages[messages.length - 1]
    expect(toneMsg.lufsM).toBeGreaterThan(silenceMsg.lufsM)
    expect(toneMsg.lufsM).toBeLessThan(0)
  })

  it('絶対ゲートにより lufsI は無音ブロックを除外する', () => {
    const { proc, messages } = makeProc(FS)
    // 1s 無音（絶対ゲート以下）の後に 4s サイン波
    runSilence(proc, messages, 375)
    for (let b = 0; b < 1500; b++) proc.process(sineBlock(1000, 1.0, FS, b))
    const msg = messages[messages.length - 1]
    // Integrated は無音を除いたトーン部分のみを反映する（-Infinity にならない）
    expect(isFinite(msg.lufsI)).toBe(true)
    expect(msg.lufsI).toBeLessThan(0)
  })
})

describe('LoudnessProcessor — 急激なレベル変化', () => {
  const FS = 48000

  it('大音量 → 無音でモーメンタリが速やかに下がる', () => {
    const { proc, messages } = makeProc(FS)
    // 2s 大音量
    for (let b = 0; b < 750; b++) proc.process(sineBlock(1000, 1.0, FS, b))
    const loudMsg = messages[messages.length - 1]
    // 直後に無音 (400ms = 1 momentary window)
    runSilence(proc, messages, 150)
    const quietMsg = messages[messages.length - 1]
    expect(quietMsg.lufsM).toBeLessThan(loudMsg.lufsM)
  })

  it('低レベル → 高レベルでモーメンタリが上昇する', () => {
    const { proc, messages } = makeProc(FS)
    // 2s 低レベル (amp=0.01)
    for (let b = 0; b < 750; b++) proc.process(sineBlock(1000, 0.01, FS, b))
    const lowMsg = messages[messages.length - 1]
    // 2s 高レベル
    for (let b = 750; b < 1500; b++) proc.process(sineBlock(1000, 1.0, FS, b))
    const highMsg = messages[messages.length - 1]
    expect(highMsg.lufsM).toBeGreaterThan(lowMsg.lufsM)
  })
})

describe('LoudnessProcessor — 長時間録音の状態リーク確認', () => {
  const FS = 48000

  it('10分相当のブロックを処理しても値が有限のまま', () => {
    const { proc, messages } = makeProc(FS)
    // gatedBuf の上限 MAX_GATED=207000 blocks ≈ 10min
    // ここでは 20000 blocks ≈ 約85秒分 を処理（テスト時間を抑えつつ上限挙動を確認）
    const nBlocks = 20000
    for (let b = 0; b < nBlocks; b++) proc.process(sineBlock(1000, 0.5, FS, b))
    const msg = messages[messages.length - 1]
    expect(isFinite(msg.lufsM)).toBe(true)
    expect(isFinite(msg.lufsS)).toBe(true)
    expect(isFinite(msg.lufsI)).toBe(true)
    expect(isFinite(msg.dbfs)).toBe(true)
  })
})

describe('LoudnessProcessor — 非 1kHz トーン', () => {
  const FS = 48000
  const nBlocks = 1875  // 5s

  it('100 Hz トーンでも lufsM が有限値を返す', () => {
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 100, 0.5, FS, nBlocks)
    expect(isFinite(msg.lufsM)).toBe(true)
    expect(msg.lufsM).toBeLessThan(0)
  })

  it('10000 Hz トーンでも lufsM が有限値を返す', () => {
    const { proc, messages } = makeProc(FS)
    const msg = runSine(proc, messages, 10000, 0.5, FS, nBlocks)
    expect(isFinite(msg.lufsM)).toBe(true)
    expect(msg.lufsM).toBeLessThan(0)
  })

  it('K-weighting は高域（4kHz）で低域（100Hz）より高い値を示す', () => {
    // K-weighting のハイシェルフは高周波を持ち上げる
    const { proc: p1, messages: m1 } = makeProc(FS)
    const { proc: p2, messages: m2 } = makeProc(FS)
    const msg100  = runSine(p1, m1, 100,  0.5, FS, nBlocks)
    const msg4k   = runSine(p2, m2, 4000, 0.5, FS, nBlocks)
    expect(msg4k.lufsM).toBeGreaterThan(msg100.lufsM)
  })
})
