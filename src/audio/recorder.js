function selectMimeType() {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''  // ブラウザのデフォルトに委ねる
}

export class AudioRecorder {
  constructor(stream) {
    const mimeType = selectMimeType()
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    this.chunks   = []
    this.recorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data) }
  }

  start() {
    if (this.isRecording) return
    this.chunks = []
    this.recorder.start(100)
  }

  stop() {
    if (!this.isRecording) return Promise.resolve(new Blob(this.chunks, { type: this.recorder.mimeType }))
    return new Promise(resolve => {
      const onStop = () => {
        this.recorder.removeEventListener('stop', onStop)
        resolve(new Blob(this.chunks, { type: this.recorder.mimeType }))
      }
      this.recorder.addEventListener('stop', onStop)
      this.recorder.stop()
    })
  }

  get isRecording() { return this.recorder.state === 'recording' }
}

export async function exportBlob(blob, filename = 'recording.webm') {
  const file = new File([blob], filename, { type: blob.type })

  // Web Share API（iOS対応）
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if (err.name === 'AbortError') return  // ユーザーがキャンセル — エラーではない
      console.warn('Web Share failed, falling back to download:', err)
    }
  }

  // <a> ダウンロード fallback
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename
  a.click()
  // ファイルサイズに応じてタイムアウトを伸ばす（1MB あたり 1 秒、最低 10 秒）
  const ms = Math.max(10000, blob.size / (1024 * 1024) * 1000)
  setTimeout(() => URL.revokeObjectURL(url), ms)
}
