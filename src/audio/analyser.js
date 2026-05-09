export class AnalyserReader {
  constructor(analyserNode) {
    this.node = analyserNode
    this.buf  = new Float32Array(analyserNode.fftSize)
  }

  read() {
    this.node.getFloatTimeDomainData(this.buf)
    return this.buf
  }

  getRMS() {
    const buf = this.buf
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    return Math.sqrt(sum / buf.length)
  }

  getDBFS() {
    return 20 * Math.log10(Math.max(this.getRMS(), 1e-10))
  }

  getFrequencies() {
    if (!this._freqBuf) this._freqBuf = new Float32Array(this.node.frequencyBinCount)
    this.node.getFloatFrequencyData(this._freqBuf)
    return this._freqBuf
  }
}
