export function TrafficLights({
  onClose,
  onMinimize,
  onFullscreen,
}: {
  onClose?: () => void
  onMinimize?: () => void
  onFullscreen?: () => void
}) {
  return (
    <div className="group/tl flex items-center gap-2">
      {/* Close */}
      <div
        className="flex size-3 items-center justify-center rounded-full bg-[#FF5F57]"
        onClick={onClose}
        style={{ cursor: onClose ? 'default' : undefined }}
      >
        <svg className="hidden group-hover/tl:block" width="6" height="6" viewBox="0 0 6 6" fill="none">
          <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      {/* Minimize */}
      <div
        className="flex size-3 items-center justify-center rounded-full bg-[#FEBC2E]"
        onClick={onMinimize}
        style={{ cursor: onMinimize ? 'default' : undefined }}
      >
        <svg className="hidden group-hover/tl:block" width="6" height="2" viewBox="0 0 6 2" fill="none">
          <path d="M0.5 1H5.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      {/* Fullscreen */}
      <div
        className="flex size-3 items-center justify-center rounded-full bg-[#28C840]"
        onClick={onFullscreen}
        style={{ cursor: onFullscreen ? 'default' : undefined }}
      >
        <svg className="hidden group-hover/tl:block" width="6" height="6" viewBox="0 0 6 6" fill="none">
          <path d="M0.5 3.5V0.5H3.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 2.5V5.5H2.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
