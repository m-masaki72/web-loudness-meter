export class WakeLockManager {
  constructor(indicatorEl) {
    this._lock = null
    this._indicator = indicatorEl
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this._active) this.request()
    })
    this._active = false
  }

  async request() {
    if (!('wakeLock' in navigator)) return
    try {
      this._lock = await navigator.wakeLock.request('screen')
      this._active = true
      this._lock.addEventListener('release', () => {
        this._active = false
        this._setIndicator(false)
      })
      this._setIndicator(true)
    } catch (err) {
      console.warn('Wake lock request failed:', err)
      this._setIndicator(false)
    }
  }

  release() {
    this._active = false
    this._lock?.release()
    this._lock = null
    this._setIndicator(false)
  }

  _setIndicator(on) {
    if (!this._indicator) return
    this._indicator.classList.toggle('on',  on)
    this._indicator.classList.toggle('off', !on)
  }
}
