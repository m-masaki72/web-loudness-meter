// AudioWorklet グローバルスタブ — Node/Vitest 環境で loudness-processor.js を import 可能にする

globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { postMessage: () => {}, onmessage: null }
  }
}

globalThis.__registeredProcessors = {}
globalThis.registerProcessor = (name, ctor) => {
  globalThis.__registeredProcessors[name] = ctor
}
