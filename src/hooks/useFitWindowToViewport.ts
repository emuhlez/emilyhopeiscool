import { useEffect, useRef } from 'react'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface FitOptions {
  /** Height of the menu bar at the top of the desktop (windows can't go above this). */
  menuBarH: number
  /** Height of the dock at the bottom of the desktop (windows can't go below it). */
  dockH: number
  /** Minimum window width — windows never shrink below this even if the viewport does. */
  minW: number
  /** Minimum window height — windows never shrink below this even if the viewport does. */
  minH: number
  /**
   * Optional predicate read on every browser resize. When it returns `true`,
   * the hook skips proportional scaling of the live rect and instead snaps it
   * to `{ x: 0, y: 0, w: vw, h: vh }` — keeping a fullscreen window flush with
   * the viewport instead of letting the scaled-y / clamped-h math drift the
   * chrome away from `fullscreen === true`. The optional rect (typically the
   * stored pre-fullscreen size) keeps scaling so exiting fullscreen still
   * restores a sensibly-sized window.
   */
  isFullscreen?: () => boolean
}

/**
 * Proportionally scale a rect by `(sx, sy)` and clamp to the desktop's
 * available area (between menu bar and dock) and minimum sizes.
 */
function scaleAndClamp(
  prev: Rect,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  opts: FitOptions,
): Rect {
  const scaledX = prev.x * sx
  const scaledY = (prev.y - opts.menuBarH) * sy + opts.menuBarH
  const scaledW = prev.w * sx
  const scaledH = prev.h * sy

  const availH = Math.max(opts.minH, vh - opts.menuBarH - opts.dockH)
  const w = Math.max(opts.minW, Math.min(scaledW, vw))
  const h = Math.max(opts.minH, Math.min(scaledH, availH))
  const x = Math.max(0, Math.min(scaledX, Math.max(0, vw - w)))
  const y = Math.max(opts.menuBarH, Math.min(scaledY, opts.menuBarH + Math.max(0, availH - h)))

  return { x, y, w, h }
}

/**
 * Keep a desktop window proportionally sized relative to the browser viewport.
 *
 * On every browser resize, scales the window's position and size by the ratio
 * of new-to-old viewport dimensions, then clamps to the desktop's available
 * area and the configured min sizes. A window taking up 60% of the viewport
 * stays at ~60% after the browser grows or shrinks — instead of just clamping
 * downward when the viewport gets smaller.
 *
 * If `opts.isFullscreen` returns true, the live rect is snapped to the full
 * viewport (`{0,0,vw,vh}`) instead of being scaled — the menu bar and dock
 * insets don't apply while a window is fullscreen.
 *
 * If a `setOptionalRect` setter is passed (typically the
 * `preFullscreenRect` setter used to remember the pre-fullscreen size), it is
 * scaled in lockstep so exiting fullscreen after a viewport change still
 * lands at a sensible size.
 */
export function useFitWindowToViewport(
  setRect: React.Dispatch<React.SetStateAction<Rect>>,
  opts: FitOptions,
  setOptionalRect?: React.Dispatch<React.SetStateAction<Rect | null>>,
) {
  // Keep the latest opts in a ref so the resize handler always reads fresh
  // values (including the `isFullscreen` predicate) without having to
  // re-subscribe on every render. Writing the ref in a layout-free effect
  // keeps it out of the render path (react-hooks/refs).
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  const prevViewportRef = useRef({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => {
      const o = optsRef.current
      const prev = prevViewportRef.current
      const vw = window.innerWidth
      const vh = window.innerHeight

      if (prev.w <= 0 || prev.h <= 0) {
        prevViewportRef.current = { w: vw, h: vh }
        return
      }

      const sx = vw / prev.w
      const sy = vh / prev.h
      prevViewportRef.current = { w: vw, h: vh }

      // No-op if viewport didn't actually change (e.g. devicePixelRatio change).
      if (sx === 1 && sy === 1) return

      const fullscreen = o.isFullscreen?.() ?? false
      if (fullscreen) {
        // Snap fullscreen rect to the full viewport — never scale-then-clamp,
        // which would leave a stale (y > 0) offset and a height capped at
        // (vh - menuBarH - dockH) that no longer matches `fullscreen === true`.
        setRect((cur) =>
          cur.x === 0 && cur.y === 0 && cur.w === vw && cur.h === vh
            ? cur
            : { x: 0, y: 0, w: vw, h: vh },
        )
      } else {
        setRect((cur) => scaleAndClamp(cur, sx, sy, vw, vh, o))
      }

      // The pre-fullscreen rect always scales: it represents the size the
      // window will return to once fullscreen is exited, regardless of the
      // current fullscreen state.
      if (setOptionalRect) {
        setOptionalRect((cur) => (cur ? scaleAndClamp(cur, sx, sy, vw, vh, o) : cur))
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setRect, setOptionalRect])
}
