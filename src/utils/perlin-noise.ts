/**
 * Seeded 2D Perlin noise — no npm dependencies.
 * Used by terrain generation to produce deterministic heightmaps.
 */

/** Create a seeded 2D noise function. Same seed → same output. */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  // Build a permutation table from a simple LCG seeded PRNG
  const perm = new Uint8Array(512)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let s = seed | 0
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) | 0
    const j = ((s >>> 0) % (i + 1))
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  // 2D gradient vectors (12 directions)
  const grad = [
    [1,1],[-1,1],[1,-1],[-1,-1],
    [1,0],[-1,0],[0,1],[0,-1],
    [1,1],[-1,1],[1,-1],[-1,-1],
  ]

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number) => a + t * (b - a)
  const dot2 = (g: number[], x: number, y: number) => g[0] * x + g[1] * y

  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const u = fade(xf)
    const v = fade(yf)

    const aa = perm[perm[X] + Y] % 12
    const ab = perm[perm[X] + Y + 1] % 12
    const ba = perm[perm[X + 1] + Y] % 12
    const bb = perm[perm[X + 1] + Y + 1] % 12

    return lerp(
      lerp(dot2(grad[aa], xf, yf), dot2(grad[ba], xf - 1, yf), u),
      lerp(dot2(grad[ab], xf, yf - 1), dot2(grad[bb], xf - 1, yf - 1), u),
      v,
    )
  }
}

/** Fractal Brownian Motion — layers multiple octaves for natural-looking detail. */
export function fbm2D(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxAmp = 0
  for (let i = 0; i < octaves; i++) {
    value += noise(x * frequency, y * frequency) * amplitude
    maxAmp += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value / maxAmp // Normalize to roughly [-1, 1]
}
