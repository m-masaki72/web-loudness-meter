const CACHE = 'loudness-meter-v3'

self.addEventListener('install', e => {
  // ルートだけ事前キャッシュ。JS/CSS はハッシュ付きなので fetch 時に動的キャッシュ
  e.waitUntil(caches.open(CACHE).then(c => c.add('./')))
  // skipWaiting しない — main.js からの SKIP_WAITING メッセージを待つ
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // ナビゲーション以外の GET のみキャッシュ対象
  if (e.request.method !== 'GET') return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 成功したらキャッシュに保存（opaque レスポンスは除く）
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        }
        return res
      })
      .catch(() => {
        // ネットワーク失敗時はキャッシュにフォールバック
        return caches.match(e.request).then(cached => {
          if (cached) return cached
          // ナビゲーションはルートのキャッシュで代替
          if (e.request.mode === 'navigate') return caches.match('./')
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// main.js から SKIP_WAITING を受け取ったら即時有効化
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})
