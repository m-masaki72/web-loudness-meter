import { describe, it, expect } from 'vitest'

// LUFS 式の孤立テスト（フィルタ不使用）
const GATE_ABSOLUTE_DB = -70
const GATE_RELATIVE_LU = -10
const lufs = (ms) => -0.691 + 10 * Math.log10(ms + 1e-10)

describe('LUFS 計算式', () => {
  it('MS=0 → ≈ -100.691 (フロア)', () => {
    expect(lufs(0)).toBeCloseTo(-0.691 + 10 * Math.log10(1e-10), 10)
  })

  it('MS=1 → ≈ -0.691 (0 dBFS フルスケール)', () => {
    expect(lufs(1)).toBeCloseTo(-0.691, 5)
  })

  it('既知の MS で既知の LUFS 値', () => {
    // -23 LUFS → MS = 10^((-23+0.691)/10) ≈ 5.887e-3
    const targetLUFS = -23
    const ms = Math.pow(10, (targetLUFS + 0.691) / 10)
    expect(lufs(ms)).toBeCloseTo(targetLUFS, 5)
  })
})

describe('絶対ゲート閾値', () => {
  const absGate = Math.pow(10, (GATE_ABSOLUTE_DB + 0.691) / 10)

  it('閾値は正の数', () => {
    expect(absGate).toBeGreaterThan(0)
  })

  it('閾値に対応する LUFS ≈ -70 (±0.01 dB)', () => {
    expect(Math.abs(lufs(absGate) - GATE_ABSOLUTE_DB)).toBeLessThan(0.01)
  })

  it('MS が閾値以下のブロックは無視される', () => {
    let ungatedCount = 0
    const blocks = [absGate * 0.5, absGate * 0.1, 0]
    for (const ms of blocks) {
      if (ms > absGate) ungatedCount++
    }
    expect(ungatedCount).toBe(0)
  })

  it('MS が閾値超えのブロックはカウントされる', () => {
    let ungatedCount = 0
    const blocks = [absGate * 2, absGate * 10, 1]
    for (const ms of blocks) {
      if (ms > absGate) ungatedCount++
    }
    expect(ungatedCount).toBe(3)
  })
})

describe('相対ゲート', () => {
  it('ungatedLUFS から -10 LU の相対ゲートを計算', () => {
    const ungatedLUFS = -3.25
    const relGate = Math.pow(10, (ungatedLUFS + GATE_RELATIVE_LU + 0.691) / 10)
    // relGate に対応する LUFS ≈ -13.25
    expect(lufs(relGate)).toBeCloseTo(ungatedLUFS + GATE_RELATIVE_LU, 4)
  })

  it('ブロックなしのとき lufsI = -Infinity', () => {
    // ungatedCount=0 の条件
    const ungatedCount = 0
    const lufsI = ungatedCount > 0 ? -0.691 + 10 * Math.log10(1) : -Infinity
    expect(lufsI).toBe(-Infinity)
  })
})
