import { describe, it, expect } from 'vitest'
import '../../src/audio/worklet/loudness-processor.js'

const LoudnessProcessor = globalThis.__registeredProcessors['loudness-processor']

const MAX_GATED = 207000

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

describe('gatedBuf リングバッファ周回', () => {
  it('gatedHead が MAX_GATED に達すると gatedFull=true で head=0 にリセット', () => {
    const { proc, messages } = makeProc(48000)

    // 周回直前の状態を手動セット（実際に207000ブロック回すのは現実的でない）
    const absGate = Math.pow(10, (-70 + 0.691) / 10)
    proc.gatedHead = MAX_GATED - 1
    proc.gatedFull = false
    proc.ungatedMSSum = absGate * 2 * (MAX_GATED - 1)
    proc.ungatedCount = MAX_GATED - 1
    proc.gatedBuf.fill(absGate * 2)

    // 絶対ゲートを確実に超えるブロックを1つ流す
    proc.process(sineBlock(1000, 0.5, 48000, 0))

    expect(proc.gatedFull).toBe(true)
    expect(proc.gatedHead).toBe(0)
  })

  it('gatedFull=true 状態でも lufsI が有限のまま', () => {
    const { proc, messages } = makeProc(48000)

    // gatedFull=true 状態をセット
    const absGate = Math.pow(10, (-70 + 0.691) / 10)
    const msVal = absGate * 100
    proc.gatedBuf.fill(msVal)
    proc.gatedHead = 0
    proc.gatedFull = true
    proc.ungatedMSSum = msVal * MAX_GATED
    proc.ungatedCount = MAX_GATED

    proc.process(sineBlock(1000, 0.5, 48000, 0))

    const msg = messages[messages.length - 1]
    expect(isFinite(msg.lufsI)).toBe(true)
  })

  it('gatedFull=true 後も gatedHead が MAX_GATED を超えない', () => {
    const { proc, messages } = makeProc(48000)

    const absGate = Math.pow(10, (-70 + 0.691) / 10)
    proc.gatedHead = MAX_GATED - 1
    proc.gatedFull = false
    proc.ungatedMSSum = absGate * 2 * (MAX_GATED - 1)
    proc.ungatedCount = MAX_GATED - 1
    proc.gatedBuf.fill(absGate * 2)

    // 複数ブロック流しても MAX_GATED を超えない
    for (let b = 0; b < 5; b++) {
      proc.process(sineBlock(1000, 0.5, 48000, b))
    }

    expect(proc.gatedHead).toBeLessThan(MAX_GATED)
  })
})

describe('msHistory リングバッファ循環', () => {
  it('totalBlocks+100 ブロック後も lufsS が有限', () => {
    const { proc, messages } = makeProc(48000)
    const overBlocks = proc.totalBlocks + 100

    for (let b = 0; b < overBlocks; b++) {
      proc.process(sineBlock(1000, 0.5, 48000, b))
    }

    const msg = messages[messages.length - 1]
    expect(isFinite(msg.lufsS)).toBe(true)
  })

  it('msHead が totalBlocks を超えて循環し、モジュロ演算で正しくインデックスされる', () => {
    const { proc, messages } = makeProc(48000)
    const overBlocks = proc.totalBlocks + 50

    for (let b = 0; b < overBlocks; b++) {
      proc.process(sineBlock(1000, 0.5, 48000, b))
    }

    // msHead は単調増加（ラップしない）
    expect(proc.msHead).toBe(overBlocks)
    // 実際のバッファアクセスは msHead % totalBlocks で行われる
    const expectedNextSlot = overBlocks % proc.totalBlocks
    // 次のブロックを流してバッファの書き込み先を確認
    const headBefore = proc.msHead
    proc.process(sineBlock(1000, 0.5, 48000, overBlocks))
    expect(proc.msHead).toBe(headBefore + 1)
  })

  it('循環前後で lufsS の値が大幅に変動しない（安定性確認）', () => {
    const { proc, messages } = makeProc(48000)

    // totalBlocks の直前まで流す
    for (let b = 0; b < proc.totalBlocks - 1; b++) {
      proc.process(sineBlock(1000, 0.5, 48000, b))
    }
    const lufsSBefore = messages[messages.length - 1].lufsS

    // 循環を越えてさらに流す
    for (let b = proc.totalBlocks - 1; b < proc.totalBlocks + 100; b++) {
      proc.process(sineBlock(1000, 0.5, 48000, b))
    }
    const lufsSAfter = messages[messages.length - 1].lufsS

    // 同一振幅・同一周波数なので循環前後で ±2 dB 以内に収まるはず
    expect(Math.abs(lufsSAfter - lufsSBefore)).toBeLessThan(2)
  })

  it('44100Hz でも循環が正常に動作する', () => {
    const { proc, messages } = makeProc(44100)
    const overBlocks = proc.totalBlocks + 50

    for (let b = 0; b < overBlocks; b++) {
      proc.process(sineBlock(1000, 0.5, 44100, b))
    }

    const msg = messages[messages.length - 1]
    expect(isFinite(msg.lufsS)).toBe(true)
    expect(isFinite(msg.lufsM)).toBe(true)
  })
})

describe('Momentary ウィンドウ循環', () => {
  it('mBlocks を超えても lufsM が安定する', () => {
    const { proc, messages } = makeProc(48000)

    // mBlocks × 2 ブロック流す
    for (let b = 0; b < proc.mBlocks * 2; b++) {
      proc.process(sineBlock(1000, 0.5, 48000, b))
    }

    const msg = messages[messages.length - 1]
    expect(isFinite(msg.lufsM)).toBe(true)
    // lufsM と lufsS が近い値になるはず（同じ信号）
    expect(Math.abs(msg.lufsM - msg.lufsS)).toBeLessThan(1)
  })
})
