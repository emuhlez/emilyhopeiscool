import { usePhotosStore } from '../../../stores/photos-store'

interface SidebarItem {
  id: string
  label: string
  icon: string
}

const LIBRARY_ITEMS: SidebarItem[] = [
  { id: 'library', label: 'Library', icon: 'photo' },
  { id: 'favorites', label: 'Favorites', icon: 'heart' },
  { id: 'recents', label: 'Recently Saved', icon: 'clock' },
]

const MEDIA_ITEMS: SidebarItem[] = [
  { id: 'selfies', label: 'Selfies', icon: 'person' },
  { id: 'videos', label: 'Videos', icon: 'play' },
  { id: 'screenshots', label: 'Screenshots', icon: 'screen' },
  { id: 'recently-deleted', label: 'Recently Deleted', icon: 'trash' },
]

function SidebarIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? '#fff' : 'rgba(255,255,255,0.55)'
  const size = 14

  switch (type) {
    case 'photo':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="10" rx="2" stroke={color} strokeWidth="1.3" />
          <circle cx="5.5" cy="7" r="1.5" stroke={color} strokeWidth="1" />
          <path d="M1 11l3.5-3.5L7 10l3-4 5 5.5V11a2 2 0 01-2 2H3a2 2 0 01-2-2z" fill={color} opacity="0.3" />
        </svg>
      )
    case 'heart':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M8 14s-5.5-3.5-5.5-7A3 3 0 018 4.5 3 3 0 0113.5 7C13.5 10.5 8 14 8 14z" stroke={color} strokeWidth="1.3" />
        </svg>
      )
    case 'clock':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.3" />
          <path d="M8 4.5V8l2.5 2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'person':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.5" r="3" stroke={color} strokeWidth="1.3" />
          <path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'play':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M5 3l8 5-8 5V3z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      )
    case 'screen':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2" width="13" height="9.5" rx="1.5" stroke={color} strokeWidth="1.3" />
          <path d="M5.5 14h5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'trash':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5L5 13a1 1 0 001 1h4a1 1 0 001-1l.5-8.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'album':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke={color} strokeWidth="1.3" />
          <rect x="4" y="1.5" width="8" height="2" rx="0.8" stroke={color} strokeWidth="0.8" opacity="0.4" />
        </svg>
      )
    default:
      return null
  }
}

export function PhotosSidebar({
  width,
  onResizeStart,
}: {
  width: number
  onResizeStart: (e: React.PointerEvent) => void
}) {
  const selectedSection = usePhotosStore((s) => s.selectedSection)
  const selectSection = usePhotosStore((s) => s.selectSection)
  const albums = usePhotosStore((s) => s.albums)

  const renderItem = (item: SidebarItem) => {
    const isActive = item.id === selectedSection
    return (
      <div
        key={item.id}
        className="flex items-center gap-2 rounded-md px-2 py-[3px]"
        style={{
          cursor: 'default',
          background: isActive ? 'rgba(255,255,255,0.1)' : undefined,
          transition: 'background 0.1s',
        }}
        onClick={() => selectSection(item.id)}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = ''
        }}
      >
        <SidebarIcon type={item.icon} active={isActive} />
        <span
          className="text-[12px]"
          style={{
            color: isActive ? '#fff' : 'rgba(255,255,255,0.75)',
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {item.label}
        </span>
      </div>
    )
  }

  return (
    <div
      className="relative flex h-full shrink-0 flex-col"
      style={{ width, background: '#1A1A1A', borderRight: '0.5px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {/* Library section */}
        {LIBRARY_ITEMS.map(renderItem)}

        {/* Media Types header */}
        <div className="mt-4 mb-1 px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Media Types
          </span>
        </div>
        {MEDIA_ITEMS.map(renderItem)}

        {/* Albums header */}
        <div className="mt-4 mb-1 px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Albums
          </span>
        </div>
        {renderItem({ id: 'all-albums', label: 'All Albums', icon: 'album' })}
        {albums.map((a) =>
          renderItem({ id: a.id, label: a.name, icon: 'album' }),
        )}
      </div>

      {/* Resize handle */}
      <div
        className="group absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
        style={{ touchAction: 'none' }}
        onPointerDown={onResizeStart}
      >
        <div className="absolute left-1/2 top-2 bottom-2 w-[2px] -translate-x-1/2 rounded-full bg-white/0 transition-colors duration-150 group-hover:bg-white/15" />
      </div>
    </div>
  )
}
