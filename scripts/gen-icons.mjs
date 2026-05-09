import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/icons')

await mkdir(outDir, { recursive: true })

// CRT風 VU メーターアイコン SVG
function makeSvg(size) {
  const s = size
  const cx = s / 2
  const cy = s * 0.62
  const R = s * 0.36

  // 針の角度（-30dB 付近 = ほぼ左端 + 少し動いた位置）
  const angle = -Math.PI * 0.55
  const nx = cx + Math.cos(angle) * R * 0.88
  const ny = cy + Math.sin(angle) * R * 0.88

  // アーク（目盛弧）: 左端〜右端 (200° 範囲)
  const arcStartAngle = Math.PI * 0.78  // ANGLE_MIN 方向
  const arcEndAngle   = Math.PI * 0.22  // ANGLE_MAX 方向
  const ax1 = cx + Math.cos(Math.PI + arcStartAngle) * R
  const ay1 = cy + Math.sin(Math.PI + arcStartAngle) * R
  const ax2 = cx + Math.cos(Math.PI + arcEndAngle) * R
  const ay2 = cy + Math.sin(Math.PI + arcEndAngle) * R

  const strokeW = Math.max(1, s * 0.015)
  const needleW = Math.max(1, s * 0.018)
  const fontSize = Math.round(s * 0.08)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${s * 0.15}" fill="#0d0d0d"/>
  <!-- スキャンライン風グラデーション -->
  <rect width="${s}" height="${s}" rx="${s * 0.15}" fill="url(#scan)" opacity="0.08"/>
  <defs>
    <radialGradient id="bg" cx="50%" cy="62%" r="60%">
      <stop offset="0%" stop-color="#2a2a2a"/>
      <stop offset="100%" stop-color="#0d0d0d"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${s * 0.012}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="needleGlow">
      <feGaussianBlur stdDeviation="${s * 0.008}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- 盤面 -->
  <circle cx="${cx}" cy="${cy}" r="${R * 1.08}" fill="url(#bg)"/>
  <!-- アーク目盛 -->
  <path d="M ${ax1} ${ay1} A ${R} ${R} 0 0 1 ${ax2} ${ay2}"
        stroke="#00ff88" stroke-width="${strokeW}" fill="none" opacity="0.3" filter="url(#glow)"/>
  <!-- クリップゾーン（右端赤） -->
  <path d="M ${cx + Math.cos(-Math.PI * 0.30) * R} ${cy + Math.sin(-Math.PI * 0.30) * R}
           A ${R} ${R} 0 0 1 ${ax2} ${ay2}"
        stroke="#ff5533" stroke-width="${strokeW * 1.5}" fill="none" opacity="0.7"/>
  <!-- 針 -->
  <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"
        stroke="#eeeeee" stroke-width="${needleW}" stroke-linecap="round" filter="url(#needleGlow)"/>
  <!-- 針軸 -->
  <circle cx="${cx}" cy="${cy}" r="${s * 0.03}" fill="#cccccc"/>
  <!-- VU ラベル -->
  <text x="${cx}" y="${cy - R * 0.42}" text-anchor="middle"
        font-family="Courier New, monospace" font-size="${fontSize}" fill="#00ff88" opacity="0.8">VU</text>
</svg>`
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(makeSvg(size)))
    .png()
    .toFile(`${outDir}/icon-${size}.png`)
  console.log(`✓ icon-${size}.png`)
}
