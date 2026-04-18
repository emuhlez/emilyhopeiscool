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
      className="group relative flex flex-col items-center justify-center"
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

function DockBackground({
  children,
  scale = 1,
}: {
  children?: ReactNode
  scale?: number
}) {
  return (
    <div
      className="pointer-events-auto flex items-end justify-center [&>img.size-\[var\(--dock-icon-size\)\]]:p-0"
      style={{
        gap: `${8 * scale}px`,
        borderRadius: `${16 * scale}px`,
        padding: `${8 * scale}px ${10 * scale}px ${2 * scale}px`,
        background: 'rgba(246, 246, 246, 0.36)',
        backdropFilter: 'blur(68px)',
        WebkitBackdropFilter: 'blur(68px)',
        boxShadow:
          '0 0 6px rgba(0, 0, 0, 0.15), inset 0 0 0 0.5px rgba(26, 26, 26, 0.46)',
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
  const scale = iconSize / 36
  return (
    <nav
      aria-label="Dock"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 4px)',
        ['--dock-icon-size' as string]: `${iconSize}px`,
      }}
    >
      <div className="mx-auto w-fit max-w-[min(92vw,720px)] px-3">
        <DockBackground scale={scale}>{children}</DockBackground>
      </div>
    </nav>
  )
}

