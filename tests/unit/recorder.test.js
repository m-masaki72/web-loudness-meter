import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// MediaRecorder モック
class MockMediaRecorder extends EventTarget {
  constructor(stream, opts) {
    super()
    this.stream = stream
    this.mimeType = opts?.mimeType ?? ''
    this.state = 'inactive'
    this._chunks = []
  }
  start(timeslice) {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    // 非同期でstopイベントを発火（実際のMediaRecorderの動作を模倣）
    setTimeout(() => this.dispatchEvent(new Event('stop')), 0)
  }
}
MockMediaRecorder.isTypeSupported = vi.fn()

// Node環境ではEventTargetが使えるのでそのまま利用
// Blobのモック（Node.jsにはBlobがあるが念のため）
class MockBlob {
  constructor(chunks, opts) {
    this.chunks = chunks
    this.type = opts?.type ?? ''
    this.size = chunks.reduce((s, c) => s + (c.size ?? 0), 0)
  }
}

class MockFile {
  constructor(chunks, name, opts) {
    this.name = name
    this.type = opts?.type ?? ''
    this.size = 0
  }
}

// document.createElement のモック
function makeClickableAnchor() {
  const a = { href: '', download: '', click: vi.fn() }
  return a
}

describe('selectMimeType()', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('audio/webm;codecs=opus が対応なら第1候補を返す', async () => {
    MockMediaRecorder.isTypeSupported = vi.fn(t => t === 'audio/webm;codecs=opus')
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    // selectMimeType は内部関数なので AudioRecorder の mimeType で間接確認
    const rec = new AudioRecorder({})
    expect(rec.recorder.mimeType).toBe('audio/webm;codecs=opus')
  })

  it('第1不対応・第2対応なら audio/webm を使用する', async () => {
    MockMediaRecorder.isTypeSupported = vi.fn(t => t === 'audio/webm')
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    const rec = new AudioRecorder({})
    expect(rec.recorder.mimeType).toBe('audio/webm')
  })

  it('全不対応なら空のオプションでMediaRecorderを生成する', async () => {
    MockMediaRecorder.isTypeSupported = vi.fn(() => false)
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    const rec = new AudioRecorder({})
    // mimeTypeオプションなしで生成されるため mimeType は ''
    expect(rec.recorder.mimeType).toBe('')
  })
})

describe('AudioRecorder', () => {
  beforeEach(() => {
    MockMediaRecorder.isTypeSupported = vi.fn(t => t === 'audio/webm;codecs=opus')
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('start() で state が recording になる', async () => {
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    const rec = new AudioRecorder({})
    rec.start()
    expect(rec.isRecording).toBe(true)
  })

  it('isRecording が recorder.state に連動する', async () => {
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    const rec = new AudioRecorder({})
    expect(rec.isRecording).toBe(false)
    rec.start()
    expect(rec.isRecording).toBe(true)
  })

  it('録音中の二重 start() は無視される', async () => {
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    const rec = new AudioRecorder({})
    rec.start()
    const startSpy = vi.spyOn(rec.recorder, 'start')
    rec.start()  // 2回目は無視されるはず
    expect(startSpy).not.toHaveBeenCalled()
  })

  it('stop() が録音中でなければ即座に Blob を resolve する', async () => {
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    vi.stubGlobal('Blob', MockBlob)
    const rec = new AudioRecorder({})
    // start()を呼ばずにstop()
    const blob = await rec.stop()
    expect(blob).toBeDefined()
  })

  it('stop() が録音中なら stop イベント後に Blob を resolve する', async () => {
    const { AudioRecorder } = await import('../../src/audio/recorder.js')
    vi.stubGlobal('Blob', MockBlob)
    const rec = new AudioRecorder({})
    rec.start()
    expect(rec.isRecording).toBe(true)
    const blob = await rec.stop()
    expect(blob).toBeDefined()
    expect(rec.isRecording).toBe(false)
  })
})

describe('exportBlob() — Web Share API / <a download> フォールバック', () => {
  let mockAnchor

  beforeEach(() => {
    MockMediaRecorder.isTypeSupported = vi.fn(() => false)
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    vi.stubGlobal('File', MockFile)
    vi.stubGlobal('Blob', MockBlob)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })

    mockAnchor = makeClickableAnchor()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => mockAnchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  it('navigator.canShare が true なら navigator.share を呼ぶ', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      canShare: vi.fn(() => true),
      share: shareMock,
    })
    const { exportBlob } = await import('../../src/audio/recorder.js')
    const blob = new MockBlob([], { type: 'audio/webm' })
    await exportBlob(blob, 'test.webm')
    expect(shareMock).toHaveBeenCalled()
  })

  it('AbortError は無視される（エラーにならない）', async () => {
    const abortError = new Error('User cancelled')
    abortError.name = 'AbortError'
    vi.stubGlobal('navigator', {
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(abortError),
    })
    const { exportBlob } = await import('../../src/audio/recorder.js')
    const blob = new MockBlob([], { type: 'audio/webm' })
    // AbortErrorでも throw しないこと
    await expect(exportBlob(blob, 'test.webm')).resolves.not.toThrow()
  })

  it('share 非 AbortError 失敗時は <a download> フォールバックに移行する', async () => {
    const networkError = new Error('Network error')
    networkError.name = 'NetworkError'
    vi.stubGlobal('navigator', {
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(networkError),
    })
    const { exportBlob } = await import('../../src/audio/recorder.js')
    const blob = new MockBlob([], { type: 'audio/webm' })
    await exportBlob(blob, 'test.webm')
    expect(mockAnchor.click).toHaveBeenCalled()
  })

  it('canShare が false なら <a download> を作成してクリックする', async () => {
    vi.stubGlobal('navigator', { canShare: undefined })
    const { exportBlob } = await import('../../src/audio/recorder.js')
    const blob = new MockBlob([], { type: 'audio/webm' })
    await exportBlob(blob, 'test.webm')
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(mockAnchor.download).toBe('test.webm')
  })

  it('<a download> のデフォルトファイル名は recording.webm', async () => {
    vi.stubGlobal('navigator', { canShare: undefined })
    const { exportBlob } = await import('../../src/audio/recorder.js')
    const blob = new MockBlob([], { type: 'audio/webm' })
    await exportBlob(blob)
    expect(mockAnchor.download).toBe('recording.webm')
  })
})
