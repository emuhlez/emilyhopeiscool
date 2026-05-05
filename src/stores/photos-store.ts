import { create } from 'zustand'

export interface PhotoItem {
  id: string
  src: string
  alt: string
  date: string      // ISO date string
  favorite: boolean
  albumIds: string[]
  width: number      // aspect ratio hint
  height: number
}

export interface Album {
  id: string
  name: string
}

type SidebarSection =
  | 'library'
  | 'favorites'
  | 'recents'
  | 'screenshots'
  | 'videos'
  | 'all-albums'
  | string // album id

type ViewMode = 'all' | 'months' | 'years'

interface PhotosState {
  photos: PhotoItem[]
  albums: Album[]
  selectedSection: SidebarSection
  viewMode: ViewMode
  selectedPhotoId: string | null
  searchQuery: string

  selectSection: (s: SidebarSection) => void
  setViewMode: (m: ViewMode) => void
  selectPhoto: (id: string | null) => void
  setSearchQuery: (q: string) => void
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// Sample photos using picsum for placeholder content
const SAMPLE_PHOTOS: PhotoItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: makeId(),
  src: `https://picsum.photos/seed/photo${i}/${400 + (i % 3) * 100}/${300 + (i % 4) * 80}`,
  alt: `Photo ${i + 1}`,
  date: new Date(2024, 2, 18 - Math.floor(i / 4), 12, i * 5).toISOString(),
  favorite: i % 5 === 0,
  albumIds: i % 3 === 0 ? ['album-1'] : [],
  width: 400 + (i % 3) * 100,
  height: 300 + (i % 4) * 80,
}))

const DEFAULT_ALBUMS: Album[] = [
  { id: 'album-1', name: 'Favorites' },
]

export const usePhotosStore = create<PhotosState>((set) => ({
  photos: SAMPLE_PHOTOS,
  albums: DEFAULT_ALBUMS,
  selectedSection: 'library',
  viewMode: 'all',
  selectedPhotoId: null,
  searchQuery: '',

  selectSection: (s) => set({ selectedSection: s, selectedPhotoId: null }),
  setViewMode: (m) => set({ viewMode: m }),
  selectPhoto: (id) => set({ selectedPhotoId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))
