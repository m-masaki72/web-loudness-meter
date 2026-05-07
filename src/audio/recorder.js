export class AudioRecorder {
  constructor(stream) {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4'
    this.recorder = new MediaRecorder(stream, { mimeType })
    this.chunks   = []
    this.recorder.ondataavailable = e => { if (e.data.size > 0) this.chunks.push(e.data) }
  }

  start() {
    this.chunks = []
    this.recorder.start(100)
  }

  stop() {
    return new Promise(resolve => {
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder.mimeType })
        resolve(blob)
      }
      this.recorder.stop()
    })
  }

  get isRecording() { return this.recorder.state === 'recording' }
}

export async function exportBlob(blob, filename = 'recording.webm') {
  // Web Share API（iOS対応）
  if (navigator.canShare?.({ files: [new File([blob], filename, { type: blob.type })] })) {
    try {
      await navigator.share({ files: [new File([blob], filename, { type: blob.type })] })
      return
    } catch { /* fallthrough */ }
  }
  // <a>ダウンロード fallback
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
