export function detectSampleRate(audioContext) {
  return audioContext.sampleRate
}

// 双一次変換（アナログ→デジタル係数変換）
export function bilinearTransform(b_a, b_b, b_c, a_a, a_b, a_c, fs) {
  const f = 2 * fs
  const b0 =  b_a * f*f + b_b * f + b_c
  const b1 = -2 * b_a * f*f           + 2 * b_c
  const b2 =  b_a * f*f - b_b * f + b_c
  const a0 =  a_a * f*f + a_b * f + a_c
  const a1 = -2 * a_a * f*f           + 2 * a_c
  const a2 =  a_a * f*f - a_b * f + a_c
  return [b0/a0, b1/a0, b2/a0, a1/a0, a2/a0]
}
