import { initAudio, stopAudio } from './audio/mic-capture.js'
import { AnalyserReader }        from './audio/analyser.js'
import { AudioRecorder, exportBlob } from './audio/recorder.js'
import { getOffset, setOffset, applyOffset } from './audio/calibration.js'
import { openDB, saveSample, loadRecent, clearHistory } from './audio/history.js'
import { Oscilloscope }          from './ui/oscilloscope.js'
import { BarMeter }              from './ui/bar-meter.js'
import { AnalogMeter }           from './ui/analog-meter.js'
import { WakeLockManager }       from './ui/wake-lock.js'
import { SpectrumAnalyzer }      from './ui/spectrum.js'
import { HistoryGraph }          from './ui/history-graph.js'

// --- Service Worker 登録（HTTPSまたはlocalhostのみ） ---
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

// --- DOM ---
const btnStart    = document.getElementById('btn-start')
const btnRec      = document.getElementById('btn-rec')
const btnStop     = document.getElementById('btn-stop')
const btnCal      = document.getElementById('btn-calibrate')
const btnPeakRst   = document.getElementById('btn-peak-reset')
const btnSplToggle = document.getElementById('btn-spl-toggle')
const btnHistToggle = document.getElementById('btn-history-toggle')
const btnHistClear  = document.getElementById('btn-history-clear')
const btnHelp       = document.getElementById('btn-help')
const btnHelpClose  = document.getElementById('btn-help-close')
const helpOverlay   = document.getElementById('help-overlay')
const calPanel    = document.getElementById('calibration-panel')
const histPanel   = document.getElementById('history-panel')
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
const valLufsS = document.getElementById('val-lufs-s')
const valLufsI = document.getElementById('val-lufs-i')
const lblDbfs  = document.getElementById('lbl-dbfs')
const lblDba   = document.getElementById('lbl-dba')

// --- Canvas UI ---
const scopeCanvas    = document.getElementById('oscilloscope')
const barCanvas      = document.getElementById('bar-meter')
const analogCanvas   = document.getElementById('analog-meter')
const spectrumCanvas = document.getElementById('spectrum')
const histCanvas     = document.getElementById('history-graph')

scopeCanvas.style.height    = '100px'
barCanvas.style.height      = '130px'
analogCanvas.style.height   = '120px'
spectrumCanvas.style.height = '100px'

const scope    = new Oscilloscope(scopeCanvas)
const barMeter = new BarMeter(barCanvas)
const analog   = new AnalogMeter(analogCanvas)
const wakeLock = new WakeLockManager(wakeLockEl)
const spectrum = new SpectrumAnalyzer(spectrumCanvas)
const histGraph = new HistoryGraph(histCanvas)

// IndexedDB を事前に開いておく
openDB().catch(() => {})

// --- 状態 ---
let audioCtx = null
let analyserReader = null
let workletNode    = null
let recorder       = null
let stream         = null
let running        = false
let rafId          = null
let sampleInterval = null  // 履歴サンプリング用
let splMode        = false  // dBSPL表示モード

// workletからの最新値
let latest = { dba: -Infinity, lufsM: -Infinity, lufsS: -Infinity, lufsI: -Infinity }

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

  // スペクトラム
  const freqData = analyserReader.getFrequencies()
  spectrum.draw(freqData, audioCtx.sampleRate)

  // デジタル表示（splMode時はオフセット適用）
  const dispDbfs = splMode ? applyOffset(rawDbfs) : rawDbfs
  const dispDba  = splMode ? applyOffset(latest.dba) : latest.dba

  valDbfs.textContent  = fmt(dispDbfs)
  valDba.textContent   = fmt(dispDba)
  valLufsM.textContent = fmt(latest.lufsM)
  valLufsS.textContent = fmt(latest.lufsS)
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

    // 1秒ごとに履歴をサンプリング
    sampleInterval = setInterval(() => {
      const rawDbfs = analyserReader?.getDBFS() ?? -Infinity
      saveSample({
        dbfs:  rawDbfs,
        dba:   latest.dba,
        lufsM: latest.lufsM,
        lufsS: latest.lufsS,
        lufsI: latest.lufsI,
      }).catch(() => {})
    }, 1000)

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

  clearInterval(sampleInterval)
  sampleInterval = null

  if (recorder?.isRecording) {
    const blob = await recorder.stop()
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm'
    await exportBlob(blob, `recording-${ts}.${ext}`)
  }

  stopAudio({ ctx: audioCtx, stream })
  audioCtx = null; stream = null; recorder = null

  // UI リセット
  latest = { dba: -Infinity, lufsM: -Infinity, lufsS: -Infinity, lufsI: -Infinity }
  const resetEls = [valDbfs, valDba, valLufsM, valLufsS, valLufsI]
  resetEls.forEach(el => { el.textContent = '---.-'; el.classList.remove('warn', 'clip') })

  btnStart.disabled = false
  btnRec.disabled   = true
  btnStop.disabled  = true
  document.getElementById('panel').classList.remove('recording')

  scope.draw(null)
  barMeter.update(-Infinity, -Infinity, -Infinity)
  barMeter.draw()
  spectrum.draw(null, 48000)
})

// --- ピークリセット ---
btnPeakRst.addEventListener('click', () => {
  barMeter.resetPeaks()
})

// --- dBSPL トグル ---
btnSplToggle.addEventListener('click', () => {
  splMode = !splMode
  if (splMode) {
    btnSplToggle.textContent = 'dBSPL ON'
    btnSplToggle.classList.add('active')
    lblDbfs.textContent = 'dBSPL'
    lblDba.textContent  = 'dBSPL(A)'
  } else {
    btnSplToggle.textContent = 'dBSPL OFF'
    btnSplToggle.classList.remove('active')
    lblDbfs.textContent = 'dBFS'
    lblDba.textContent  = 'dBA'
  }
})

// --- 履歴トグル ---
btnHistToggle.addEventListener('click', async () => {
  const isHidden = histPanel.classList.toggle('hidden')
  if (!isHidden) {
    const samples = await loadRecent()
    histGraph.update(samples)
  }
})

// --- 履歴クリア ---
btnHistClear.addEventListener('click', async () => {
  await clearHistory()
  histGraph.update([])
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

// --- ヘルプ ---
btnHelp.addEventListener('click', () => helpOverlay.classList.remove('hidden'))
btnHelpClose.addEventListener('click', () => helpOverlay.classList.add('hidden'))
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) helpOverlay.classList.add('hidden')
})

// --- iOS案内 ---
iosClose.addEventListener('click', () => iosGuide.classList.add('hidden'))

// --- 初期描画（アイドル状態） ---
scope.draw(null)
barMeter.update(-Infinity, -Infinity, -Infinity)
barMeter.draw()
analog.draw()
spectrum.draw(null, 48000)
histPanel.classList.add('hidden')
