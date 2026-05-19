import { describe, it, expect, beforeEach } from 'vitest'
import { AnalyserReader } from '../../src/audio/analyser.js'

function makeNode(data) {
  return {
    fftSize: data.length,
    frequencyBinCount: data.length / 2,
    getFloatTimeDomainData(buf) { buf.set(data) },
    getFloatFrequencyData(buf) { buf.fill(-100) },
  }
}

describe('AnalyserReader.getRMS()', () => {
  it('全ゼロ → 0', () => {
    const node = makeNode(new Float32Array(2048).fill(0))
    const reader = new AnalyserReader(node)
    reader.read()
    expect(reader.getRMS()).toBe(0)
  })

  it('全 1.0 → 1.0', () => {
    const node = makeNode(new Float32Array(2048).fill(1))
    const reader = new AnalyserReader(node)
    reader.read()
    expect(reader.getRMS()).toBeCloseTo(1.0, 10)
  })

  it('定数 0.5 → 0.5', () => {
    const node = makeNode(new Float32Array(2048).fill(0.5))
    const reader = new AnalyserReader(node)
    reader.read()
    expect(reader.getRMS()).toBeCloseTo(0.5, 10)
  })

  it('交互 ±1 → 1.0 (RMS は符号に無依存)', () => {
    const data = new Float32Array(4)
    data[0] = 1; data[1] = -1; data[2] = 1; data[3] = -1
    const node = makeNode(data)
    const reader = new AnalyserReader(node)
    reader.read()
    expect(reader.getRMS()).toBeCloseTo(1.0, 10)
  })
})

describe('AnalyserReader.getDBFS()', () => {
  it('全ゼロ → フロア値 (isFinite)', () => {
    const node = makeNode(new Float32Array(2048).fill(0))
    const reader = new AnalyserReader(node)
    reader.read()
    const db = reader.getDBFS()
    expect(isFinite(db)).toBe(true)
    expect(db).toBeLessThan(-100)
  })

  it('全 1.0 → 0 dBFS', () => {
    const node = makeNode(new Float32Array(2048).fill(1))
    const reader = new AnalyserReader(node)
    reader.read()
    expect(reader.getDBFS()).toBeCloseTo(0, 5)
  })

  it('定数 0.5 → ≈ -6.02 dBFS', () => {
    const node = makeNode(new Float32Array(2048).fill(0.5))
    const reader = new AnalyserReader(node)
    reader.read()
    expect(reader.getDBFS()).toBeCloseTo(20 * Math.log10(0.5), 3)
  })

  it('NaN にならない', () => {
    const node = makeNode(new Float32Array(2048).fill(0))
    const reader = new AnalyserReader(node)
    reader.read()
    expect(isNaN(reader.getDBFS())).toBe(false)
  })
})

describe('AnalyserReader その他', () => {
  it('read() は内部 buf を返す', () => {
    const node = makeNode(new Float32Array(8).fill(0.3))
    const reader = new AnalyserReader(node)
    const buf = reader.read()
    expect(buf).toBe(reader.buf)
  })

  it('getFrequencies() は frequencyBinCount の長さを返す', () => {
    const node = makeNode(new Float32Array(2048).fill(0))
    const reader = new AnalyserReader(node)
    reader.read()
    const freq = reader.getFrequencies()
    expect(freq.length).toBe(node.frequencyBinCount)
  })

  it('getRMS は read() 時点のバッファを使う (再読み取りしない)', () => {
    const data = new Float32Array(8).fill(1.0)
    const node = makeNode(data)
    const reader = new AnalyserReader(node)
    reader.read()
    // node のデータを変えても getRMS は古いバッファの値を使う
    node.getFloatTimeDomainData = (buf) => buf.fill(0)
    expect(reader.getRMS()).toBeCloseTo(1.0, 10)
  })
})
