import { useCallback, useLayoutEffect, useRef } from 'react'
import { useAppStore } from '../stores/app-store'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const FUNNEL_PTS = 28
const SLIDE_END = 0.5
const TRANS_START = 0.4
const DURATION = 550

function quadEase(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function getDockTarget() {
  const el = document.querySelector('[data-genie-target]')
  if (el) {
    const r = el.getBoundingClientRect()
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }
  return { cx: window.innerWidth / 2, cy: window.innerHeight - 40 }
}

/** Compute clip-path polygon + translateY for a given progress (0 = full window, 1 = collapsed at dock). */
function computeFrame(frac: number, rect: Rect) {
  const dock = getDockTarget()
  const dockHalfW = 17

  const tgtLFrac = ((dock.cx - dockHalfW) - rect.x) / rect.w
  const tgtRFrac = ((dock.cx + dockHalfW) - rect.x) / rect.w
  const vertDist = dock.cy - rect.y
  const funnelHFrac = vertDist / rect.h

  const slideP = clamp01(frac / SLIDE_END)
  const transP = clamp01((frac - TRANS_START) / (1 - TRANS_START))
  const translateY = transP * vertDist
  const funnelTopFrac = -translateY / rect.h
  const lBot = slideP * tgtLFrac
  const rBot = 1 + slideP * (tgtRFrac - 1)

  function leftEdge(yf: number) {
    const p = (yf - funnelTopFrac) / funnelHFrac
    if (p <= 0) return 0
    if (p >= 1) return lBot
    return lBot + quadEase(1 - p) * (0 - lBot)
  }
  function rightEdge(yf: number) {
    const p = (yf - funnelTopFrac) / funnelHFrac
    if (p <= 0) return 1
    if (p >= 1) return rBot
    return rBot + quadEase(1 - p) * (1 - rBot)
  }

  const pts: string[] = []
  for (let i = 0; i <= FUNNEL_PTS; i++) {
    const yf = i / FUNNEL_PTS
    pts.push(`${(rightEdge(yf) * 100).toFixed(2)}% ${(yf * 100).toFixed(2)}%`)
  }
  for (let i = FUNNEL_PTS; i >= 0; i--) {
    const yf = i / FUNNEL_PTS
    pts.push(`${(leftEdge(yf) * 100).toFixed(2)}% ${(yf * 100).toFixed(2)}%`)
  }

  return { clipPath: `polygon(${pts.join(',')})`, translateY }
}

function applyFrame(el: HTMLElement, frame: { clipPath: string; translateY: number }) {
  el.style.clipPath = frame.clipPath
  el.style.transform = `translateY(${frame.translateY}px)`
}

function clearStyles(el: HTMLElement) {
  el.style.clipPath = ''
  el.style.transform = ''
  el.style.pointerEvents = ''
}

/**
 * Reusable genie minimize/unminimize animation.
 *
 * Animates a window element with a clip-path funnel + translateY,
 * maintaining full DOM rendering fidelity (backdrop-filter, etc.).
 *
 * @param appId        The app identifier in the store.
 * @param rectRef      Mutable ref tracking the window's current position/size.
 * @param snapshotRef  Ref to the inner element used for dock thumbnail capture.
 * @param onMinimized  Optional callback fired after the minimize completes (e.g. to clear fullscreen).
 * @returns `outerRef` to attach to the window wrapper div, and `handleMinimize` for the yellow traffic light.
 */
export function useMinimizeAnimation(
  appId: string,
  rectRef: React.MutableRefObject<Rect>,
  snapshotRef: React.RefObject<HTMLElement | null>,
  onMinimized?: () => void,
) {
  const outerRef = useRef<HTMLDivElement>(null)
  const animatingRef = useRef(false)
  const thumbRef = useRef<string | undefined>(undefined)

  const minimizeApp = useAppStore((s) => s.minimizeApp)
  const unminimizingAppId = useAppStore((s) => s.unminimizingAppId)
  const clearUnminimizing = useAppStore((s) => s.clearUnminimizing)

  const onMinimizedRef = useRef(onMinimized)
  onMinimizedRef.current = onMinimized

  // ── Forward genie (minimize) ──────────────────────────────────────────
  const handleMinimize = useCallback(() => {
    if (animatingRef.current) return
    animatingRef.current = true

    const outer = outerRef.current
    if (!outer) {
      minimizeApp(appId)
      animatingRef.current = false
      onMinimizedRef.current?.()
      return
    }

    const runAnimation = () => {
      outer.style.pointerEvents = 'none'
      const rect = rectRef.current
      const t0 = performance.now()

      const tick = (now: number) => {
        const frac = Math.min((now - t0) / DURATION, 1)
        applyFrame(outer, computeFrame(frac, rect))

        if (frac < 1) {
          requestAnimationFrame(tick)
        } else {
          clearStyles(outer)
          minimizeApp(appId, thumbRef.current)
          thumbRef.current = undefined
          animatingRef.current = false
          onMinimizedRef.current?.()
        }
      }

      requestAnimationFrame(tick)
    }

    // Capture a small dock thumbnail, then animate
    const inner = snapshotRef.current
    if (inner) {
      import('html-to-image').then(({ toPng }) => {
        toPng(inner as HTMLElement, { pixelRatio: 0.5, backgroundColor: '#040618' })
          .then(url => { thumbRef.current = url; runAnimation() })
          .catch(() => runAnimation())
      }).catch(() => runAnimation())
    } else {
      runAnimation()
    }
  }, [appId, minimizeApp, rectRef, snapshotRef])

  // ── Reverse genie (unminimize) ────────────────────────────────────────
  useLayoutEffect(() => {
    if (unminimizingAppId !== appId) return
    const outer = outerRef.current
    if (!outer) { clearUnminimizing(); return }

    const rect = rectRef.current

    // Set collapsed state synchronously before first paint (no flash)
    applyFrame(outer, computeFrame(1, rect))
    outer.style.pointerEvents = 'none'

    const t0 = performance.now()

    const tick = (now: number) => {
      const timeFrac = Math.min((now - t0) / DURATION, 1)
      applyFrame(outer, computeFrame(1 - timeFrac, rect))

      if (timeFrac < 1) {
        requestAnimationFrame(tick)
      } else {
        clearStyles(outer)
        clearUnminimizing()
      }
    }

    requestAnimationFrame(tick)
  }, [appId, unminimizingAppId, clearUnminimizing, rectRef])

  return { outerRef, handleMinimize }
}
