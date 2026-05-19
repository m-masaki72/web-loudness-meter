import { initAudio, stopAudio } from './audio/mic-capture.js'
import { AnalyserReader }        from './audio/analyser.js'
import { AudioRecorder, exportBlob } from './audio/recorder.js'
import { getOffset, setOffset, applyOffset } from './audio/calibration.js'
import { openDB, saveSample, loadRecent, loadAll, clearHistory } from './audio/history.js'
import { Oscilloscope }          from './ui/oscilloscope.js'
import { BarMeter }              from './ui/bar-meter.js'
import { AnalogMeter }           from './ui/analog-meter.js'
import { WakeLockManager }       from './ui/wake-lock.js'
import { SpectrumAnalyzer }      from './ui/spectrum.js'
import { HistoryGraph }          from './ui/history-graph.js'

// --- Service Worker 登録 + 更新通知 ---
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          swUpdateBanner.classList.remove('hidden')
        }
      })
    })
  }).catch(() => {})
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
const swUpdateBanner  = document.getElementById('sw-update-banner')
const btnSwUpdate     = document.getElementById('btn-sw-update')
const btnSwDismiss    = document.getElementById('btn-sw-dismiss')
const installBanner   = document.getElementById('install-banner')
const btnInstall      = document.getElementById('btn-install')
const btnInstallDismiss = document.getElementById('btn-install-dismiss')
const panel           = document.getElementById('panel')
const btnModeToggle   = document.getElementById('btn-mode-toggle')
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
const noiseNeedle = document.getElementById('noise-needle')
const noiseLabel  = document.getElementById('noise-label')
const noiseNote   = document.getElementById('noise-note')

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

// --- 騒音レベルインジケーター ---
const NOISE_LEVELS = [
  { max: 35,  label: '🌙 深夜・無響室',   },
  { max: 45,  label: '📚 静かな図書館',   },
  { max: 55,  label: '🏠 静かな住宅街',   },
  { max: 65,  label: '💬 普通の会話',     },
  { max: 75,  label: '🍽️ にぎやかな飲食店', },
  { max: 85,  label: '🚗 幹線道路沿い',   },
  { max: 95,  label: '🏭 工事現場',       },
  { max: 110, label: '✈️ 飛行機エンジン近く', },
  { max: Infinity, label: '🚨 聴力障害の危険', },
]
const NOISE_BAR_MIN = 30
const NOISE_BAR_MAX = 110

function updateNoiseIndicator(db, isCalibrated) {
  if (!isFinite(db)) {
    noiseNeedle.style.left = '0%'
    noiseLabel.textContent = '---'
    noiseNote.textContent  = ''
    return
  }
  const pct = Math.max(0, Math.min(100,
    (db - NOISE_BAR_MIN) / (NOISE_BAR_MAX - NOISE_BAR_MIN) * 100
  ))
  noiseNeedle.style.left = pct + '%'
  const level = NOISE_LEVELS.find(l => db < l.max)
  noiseLabel.textContent = level?.label ?? '---'
  noiseNote.textContent  = isCalibrated ? '' : '※ 未キャリブレーション（参考値）'
}

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
let lastSampleRate = 48000  // spectrum.draw 停止時用
let uiMode = localStorage.getItem('ui-mode') || 'simple'

// workletからの最新値
let latest = { dba: -Infinity, lufsM: -Infinity, lufsS: -Infinity, lufsI: -Infinity }

// --- UI モード ---
function applyMode(mode) {
  uiMode = mode
  localStorage.setItem('ui-mode', mode)
  if (mode === 'simple') {
    panel.classList.add('simple-mode')
    btnModeToggle.textContent = 'EXPERT'
  } else {
    panel.classList.remove('simple-mode')
    btnModeToggle.textContent = 'SIMPLE'
  }
}
btnModeToggle.addEventListener('click', () => {
  applyMode(uiMode === 'simple' ? 'expert' : 'simple')
})

// --- フォーマット ---
function fmt(v) {
  if (!isFinite(v) || v < -90) return '---'
  return v.toFixed(1)
}

function applyWarnClass(el, v) {
  el.classList.toggle('warn', v > -12 && v <= -3)
  el.classList.toggle('clip', v > -3)
}

// --- 描画ループ ---
function renderLoop() {
  if (!running || !analyserReader) return
  rafId = requestAnimationFrame(renderLoop)

  analyserReader.read()
  const waveform = analyserReader.buf

  scope.draw(waveform)

  const rawDbfs = analyserReader.getDBFS()

  if (uiMode === 'expert') {
    barMeter.update(rawDbfs, latest.dba, latest.lufsI)
    barMeter.draw()
    analog.setValue(rawDbfs)
    analog.draw()
    const freqData = analyserReader.getFrequencies()
    spectrum.draw(freqData, audioCtx.sampleRate)
  }

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

  // 騒音レベルインジケーター（splMode なら補正済み値、未補正なら dBFS をそのまま）
  updateNoiseIndicator(dispDbfs, splMode)
}

// --- 開始 ---
btnStart.addEventListener('click', async () => {
  btnStart.disabled = true  // 連打防止（await前に無効化）
  try {
    const result = await initAudio()
    audioCtx      = result.ctx
    stream        = result.stream
    analyserReader = new AnalyserReader(result.analyser)
    workletNode   = result.workletNode
    recorder      = new AudioRecorder(stream)
    lastSampleRate = result.ctx.sampleRate

    workletNode.port.onmessage = (e) => { latest = e.data }

    running = true
    btnRec.disabled   = false
    btnStop.disabled  = false
    panel.classList.remove('recording')

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

    // iOS案内（一度だけ）— userAgent より Web Share API の files 対応で判定
    const isIOS = navigator.canShare && /iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent)
    if (isIOS && !localStorage.getItem('ios-guide-shown')) {
      iosGuide.classList.remove('hidden')
      localStorage.setItem('ios-guide-shown', '1')
    }
  } catch (err) {
    btnStart.disabled = false  // 失敗時は再試行可能に戻す
    alert('マイクのアクセスに失敗しましたわ: ' + err.message)
  }
})

