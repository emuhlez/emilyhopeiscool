export function TrafficLights({
  onClose,
  onMinimize,
  onFullscreen,
  dotSize = 12,
  gapPx = 8,
  closeColor = '#FF5F57',
  minimizeColor = '#FEBC2E',
  zoomColor = '#28C840',
}: {
  onClose?: () => void
  onMinimize?: () => void
  onFullscreen?: () => void
  /** Dot diameter in px (Figma Photos sidebar uses 14). */
  dotSize?: number
  gapPx?: number
  closeColor?: string
  minimizeColor?: string
  zoomColor?: string
}) {
  const hoverSvg = dotSize >= 14 ? 7 : 6
  return (
    <div className="group/tl flex items-center" style={{ gap: gapPx }}>
      {/* Close */}
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          background: closeColor,
          boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.10)',
          cursor: onClose ? 'default' : undefined,
        }}
        onClick={onClose}
      >
        <svg
          className="hidden group-hover/tl:block"
          width={hoverSvg}
          height={hoverSvg}
          viewBox="0 0 6 6"
          fill="none"
        >
          <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      {/* Minimize */}
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          background: minimizeColor,
          boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.10)',
          cursor: onMinimize ? 'default' : undefined,
        }}
        onClick={onMinimize}
      >
        <svg className="hidden group-hover/tl:block" width={hoverSvg} height={2} viewBox="0 0 6 2" fill="none">
          <path d="M0.5 1H5.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      {/* Fullscreen */}
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          background: zoomColor,
          boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.10)',
          cursor: onFullscreen ? 'default' : undefined,
        }}
        onClick={onFullscreen}
      >
        <svg className="hidden group-hover/tl:block" width={hoverSvg} height={hoverSvg} viewBox="0 0 6 6" fill="none">
          <path d="M0.5 3.5V0.5H3.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 2.5V5.5H2.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
