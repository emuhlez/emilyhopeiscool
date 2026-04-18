import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface GenieEffectProps {
  snapshot: string
  sourceRect: Rect
  onComplete: () => void
  duration?: number
}

/**
 * Canvas mesh-warp genie effect based on Harshil Shah's approach.
 *
 * Two overlapping sub-animations drive the deformation:
 *   1. Slide/shear (0 – 50 %): the bottom edges compress toward the dock icon
 *      width while the top stays fixed, creating the funnel.
 *   2. Translate (40 – 100 %): the entire window slides downward through the
 *      funnel and into the dock.
 *
 * Left and right edges follow quadratic-ease-in-out bezier curves so the
 * transition from wide (window) to narrow (dock) is a smooth S-curve rather
 * than a straight diagonal.
 *
 * Each horizontal strip is rendered as two affine-mapped triangles forming a
 * proper trapezoid, so there is no visible segmentation between strips.
 */

const ROWS = 50
const SLIDE_END = 0.5
const TRANSLATE_START = 0.4

function quadEaseInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function getDockTarget(): Rect {
  const el = document.querySelector('[data-genie-target]')
  if (el) {
    const r = el.getBoundingClientRect()
    return { x: r.left - 17, y: r.top, w: 34, h: r.height }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  return { x: vw / 2 - 17, y: vh - 50, w: 34, h: 24 }
}

/**
 * Draw a textured triangle by computing the unique affine transform that maps
 * three source image-pixel vertices to three destination screen-pixel vertices,
 * then clipping the canvas to the destination triangle and painting the image
 * through that transform.
 */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dpr: number,
  // Source triangle (image pixel coords)
  sx0: number, sy0: number,
  sx1: number, sy1: number,
  sx2: number, sy2: number,
  // Destination triangle (CSS pixel coords)
  dx0: number, dy0: number,
  dx1: number, dy1: number,
  dx2: number, dy2: number,
) {
  const det = (sx0 - sx2) * (sy1 - sy2) - (sx1 - sx2) * (sy0 - sy2)
  if (Math.abs(det) < 1e-10) return

  ctx.save()

  // Clip to the destination triangle (DPR transform is active, so coords are CSS px)
  ctx.beginPath()
  ctx.moveTo(dx0, dy0)
  ctx.lineTo(dx1, dy1)
  ctx.lineTo(dx2, dy2)
  ctx.closePath()
  ctx.clip()

  // Solve for the affine matrix that maps image coords → CSS coords:
  //   dx = a·sx + c·sy + e
  //   dy = b·sx + d·sy + f
  const inv = 1 / det
  const a = ((dx0 - dx2) * (sy1 - sy2) - (dx1 - dx2) * (sy0 - sy2)) * inv
  const c = ((sx0 - sx2) * (dx1 - dx2) - (sx1 - sx2) * (dx0 - dx2)) * inv
  const e = dx0 - a * sx0 - c * sy0
  const b = ((dy0 - dy2) * (sy1 - sy2) - (dy1 - dy2) * (sy0 - sy2)) * inv
  const d = ((sx0 - sx2) * (dy1 - dy2) - (sx1 - sx2) * (dy0 - dy2)) * inv
  const f = dy0 - b * sx0 - d * sy0

  // Compose with DPR scaling so we go from image pixels → device pixels
  ctx.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * e, dpr * f)
  ctx.drawImage(img, 0, 0)

  ctx.restore()
}

function GenieCanvas({
  snapshot,
  sourceRect,
  onComplete,
  duration = 700,
}: GenieEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const vw = window.innerWidth
    const vh = window.innerHeight
    canvas.width = vw * dpr
    canvas.height = vh * dpr
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const img = new Image()
    img.src = snapshot

    img.onload = () => {
      const tgt = getDockTarget()
      const imgW = img.naturalWidth
      const imgH = img.naturalHeight

      // Source edges
      const srcL = sourceRect.x
      const srcR = sourceRect.x + sourceRect.w
      const srcT = sourceRect.y
      const srcB = sourceRect.y + sourceRect.h

      // Target edges
      const tgtL = tgt.x
      const tgtR = tgt.x + tgt.w
      const tgtCY = tgt.y + tgt.h / 2

      // How far each edge must travel
      const leftDist = tgtL - srcL
      const rightDist = tgtR - srcR
      const vertDist = tgtCY - srcT

      // Bezier curves span from window top to dock center
      const bezTopY = srcT
      const bezBotY = tgtCY
      const bezH = bezBotY - bezTopY

      const startTime = performance.now()

      const animate = (now: number) => {
        const frac = Math.min((now - startTime) / duration, 1)

        // Reset to DPR base transform, then clear
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, vw, vh)

        const slideP = clamp01(frac / SLIDE_END)
        const transP = clamp01((frac - TRANSLATE_START) / (1 - TRANSLATE_START))

        // Bottom x of the left/right bezier curves (shearing inward)
        const lBotX = srcL + slideP * leftDist
        const rBotX = srcR + slideP * rightDist

        // Bezier edge functions: return x at a given screen-y
        function leftX(y: number) {
          if (y >= bezBotY) return lBotX
          if (y <= bezTopY) return srcL
          const p = (bezBotY - y) / bezH // 0 at bottom, 1 at top
          return lBotX + quadEaseInOut(p) * (srcL - lBotX)
        }
        function rightX(y: number) {
          if (y >= bezBotY) return rBotX
          if (y <= bezTopY) return srcR
          const p = (bezBotY - y) / bezH
          return rBotX + quadEaseInOut(p) * (srcR - rBotX)
        }

        // Current top/bottom of the translating window
        const curTop = srcT + transP * vertDist
        const curBot = srcB + transP * vertDist

        for (let i = 0; i < ROWS; i++) {
          const f0 = i / ROWS
          const f1 = (i + 1) / ROWS

          const y0 = curTop + f0 * (curBot - curTop)
          const y1 = curTop + f1 * (curBot - curTop)

          // Skip off-screen strips
          if (y1 < 0 || y0 > vh) continue

          // Compute all four trapezoid corners
          const lx0 = leftX(y0), rx0 = rightX(y0) // top edge
          const lx1 = leftX(y1), rx1 = rightX(y1) // bottom edge

          const w0 = rx0 - lx0
          const w1 = rx1 - lx1
          if (w0 < 0.5 && w1 < 0.5) continue

          // Source strip in image pixel coords
          const sy0 = f0 * imgH
          const sy1 = f1 * imgH

          // Draw the strip as two textured triangles forming a trapezoid.
          // Triangle A: top-left → top-right → bottom-left
          drawTexturedTriangle(
            ctx, img, dpr,
            0, sy0,       imgW, sy0,     0, sy1,
            lx0, y0,      rx0, y0,       lx1, y1,
          )
          // Triangle B: top-right → bottom-right → bottom-left
          drawTexturedTriangle(
            ctx, img, dpr,
            imgW, sy0,    imgW, sy1,     0, sy1,
            rx0, y0,      rx1, y1,       lx1, y1,
          )
        }

        if (frac < 1) {
          animRef.current = requestAnimationFrame(animate)
        } else {
          onCompleteRef.current()
        }
      }

      animRef.current = requestAnimationFrame(animate)
    }

    img.onerror = () => onCompleteRef.current()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [snapshot, sourceRect, duration])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    />
  )
}

export function GenieEffect(props: GenieEffectProps) {
  return createPortal(<GenieCanvas {...props} />, document.body)
}
