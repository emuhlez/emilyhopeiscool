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
  /* Quadratic spread of capture dates so the seed library spans roughly the
   * last 2.5 years rather than a single 14-day window. Recent photos cluster
   * (low i = small daysAgo gap), older photos thin out — same shape as a
   * real photo library. Years view ends up with 2026/2025/2024 sections;
   * Months view gets ~12–15 sections with denser-recent / sparser-older
   * photo counts. */
  const daysAgo = Math.floor((i * i) / 4)
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

/** A time-bucketed group of photos for the Months/Years views. `label` is the
 * human-readable section title ("April 2026", "2025"); empty string for the
 * single bucket used by the 'all' view (caller suppresses the header). */
export interface PhotosSection {
  key: string
  label: string
  sublabel: string
  photos: PhotoItem[]
}

const FMT_MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})
const FMT_YEAR = new Intl.DateTimeFormat('en-US', { year: 'numeric' })

/** Group photos into time-based sections matching the active ViewMode.
 *
 *  - 'all'    → one synthetic section with every photo, empty label (the grid
 *               renders no header, preserving the flat-justified layout).
 *  - 'months' → one section per (year, month). Sections sorted newest-first;
 *               photos within each section sorted newest-first.
 *  - 'years'  → one section per year. Same sort.
 *
 *  Why bucket here (vs. inside the grid component): the grid only needs a
 *  list of sections to iterate, and bucketing is a pure function of (photos,
 *  mode). Keeping it next to the store gives any future caller (e.g. an
 *  alternate layout, a memo selector) a single source of truth for the
 *  Years/Months partition. */
export function bucketPhotos(
  photos: PhotoItem[],
  mode: ViewMode,
): PhotosSection[] {
  if (mode === 'all') {
    return [{ key: 'all', label: '', sublabel: '', photos }]
  }

  type Bucket = { key: string; date: Date; photos: PhotoItem[] }
  const map = new Map<string, Bucket>()

  for (const p of photos) {
    const d = new Date(p.date)
    const key =
      mode === 'years'
        ? `${d.getFullYear()}`
        : `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    let b = map.get(key)
    if (!b) {
      b = { key, date: d, photos: [] }
      map.set(key, b)
    }
    b.photos.push(p)
  }

  const buckets = Array.from(map.values())
  buckets.sort((a, b) => b.date.getTime() - a.date.getTime())
  for (const b of buckets) {
    b.photos.sort(
      (p1, p2) => new Date(p2.date).getTime() - new Date(p1.date).getTime(),
    )
  }

  return buckets.map((b) => {
    const fmt = mode === 'years' ? FMT_YEAR : FMT_MONTH
    return {
      key: b.key,
      label: fmt.format(b.date),
      sublabel: `${b.photos.length} ${b.photos.length === 1 ? 'item' : 'items'}`,
      photos: b.photos,
    }
  })
}