// --- 録音 ---
btnRec.addEventListener('click', () => {
  if (!recorder) return
  recorder.start()
  panel.classList.add('recording')
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
    const d    = new Date()
    const ts   = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`
    const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm'
    try {
      await exportBlob(blob, `loudness-${ts}.${ext}`)
    } catch (err) {
      console.warn('録音ファイルの保存に失敗しました:', err)
      alert('録音ファイルの保存に失敗しました。')
    }
  }

  stopAudio({ ctx: audioCtx, stream })
  audioCtx = null; stream = null; recorder = null; analyserReader = null

  // UI リセット
  updateNoiseIndicator(-Infinity, false)
  latest = { dba: -Infinity, lufsM: -Infinity, lufsS: -Infinity, lufsI: -Infinity }
  const resetEls = [valDbfs, valDba, valLufsM, valLufsS, valLufsI]
  resetEls.forEach(el => { el.textContent = '---.-'; el.classList.remove('warn', 'clip') })

  btnStart.disabled = false
  btnRec.disabled   = true
  btnStop.disabled  = true
  panel.classList.remove('recording')

  scope.draw(null)
  if (uiMode === 'expert') {
    barMeter.update(-Infinity, -Infinity, -Infinity)
    barMeter.draw()
    analog.draw()
    spectrum.draw(null, lastSampleRate)
  }
})

// --- ピークリセット ---
btnPeakRst.addEventListener('click', () => {
  barMeter.resetPeaks()
  // 押下フィードバック（一瞬ハイライト）
  btnPeakRst.classList.add('active')
  setTimeout(() => btnPeakRst.classList.remove('active'), 150)
})

// --- dBSPL トグル ---
btnSplToggle.addEventListener('click', () => {
  splMode = !splMode
  btnSplToggle.setAttribute('aria-pressed', splMode)
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
let histRangeMin = 5  // 分 (0 = ALL)

async function refreshHistGraph() {
  const samples = histRangeMin === 0
    ? await loadAll()
    : await loadRecent(histRangeMin * 60 * 1000)
  histGraph.update(samples)
}

btnHistToggle.addEventListener('click', async () => {
  const isHidden = histPanel.classList.toggle('hidden')
  if (!isHidden) refreshHistGraph()
})

// --- 履歴時間範囲ボタン ---
document.querySelectorAll('.btn-range').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.btn-range').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    histRangeMin = Number(btn.dataset.range)
    refreshHistGraph()
  })
})

// --- 履歴クリア ---
btnHistClear.addEventListener('click', async () => {
  try {
    await clearHistory()
    histGraph.update([])
  } catch (err) {
    console.warn('履歴のクリアに失敗しました:', err)
  }
})

// --- キャリブレーション ---
btnCal.addEventListener('click', () => {
  if (!running || !analyserReader) {
    btnCal.classList.add('flash-disabled')
    setTimeout(() => btnCal.classList.remove('flash-disabled'), 300)
    return
  }
  calCurrent.textContent = analyserReader.getDBFS().toFixed(1)
  calPanel.classList.toggle('hidden')
})

calSave.addEventListener('click', () => {
  if (!running || !analyserReader) { calPanel.classList.add('hidden'); return }
  const measured = analyserReader.getDBFS()
  const actual   = parseFloat(calInput.value)
  const calError = document.getElementById('cal-error')
  if (isFinite(actual) && actual >= 0 && actual <= 140) {
    setOffset(measured, actual)
    calError.classList.add('hidden')
    calPanel.classList.add('hidden')
  } else {
    calError.classList.remove('hidden')
    calInput.focus()
  }
})

calCancel.addEventListener('click', () => {
  document.getElementById('cal-error').classList.add('hidden')
  calPanel.classList.add('hidden')
})

// --- ヘルプ ---
btnHelp.addEventListener('click', () => helpOverlay.classList.remove('hidden'))
btnHelpClose.addEventListener('click', () => helpOverlay.classList.add('hidden'))
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) helpOverlay.classList.add('hidden')
})

// --- iOS案内 ---
iosClose.addEventListener('click', () => iosGuide.classList.add('hidden'))

// --- SW 更新バナー ---
btnSwUpdate.addEventListener('click', async () => {
  swUpdateBanner.classList.add('hidden')
  const reg = await navigator.serviceWorker.getRegistration().catch(() => null)
  if (reg?.waiting) {
    reg.waiting.postMessage('SKIP_WAITING')
    const onController = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
      location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)
  }
})
btnSwDismiss.addEventListener('click', () => swUpdateBanner.classList.add('hidden'))

// --- インストールバナー ---
let _deferredInstallPrompt = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  _deferredInstallPrompt = e
  installBanner.classList.remove('hidden')
})
btnInstall.addEventListener('click', async () => {
  if (!_deferredInstallPrompt) return
  installBanner.classList.add('hidden')
  _deferredInstallPrompt.prompt()
  await _deferredInstallPrompt.userChoice
  _deferredInstallPrompt = null
})
btnInstallDismiss.addEventListener('click', () => installBanner.classList.add('hidden'))
window.addEventListener('appinstalled', () => installBanner.classList.add('hidden'))

// --- 初期描画（アイドル状態） ---
scope.draw(null)
barMeter.update(-Infinity, -Infinity, -Infinity)
barMeter.draw()
analog.draw()
spectrum.draw(null, lastSampleRate)
histPanel.classList.add('hidden')
applyMode(uiMode)
