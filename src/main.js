import { initAudio, stopAudio } from './audio/mic-capture.js'
import { AnalyserReader }        from './audio/analyser.js'
import { AudioRecorder, exportBlob } from './audio/recorder.js'
import { getOffset, setOffset, applyOffset } from './audio/calibration.js'
import { Oscilloscope }          from './ui/oscilloscope.js'
import { BarMeter }              from './ui/bar-meter.js'
import { AnalogMeter }           from './ui/analog-meter.js'
import { WakeLockManager }       from './ui/wake-lock.js'

// --- Service Worker 登録（HTTPSまたはlocalhostのみ） ---
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

// --- DOM ---
const btnStart    = document.getElementById('btn-start')
const btnRec      = document.getElementById('btn-rec')
const btnStop     = document.getElementById('btn-stop')
const btnCal      = document.getElementById('btn-calibrate')
const calPanel    = document.getElementById('calibration-panel')
const calCurrent  = document.getElementById('cal-current')
const calInput    = document.getElementById('cal-input')
const calSave     = document.getElementById('cal-save')
const calCancel   = document.getElementById('cal-cancel')
const iosGuide    = document.getElementById('ios-guide')
const iosClose    = document.getElementById('ios-guide-close')
const wakeLockEl  = document.getElementById('wake-lock-indicator')

const valDbfs  = document.getElementById('val-dbfs')
const valDba   = document.getElementById('val-dba')
const valLufsM = document.getElementById('val-lufs-m')
const valLufsI = document.getElementById('val-lufs-i')

// --- Canvas UI ---
const scopeCanvas  = document.getElementById('oscilloscope')
const barCanvas    = document.getElementById('bar-meter')
const analogCanvas = document.getElementById('analog-meter')

// Canvas高さをCSSで設定
scopeCanvas.style.height  = '100px'
barCanvas.style.height    = '130px'
analogCanvas.style.height = '120px'

const scope  = new Oscilloscope(scopeCanvas)
const barMeter = new BarMeter(barCanvas)
const analog = new AnalogMeter(analogCanvas)
const wakeLock = new WakeLockManager(wakeLockEl)

// --- 状態 ---
let audioCtx = null
let analyserReader = null
let workletNode    = null
let recorder       = null
let stream         = null
let running        = false
let rafId          = null

// workletからの最新値
let latest = { dbfs: -Infinity, dba: -Infinity, dbc: -Infinity, lufsM: -Infinity, lufsS: -Infinity, lufsI: -Infinity }

// --- フォーマット ---
function fmt(v) {
  if (!isFinite(v) || v < -90) return '---.-'
  return v.toFixed(1)
}

function applyWarnClass(el, v) {
  el.classList.toggle('warn', v > -12 && v <= -3)
  el.classList.toggle('clip', v > -3)
}

// --- 描画ループ ---
function renderLoop() {
  if (!running) return
  rafId = requestAnimationFrame(renderLoop)

  analyserReader.read()
  const waveform = analyserReader.buf

  scope.draw(waveform)

  const rawDbfs = analyserReader.getDBFS()
  barMeter.update(rawDbfs, latest.dba, latest.lufsI)
  barMeter.draw()

  analog.setValue(rawDbfs)
  analog.draw()

  // デジタル表示（calibrationオフセット適用済み）
  const dispDbfs = applyOffset(rawDbfs)
  const dispDba  = applyOffset(latest.dba)

  valDbfs.textContent  = fmt(dispDbfs)
  valDba.textContent   = fmt(dispDba)
  valLufsM.textContent = fmt(latest.lufsM)
  valLufsI.textContent = fmt(latest.lufsI)

  applyWarnClass(valDbfs,  rawDbfs)
  applyWarnClass(valDba,   latest.dba)
  applyWarnClass(valLufsI, latest.lufsI)
}

// --- 開始 ---
btnStart.addEventListener('click', async () => {
  try {
    const result = await initAudio()
    audioCtx      = result.ctx
    stream        = result.stream
    analyserReader = new AnalyserReader(result.analyser)
    workletNode   = result.workletNode
    recorder      = new AudioRecorder(stream)

    workletNode.port.onmessage = (e) => { latest = e.data }

    running = true
    btnStart.disabled = true
    btnRec.disabled   = false
    btnStop.disabled  = false
    document.getElementById('panel').classList.remove('recording')

    await wakeLock.request()

    renderLoop()

    // iOS案内（一度だけ）
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS && !localStorage.getItem('ios-guide-shown')) {
      iosGuide.classList.remove('hidden')
      localStorage.setItem('ios-guide-shown', '1')
    }
  } catch (err) {
    alert('マイクのアクセスに失敗しましたわ: ' + err.message)
  }
})

// --- 録音 ---
btnRec.addEventListener('click', () => {
  if (!recorder) return
  recorder.start()
  document.getElementById('panel').classList.add('recording')
  btnRec.disabled = true
})

// --- 停止 ---
btnStop.addEventListener('click', async () => {
  running = false
  cancelAnimationFrame(rafId)
  wakeLock.release()

  if (recorder?.isRecording) {
    const blob = await recorder.stop()
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm'
    await exportBlob(blob, `recording-${ts}.${ext}`)
  }

  stopAudio({ ctx: audioCtx, stream })
  audioCtx = null; stream = null; recorder = null

  // UI リセット
  latest = { dbfs: -Infinity, dba: -Infinity, dbc: -Infinity, lufsM: -Infinity, lufsS: -Infinity, lufsI: -Infinity }
  valDbfs.textContent = valDba.textContent = valLufsM.textContent = valLufsI.textContent = '---.-'
  ;[valDbfs, valDba, valLufsM, valLufsI].forEach(el => { el.classList.remove('warn','clip') })

  btnStart.disabled = false
  btnRec.disabled   = true
  btnStop.disabled  = true
  document.getElementById('panel').classList.remove('recording')

  scope.draw(null)
  barMeter.update(-Infinity, -Infinity, -Infinity)
  barMeter.draw()
})

// --- キャリブレーション ---
btnCal.addEventListener('click', () => {
  calCurrent.textContent = analyserReader
    ? analyserReader.getDBFS().toFixed(1)
    : '---'
  calPanel.classList.toggle('hidden')
})

calSave.addEventListener('click', () => {
  const measured = analyserReader?.getDBFS() ?? 0
  const actual   = parseFloat(calInput.value)
  if (!isNaN(actual)) setOffset(measured, actual)
  calPanel.classList.add('hidden')
})

calCancel.addEventListener('click', () => calPanel.classList.add('hidden'))

// --- iOS案内 ---
iosClose.addEventListener('click', () => iosGuide.classList.add('hidden'))

// --- 初期描画（アイドル状態） ---
scope.draw(null)
barMeter.update(-Infinity, -Infinity, -Infinity)
barMeter.draw()
analog.draw()
