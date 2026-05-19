import workletCode from './worklet/loudness-processor.js?raw'

export async function initAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      channelCount: 1,
    },
    video: false,
  })

  const ctx = new AudioContext()

  // Safari: ユーザーアクション後にresumeが必要
  if (ctx.state === 'suspended') await ctx.resume()

  // Blob URLでロード — サーバ不要、file://でも動作
  const blob = new Blob([workletCode], { type: 'application/javascript' })
  const blobUrl = URL.createObjectURL(blob)
  await ctx.audioWorklet.addModule(blobUrl)
  URL.revokeObjectURL(blobUrl)

  const source    = ctx.createMediaStreamSource(stream)
  const analyser  = ctx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.3

  const workletNode = new AudioWorkletNode(ctx, 'loudness-processor')
  workletNode.port.postMessage({ type: 'init', sampleRate: ctx.sampleRate })

  // 分岐接続（どちらも destinationには繋がない → スピーカー出力なし）
  source.connect(analyser)
  source.connect(workletNode)

  return { ctx, stream, source, analyser, workletNode }
}

export function stopAudio({ ctx, stream }) {
  stream?.getTracks().forEach(t => t.stop())
  ctx?.close().catch(() => {})
}
