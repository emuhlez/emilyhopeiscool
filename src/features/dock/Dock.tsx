import { type ReactNode, useRef, useState } from 'react'
import { useAppStore } from '../../stores/app-store'

export function DockIcon({
  src,
  label,
  appId,
  onClick,
}: {
  src: string
  label: string
  appId?: string
  onClick?: () => void
}) {
  const storeActive = useAppStore((s) => (appId ? s.openApps.has(appId) : false))
  const storeToggle = useAppStore((s) => s.toggleApp)

  const [internalActive, setInternalActive] = useState(false)
  const [bouncing, setBouncing] = useState(false)
  const pendingOpenRef = useRef(false)

  const active = appId ? storeActive : internalActive

  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }

    if (active) {
      if (appId) {
        storeToggle(appId)
      } else {
        setInternalActive(false)
      }
      return
    }

    setBouncing(true)
    if (appId) {
      pendingOpenRef.current = true
    } else {
      setInternalActive(true)
    }
  }

  const handleBounceEnd = () => {
    setBouncing(false)
    if (pendingOpenRef.current && appId) {
      pendingOpenRef.current = false
      storeToggle(appId)
    }
  }

  return (
    <div
      className="group relative flex shrink-0 flex-col items-center justify-center"
      onClick={handleClick}
    >
      <div
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ marginBottom: 'calc(var(--dock-icon-size) / 6 + 12px)' }}
      >
        <div
          className="whitespace-nowrap rounded-xl px-3 py-1 text-white"
          style={{ fontSize: 13, background: 'rgba(70, 70, 70, 0.9)' }}
        >
          {label}
        </div>
        <svg
          className="mx-auto block"
          width="14"
          height="6"
          viewBox="0 0 14 6"
          fill="none"
        >
          <path
            d="M0 0C2.5 0 4.5 2.1 5.8 4.1C6.3 4.8 7.7 4.8 8.2 4.1C9.5 2.1 11.5 0 14 0H0Z"
            fill="rgba(70, 70, 70, 0.85)"
          />
        </svg>
      </div>
      <img
        src={src}
        alt={label}
        className="size-[var(--dock-icon-size)]"
        draggable={false}
        style={bouncing ? { animation: 'dock-bounce 0.9s ease-in-out' } : undefined}
        onAnimationEnd={handleBounceEnd}
      />
      <div
        className="flex items-start justify-center"
        style={{ paddingTop: 4, height: 'calc(var(--dock-icon-size) / 7)' }}
      >
        {(active || bouncing) && (
          <div
            className="rounded-full bg-white/80"
            style={{
              width: 'clamp(2px, calc(var(--dock-icon-size) / 16), 4px)',
              height: 'clamp(2px, calc(var(--dock-icon-size) / 16), 4px)',
            }}
          />
        )}
      </div>
    </div>
  )
}

function DockBackground({ children }: { children?: ReactNode }) {
  return (
    <div
      className="pointer-events-auto flex w-fit items-end [&>img.size-\[var\(--dock-icon-size\)\]]:p-0"
      style={{
        // Pill metrics derive from the live --dock-icon-size so they shrink with
        // the icons on viewport resize. Ratios match the original 36px design
        // (gap 8, padding 8/10/2, radius 16).
        gap: 'calc(var(--dock-icon-size) * 8 / 36)',
        borderRadius: 'calc(var(--dock-icon-size) * 16 / 36)',
        padding:
          'calc(var(--dock-icon-size) * 8 / 36) calc(var(--dock-icon-size) * 10 / 36) calc(var(--dock-icon-size) * 2 / 36)',
        background: 'rgba(246, 246, 246, 0.36)',
        backdropFilter: 'blur(68px)',
        WebkitBackdropFilter: 'blur(68px)',
        boxShadow:
          '0 0 6px rgba(0, 0, 0, 0.15), inset 0 0 0 0.5px rgba(26, 26, 26, 0.46)',
        transition: 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        // Opt in to interpolating between intrinsic widths (Chromium 129+, Safari 26+).
        // Older browsers ignore this and the dock simply snaps between widths.
        ['interpolateSize' as string]: 'allow-keywords',
      }}
    >
      {children}
    </div>
  )
}

export function Dock({
  children,
  iconSize = 36,
}: {
  children?: ReactNode
  iconSize?: number
}) {
  // Fluid icon size: linearly interpolate between 22px @ ~400px viewport and
  // iconSize px @ ~1280px viewport, clamped at both ends. Math:
  //   y = m·vw + b, with m = (iconSize − 22)/880 px-per-px (× 100 → vw%)
  //   b = 22 − 400·m
  // Default (iconSize=36) → clamp(22px, calc(1.591vw + 15.64px), 36px):
  //   320vw → 22px (clamp min, still tappable),
  //   ~900vw → ~30px (visibly shrinking),
  //   ≥1280vw → 36px (clamp max, original look).
  const slopeVw = ((iconSize - 22) / 8.8).toFixed(3)
  const offsetPx = (22 - (400 * (iconSize - 22)) / 880).toFixed(2)
  const fluidIconSize = `clamp(22px, calc(${slopeVw}vw + ${offsetPx}px), ${iconSize}px)`

  return (
    <nav
      aria-label="Dock"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 4px)',
        ['--dock-icon-size' as string]: fluidIconSize,
      }}
    >
      <DockBackground>{children}</DockBackground>
    </nav>
  )
}

