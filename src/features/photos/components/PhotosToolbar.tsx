import { TrafficLights } from '../../../components/TrafficLights'
import { usePhotosStore } from '../../../stores/photos-store'

const VIEW_TABS = [
  { id: 'years' as const, label: 'Years' },
  { id: 'months' as const, label: 'Months' },
  { id: 'all' as const, label: 'All Photos' },
]

export function PhotosToolbar({
  onToggleSidebar,
  onDragStart,
  onClose,
  onMinimize,
  onFullscreen,
}: {
  onToggleSidebar: () => void
  onDragStart: (e: React.PointerEvent) => void
  onClose: () => void
  onMinimize: () => void
  onFullscreen: () => void
}) {
  const viewMode = usePhotosStore((s) => s.viewMode)
  const setViewMode = usePhotosStore((s) => s.setViewMode)
  const selectedSection = usePhotosStore((s) => s.selectedSection)

  const sectionLabel =
    selectedSection === 'library'
      ? 'Library'
      : selectedSection === 'favorites'
        ? 'Favorites'
        : selectedSection === 'recents'
          ? 'Recently Saved'
          : selectedSection === 'all-albums'
            ? 'All Albums'
            : selectedSection.charAt(0).toUpperCase() + selectedSection.slice(1)

  return (
    <div
      className="flex shrink-0 items-center gap-3 px-4"
      style={{
        height: 52,
        background: '#222',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        cursor: 'default',
      }}
      onPointerDown={onDragStart}
    >
      {/* Traffic lights */}
      <div onPointerDown={(e) => e.stopPropagation()}>
        <TrafficLights onClose={onClose} onMinimize={onMinimize} onFullscreen={onFullscreen} />
      </div>

      {/* Sidebar toggle */}
      <div
        className="flex items-center justify-center rounded-md p-1"
        style={{ cursor: 'default' }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggleSidebar}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
      >
        <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
          <rect x="0.5" y="0.5" width="15" height="13" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <line x1="5.5" y1="0.5" x2="5.5" y2="13.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </svg>
      </div>

      {/* Section title */}
      <span className="ml-1 text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
        {sectionLabel}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View mode tabs */}
      {selectedSection === 'library' && (
        <div
          className="flex items-center rounded-md"
          style={{ background: 'rgba(255,255,255,0.06)', padding: 2 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {VIEW_TABS.map((tab) => {
            const isActive = viewMode === tab.id
            return (
              <div
                key={tab.id}
                className="rounded-md px-2.5 py-[2px] text-[11px]"
                style={{
                  cursor: 'default',
                  background: isActive ? 'rgba(255,255,255,0.12)' : undefined,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onClick={() => setViewMode(tab.id)}
              >
                {tab.label}
              </div>
            )
          })}
        </div>
      )}

      {/* Search icon */}
      <div
        className="flex items-center justify-center rounded-md p-1"
        style={{ cursor: 'default' }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
          <path d="M9.5 9.5L12.5 12.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
