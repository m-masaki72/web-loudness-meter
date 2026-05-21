/**
 * テスト用WAVファイルを生成するスクリプト
 * 出力: tests/e2e/fixtures/sine_1k.wav
 * 仕様: 1kHz サイン波、48000Hz、1ch、16bit PCM、5秒、amplitude=0.7（約-3.1dBFS）
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputDir = join(__dirname, '..', 'tests', 'e2e', 'fixtures')
const outputFile = join(outputDir, 'sine_1k.wav')

const SAMPLE_RATE = 48000
const NUM_CHANNELS = 1
const BITS_PER_SAMPLE = 16
const FREQ = 1000
const AMPLITUDE = 0.7  // -3.1 dBFS
const DURATION = 5     // 秒

const numSamples = SAMPLE_RATE * DURATION
const dataSize = numSamples * NUM_CHANNELS * (BITS_PER_SAMPLE / 8)
const headerSize = 44
const fileSize = headerSize + dataSize

const buf = Buffer.alloc(fileSize)
let offset = 0

// RIFF チャンク
buf.write('RIFF', offset); offset += 4
buf.writeUInt32LE(fileSize - 8, offset); offset += 4
buf.write('WAVE', offset); offset += 4

// fmt チャンク
buf.write('fmt ', offset); offset += 4
buf.writeUInt32LE(16, offset); offset += 4               // チャンクサイズ
buf.writeUInt16LE(1, offset); offset += 2                // PCM形式
buf.writeUInt16LE(NUM_CHANNELS, offset); offset += 2
buf.writeUInt32LE(SAMPLE_RATE, offset); offset += 4
buf.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), offset); offset += 4  // バイトレート
buf.writeUInt16LE(NUM_CHANNELS * (BITS_PER_SAMPLE / 8), offset); offset += 2  // ブロックアライン
buf.writeUInt16LE(BITS_PER_SAMPLE, offset); offset += 2

// data チャンク
buf.write('data', offset); offset += 4
buf.writeUInt32LE(dataSize, offset); offset += 4

// サンプルデータ（1kHz サイン波）
const MAX_VAL = 32767
for (let i = 0; i < numSamples; i++) {
  const sample = Math.round(AMPLITUDE * MAX_VAL * Math.sin(2 * Math.PI * FREQ * i / SAMPLE_RATE))
  buf.writeInt16LE(sample, offset)
  offset += 2
}

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputFile, buf)
console.log(`Generated: ${outputFile}`)
console.log(`  ${DURATION}s, ${FREQ}Hz, ${SAMPLE_RATE}Hz, ${BITS_PER_SAMPLE}bit, amplitude=${AMPLITUDE}`)
