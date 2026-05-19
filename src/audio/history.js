const DB_NAME = 'loudness-history'
const STORE_NAME = 'samples'
const DB_VERSION = 1

let db = null

export async function openDB() {
  if (db) return db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const store = e.target.result.createObjectStore(STORE_NAME, { keyPath: 'timestamp' })
      store.createIndex('timestamp', 'timestamp')
    }
    req.onsuccess = (e) => { db = e.target.result; resolve(db) }
    req.onerror   = () => reject(req.error)
  })
}

export async function saveSample(data) {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add({ timestamp: Date.now(), ...data })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

// 直近 limitMs ミリ秒のサンプルを返す（デフォルト5分）
export async function loadRecent(limitMs = 5 * 60 * 1000) {
  const d = await openDB()
  const since = Date.now() - limitMs
  return new Promise((resolve, reject) => {
    const range = IDBKeyRange.lowerBound(since)
    const req = d.transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .getAll(range)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function loadAll() {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function clearHistory() {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}
