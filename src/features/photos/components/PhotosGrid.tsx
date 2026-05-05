import { useState } from 'react'
import { usePhotosStore } from '../../../stores/photos-store'

export function PhotosGrid() {
  const photos = usePhotosStore((s) => s.photos)
  const selectedSection = usePhotosStore((s) => s.selectedSection)
  const selectedPhotoId = usePhotosStore((s) => s.selectedPhotoId)
  const selectPhoto = usePhotosStore((s) => s.selectPhoto)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Filter photos based on selected section
  const filteredPhotos =
    selectedSection === 'favorites'
      ? photos.filter((p) => p.favorite)
      : selectedSection === 'library' || selectedSection === 'recents'
        ? photos
        : selectedSection.startsWith('album-')
          ? photos.filter((p) => p.albumIds.includes(selectedSection))
          : photos

  if (filteredPhotos.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          No Photos
        </span>
      </div>
    )
  }

  // Group photos by date for display
  const dateGroups = new Map<string, typeof filteredPhotos>()
  for (const photo of filteredPhotos) {
    const d = new Date(photo.date)
    const key = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    if (!dateGroups.has(key)) dateGroups.set(key, [])
    dateGroups.get(key)!.push(photo)
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {[...dateGroups.entries()].map(([dateLabel, groupPhotos]) => (
        <div key={dateLabel} className="mb-4">
          <div className="mb-2 px-1">
            <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {dateLabel}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 2,
            }}
          >
            {groupPhotos.map((photo) => {
              const isSelected = photo.id === selectedPhotoId
              const isHovered = photo.id === hoveredId
              const aspect = photo.width / photo.height

              return (
                <div
                  key={photo.id}
                  className="relative overflow-hidden"
                  style={{
                    aspectRatio: aspect > 1.4 ? '16/10' : aspect < 0.8 ? '3/4' : '1',
                    gridRow: aspect < 0.8 ? 'span 2' : undefined,
                    cursor: 'default',
                    borderRadius: 2,
                    outline: isSelected ? '2px solid #0A84FF' : 'none',
                    outlineOffset: -2,
                    opacity: isHovered && !isSelected ? 0.85 : 1,
                    transition: 'opacity 0.15s',
                  }}
                  onClick={() => selectPhoto(photo.id)}
                  onMouseEnter={() => setHoveredId(photo.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  {photo.favorite && (
                    <div className="absolute bottom-1 left-1">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="#fff">
                        <path d="M8 14s-5.5-3.5-5.5-7A3 3 0 018 4.5 3 3 0 0113.5 7C13.5 10.5 8 14 8 14z" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
