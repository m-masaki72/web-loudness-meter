import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'

// テストごとにフレッシュな IDB インスタンスと history モジュールを使う
async function loadHistory() {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('IDBKeyRange', IDBKeyRange)
  return import('../../src/audio/history.js')
}

describe('saveSample / loadRecent', () => {
  it('保存したサンプルが loadRecent で取得できる', async () => {
    const { openDB, saveSample, loadRecent } = await loadHistory()
    await openDB()
    await saveSample({ dbfs: -20, dba: -22, lufsM: -18, lufsS: -19, lufsI: -20 })
    const samples = await loadRecent()
    expect(samples).toHaveLength(1)
    expect(samples[0].dbfs).toBe(-20)
  })

  it('複数サンプルを保存して全件取得できる', async () => {
    const { openDB, saveSample, loadRecent } = await loadHistory()
    const db = await openDB()
    // キー重複を避けるため手動で異なる timestamp を設定
    const now = Date.now()
    const store = (ts, data) => new Promise((res, rej) => {
      const tx = db.transaction('samples', 'readwrite')
      tx.objectStore('samples').add({ timestamp: ts, ...data })
      tx.oncomplete = res; tx.onerror = () => rej(tx.error)
    })
    await store(now,     { dbfs: -10, dba: -12, lufsM: -8,  lufsS: -9,  lufsI: -10 })
    await store(now + 1, { dbfs: -15, dba: -17, lufsM: -13, lufsS: -14, lufsI: -15 })
    await store(now + 2, { dbfs: -20, dba: -22, lufsM: -18, lufsS: -19, lufsI: -20 })
    const samples = await loadRecent()
    expect(samples).toHaveLength(3)
  })

  it('timestamp フィールドが付与される', async () => {
    const { openDB, saveSample, loadRecent } = await loadHistory()
    await openDB()
    const before = Date.now()
    await saveSample({ dbfs: -30, dba: -32, lufsM: -28, lufsS: -29, lufsI: -30 })
    const after = Date.now()
    const [s] = await loadRecent()
    expect(s.timestamp).toBeGreaterThanOrEqual(before)
    expect(s.timestamp).toBeLessThanOrEqual(after)
  })

  it('limitMs より古いサンプルは返さない', async () => {
    const { openDB, saveSample, loadRecent } = await loadHistory()
    const db = await openDB()
    // 過去のサンプルを手動で挿入（1時間前）
    const oldTs = Date.now() - 60 * 60 * 1000
    await new Promise((resolve, reject) => {
      const tx = db.transaction('samples', 'readwrite')
      tx.objectStore('samples').add({ timestamp: oldTs, dbfs: -50, dba: -52, lufsM: -48, lufsS: -49, lufsI: -50 })
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    await saveSample({ dbfs: -20, dba: -22, lufsM: -18, lufsS: -19, lufsI: -20 })
    // デフォルト 5分 → 古いサンプルは除外
    const samples = await loadRecent(5 * 60 * 1000)
    expect(samples).toHaveLength(1)
    expect(samples[0].dbfs).toBe(-20)
  })

  it('データなしのとき空配列を返す', async () => {
    const { openDB, loadRecent } = await loadHistory()
    await openDB()
    const samples = await loadRecent()
    expect(samples).toEqual([])
  })
})

describe('loadAll', () => {
  it('全サンプルを時刻制限なしで返す', async () => {
    const { openDB, loadAll } = await loadHistory()
    const db = await openDB()
    const now = Date.now()
    const store = (ts, data) => new Promise((res, rej) => {
      const tx = db.transaction('samples', 'readwrite')
      tx.objectStore('samples').add({ timestamp: ts, ...data })
      tx.oncomplete = res; tx.onerror = () => rej(tx.error)
    })
    await store(now - 2 * 60 * 60 * 1000, { dbfs: -50, dba: -52, lufsM: -48, lufsS: -49, lufsI: -50 })
    await store(now,                       { dbfs: -20, dba: -22, lufsM: -18, lufsS: -19, lufsI: -20 })
    const samples = await loadAll()
    expect(samples).toHaveLength(2)
  })

  it('データなしのとき空配列を返す', async () => {
    const { openDB, loadAll } = await loadHistory()
    await openDB()
    expect(await loadAll()).toEqual([])
  })
})

describe('clearHistory', () => {
  it('clear 後は loadAll が空配列を返す', async () => {
    const { openDB, clearHistory, loadAll } = await loadHistory()
    const db = await openDB()
    const now = Date.now()
    const store = (ts, data) => new Promise((res, rej) => {
      const tx = db.transaction('samples', 'readwrite')
      tx.objectStore('samples').add({ timestamp: ts, ...data })
      tx.oncomplete = res; tx.onerror = () => rej(tx.error)
    })
    await store(now,     { dbfs: -20, dba: -22, lufsM: -18, lufsS: -19, lufsI: -20 })
    await store(now + 1, { dbfs: -15, dba: -17, lufsM: -13, lufsS: -14, lufsI: -15 })
    await clearHistory()
    expect(await loadAll()).toEqual([])
  })

  it('clear 後に新しいサンプルを保存できる', async () => {
    const { openDB, clearHistory, loadAll } = await loadHistory()
    const db = await openDB()
    const now = Date.now()
    const store = (ts, data) => new Promise((res, rej) => {
      const tx = db.transaction('samples', 'readwrite')
      tx.objectStore('samples').add({ timestamp: ts, ...data })
      tx.oncomplete = res; tx.onerror = () => rej(tx.error)
    })
    await store(now, { dbfs: -20, dba: -22, lufsM: -18, lufsS: -19, lufsI: -20 })
    await clearHistory()
    await store(now + 1, { dbfs: -10, dba: -12, lufsM: -8, lufsS: -9, lufsI: -10 })
    const samples = await loadAll()
    expect(samples).toHaveLength(1)
    expect(samples[0].dbfs).toBe(-10)
  })
})
