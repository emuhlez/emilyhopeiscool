import { create } from 'zustand'

export interface PhotoItem {
  id: string
  src: string
  alt: string
  date: string // ISO date string
  favorite: boolean
  albumIds: string[]
  width: number
  height: number
  isVideo?: boolean
  duration?: number // seconds, for videos
  hasComment?: boolean
}

export interface Album {
  id: string
  name: string
}

export type SidebarSection =
  | 'library'
  | 'collections'
  | 'favorites'
  | 'recents'
  | 'map'
  | 'videos'
  | 'screenshots'
  | 'people'
  | 'deleted'
  | 'shared-albums'
  | 'activity'
  | 'shared-with-you'
  | 'utility-deleted'
  | 'handwriting'
  | 'utility-recents'
  | 'imports'
  | 'utility-map'
  | 'all-projects'

export type ViewMode = 'all' | 'months' | 'years'

/** Inclusive bounds for the thumbnail-size zoom level (mirrors the macOS Photos.app
 *  zoom slider's 5 discrete stops). Exported so toolbar controls can disable the
 *  zoom in / zoom out buttons at the extremes without duplicating the constants. */
export const ZOOM_MIN = 1
export const ZOOM_MAX = 5

interface PhotosState {
  photos: PhotoItem[]
  albums: Album[]
  selectedSection: SidebarSection | null
  viewMode: ViewMode
  selectedPhotoId: string | null
  searchQuery: string
  /** Thumbnail-size zoom, ZOOM_MIN..ZOOM_MAX. Continuous (float) so trackpad
   *  pinch can drive a seamless visual scale between the discrete stops the
   *  toolbar +/- buttons snap to. The grid layout snaps internally for row
   *  packing (Math.round) but interpolates the row height for smooth scaling. */
  zoom: number

  selectSection: (s: SidebarSection) => void
  setViewMode: (m: ViewMode) => void
  selectPhoto: (id: string | null) => void
  setSearchQuery: (q: string) => void
  /** Snap zoom up to the next integer stop (toolbar + button). */
  zoomIn: () => void
  /** Snap zoom down to the previous integer stop (toolbar − button). */
  zoomOut: () => void
  /** Apply a fractional delta to zoom, clamped to [ZOOM_MIN, ZOOM_MAX]. Used
   *  by trackpad-pinch / Ctrl+wheel gestures for seamless (sub-stop) zoom. */
  nudgeZoom: (delta: number) => void
  /** Snap the current (possibly fractional) zoom to its nearest integer stop.
   *  Called when a trackpad-pinch gesture ends so the resting state is always
   *  one of the 5 defined zoom points — pinch is smooth during the gesture,
   *  detent-clean once released. */
  snapZoom: () => void
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const TOTAL = 56

const SAMPLE_PHOTOS: PhotoItem[] = Array.from({ length: TOTAL }, (_, i) => {
  const w = 400 + (i % 3) * 100
  const h = 300 + (i % 4) * 80
  const isVideo = i % 7 === 3
  const daysAgo = Math.floor(i / 4)
  const date = new Date(2026, 3, 12)
  date.setDate(date.getDate() - daysAgo)
  date.setHours(12, (i * 5) % 60)
  return {
    id: makeId(),
    src: `https://picsum.photos/seed/photo${i}/${w}/${h}`,
    alt: `Photo ${i + 1}`,
    date: date.toISOString(),
    favorite: i % 5 === 0,
    albumIds: i % 3 === 0 ? ['album-1'] : [],
    width: w,
    height: h,
    isVideo,
    duration: isVideo ? [40, 5, 30, 12, 65][i % 5] : undefined,
    hasComment: i % 4 === 0,
  }
})

const DEFAULT_ALBUMS: Album[] = [{ id: 'album-1', name: 'Favorites' }]

export const usePhotosStore = create<PhotosState>((set) => ({
  photos: SAMPLE_PHOTOS,
  albums: DEFAULT_ALBUMS,
  selectedSection: null,
  viewMode: 'all',
  selectedPhotoId: null,
  searchQuery: '',
  zoom: 3,

  selectSection: (s) => set({ selectedSection: s, selectedPhotoId: null }),
  setViewMode: (m) => set({ viewMode: m }),
  selectPhoto: (id) => set({ selectedPhotoId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  /* Snap to the next integer stop *above* the current (possibly fractional)
   * value — so pinching to 2.3 and clicking + lands you on 3, not 3.3. */
  zoomIn: () =>
    set((st) => ({ zoom: Math.min(ZOOM_MAX, Math.floor(st.zoom) + 1) })),
  /* Mirror image: snap to the next integer stop *below* the current value
   * (pinching to 2.3 and clicking − lands you on 2, not 1.3). */
  zoomOut: () =>
    set((st) => ({ zoom: Math.max(ZOOM_MIN, Math.ceil(st.zoom) - 1) })),
  nudgeZoom: (delta) =>
    set((st) => ({
      zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, st.zoom + delta)),
    })),
  snapZoom: () =>
    set((st) => ({
      zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(st.zoom))),
    })),
}))

export function filterPhotosBySection(
  photos: PhotoItem[],
  section: SidebarSection | null,
): PhotoItem[] {
  if (section == null) return photos
  switch (section) {
    case 'favorites':
      return photos.filter((p) => p.favorite)
    case 'videos':
      return photos.filter((p) => p.isVideo)
    default:
      return photos
  }
}
