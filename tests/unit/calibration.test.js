import { describe, it, expect, beforeEach, vi } from 'vitest'

// localStorage のスタブ — テストごとにリセット
let storage = {}
vi.stubGlobal('localStorage', {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = v },
  removeItem: (k) => { delete storage[k] },
})

// スタブが有効な状態で import
const { getOffset, setOffset, applyOffset } = await import('../../src/audio/calibration.js')

describe('calibration', () => {
  beforeEach(() => { storage = {} })

  it('getOffset: ストレージ未設定時は 0', () => {
    expect(getOffset()).toBe(0)
  })

  it('setOffset: dbsplActual - dbfsMeasured を返す', () => {
    const result = setOffset(-30, 94)
    expect(result).toBeCloseTo(124, 10)
  })

  it('setOffset: localStorage に永続化される', () => {
    setOffset(-30, 94)
    expect(getOffset()).toBeCloseTo(124, 10)
  })

  it('applyOffset: dBFS に offset を加算', () => {
    setOffset(-30, 94)   // offset = 124
    expect(applyOffset(-30)).toBeCloseTo(94, 10)
  })

  it('applyOffset: offset=0 のときは dBFS そのまま', () => {
    // storage 空 → offset=0
    expect(applyOffset(-10)).toBeCloseTo(-10, 10)
  })

  it('setOffset: 上書き可能', () => {
    setOffset(-30, 94)   // offset=124
    setOffset(-20, 80)   // offset=100
    expect(getOffset()).toBeCloseTo(100, 10)
  })

  it('負の SPL ターゲットも正しく計算', () => {
    setOffset(-10, -20)  // offset=-10
    expect(getOffset()).toBeCloseTo(-10, 10)
    expect(applyOffset(-10)).toBeCloseTo(-20, 10)
  })
})
