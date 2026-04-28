import { create } from 'zustand'

export interface NoteItem {
  id: string
  folderId: string
  title: string
  body: string // HTML string
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  isExpanded: boolean
}

interface NotesState {
  folders: Folder[]
  notes: NoteItem[]
  selectedNoteId: string | null
  selectedFolderId: string
  searchQuery: string

  selectNote: (id: string | null) => void
  selectFolder: (id: string) => void
  setSearchQuery: (q: string) => void
  createNote: () => void
  updateNote: (id: string, patch: Partial<Pick<NoteItem, 'title' | 'body'>>) => void
  deleteNote: (id: string) => void
  toggleFolderExpanded: (id: string) => void
}

const STORAGE_KEY = 'notes-app-data'
const DEBOUNCE_MS = 400

let saveTimer: ReturnType<typeof setTimeout> | null = null

function persist(state: { folders: Folder[]; notes: NoteItem[] }) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders: state.folders, notes: state.notes }))
    } catch { /* quota exceeded – silently ignore */ }
  }, DEBOUNCE_MS)
}

function loadFromStorage(): { folders: Folder[]; notes: NoteItem[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Array.isArray(data.folders) && Array.isArray(data.notes)) return data
  } catch { /* corrupted – ignore */ }
  return null
}

const DEFAULT_FOLDERS: Folder[] = [
  { id: 'personal', name: 'Personal', isExpanded: true },
  { id: 'work', name: 'Work', isExpanded: true },
  { id: 'ideas', name: 'Ideas', isExpanded: true },
]

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const now = Date.now()

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: makeId(),
    folderId: 'personal',
    title: 'welcome to my desktop',
    body: `<h1>welcome to my desktop</h1><p>I was fortunate to study at an Apple distinguished school for elementary and junior high school. It was here that I learned how to edit videos for book reports, tinkered with robots before I could operate a car, and realized that the rule of thirds always makes for interesting photo composition.</p><p>This technical knowledge coupled with my showmanship was and still continues to be a reflection of my craft. I\u2019m a hands-on designer and the best work happens when I create, entertain, fail, and create again until I succeed.</p><p>Currently at Roblox building AI tools for creators, asset management tooling, and a bunch of other cool things.</p><p>In my free time, I run marathons, create with my hands, study fashion and pop culture trends, and watch a bunch of movies to fill my Letterboxd.</p>`,
    createdAt: now - 86400000 * 3,
    updatedAt: now - 86400000 * 3,
  },
  {
    id: makeId(),
    folderId: 'personal',
    title: 'about this site',
    body: `<h1>about this site</h1><p>hi! i\u2019m emily and i built this site using Claude Code</p><p>some functionality (web capabilities and genie-animation) credits: ryo lu and harshal shah</p><p>this is a 1 to 1 reflection of my laptop and i\u2019m a believer that our devices are the most personal, unique things about us. take a peek into my brain and things i\u2019ve built with collaborators.</p><p>so glad that you\u2019re here. poke around :)</p>`,
    createdAt: now - 86400000 * 2,
    updatedAt: now - 86400000 * 2,
  },
]

function getInitialData() {
  const stored = loadFromStorage()
  if (stored) return stored
  return { folders: DEFAULT_FOLDERS, notes: DEFAULT_NOTES }
}

export const useNotesStore = create<NotesState>((set, get) => {
  const initial = getInitialData()

  return {
    folders: initial.folders,
    notes: initial.notes,
    selectedNoteId: initial.notes.length > 0 ? initial.notes[initial.notes.length - 1].id : null,
    selectedFolderId: 'personal',
    searchQuery: '',

    selectNote: (id) => set({ selectedNoteId: id }),

    selectFolder: (id) => {
      const { notes } = get()
      const filtered = notes.filter((n) => n.folderId === id)
      const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt)
      set({ selectedFolderId: id, selectedNoteId: sorted[0]?.id ?? null, searchQuery: '' })
    },

    setSearchQuery: (q) => set({ searchQuery: q }),

    createNote: () => {
      const { notes, selectedFolderId, folders } = get()
      const folderId = selectedFolderId || (folders[0]?.id ?? 'personal')
      const newNote: NoteItem = {
        id: makeId(),
        folderId,
        title: 'New Note',
        body: '<h1>New Note</h1><p></p>',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const updated = [newNote, ...notes]
      set({ notes: updated, selectedNoteId: newNote.id })
      persist({ folders: get().folders, notes: updated })
    },

    updateNote: (id, patch) => {
      const { notes } = get()
      const updated = notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      )
      set({ notes: updated })
      persist({ folders: get().folders, notes: updated })
    },

    deleteNote: (id) => {
      const { notes, selectedNoteId, selectedFolderId } = get()
      const updated = notes.filter((n) => n.id !== id)
      let nextSelected = selectedNoteId
      if (selectedNoteId === id) {
        const filtered = updated.filter((n) => n.folderId === selectedFolderId)
        const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt)
        nextSelected = sorted[0]?.id ?? null
      }
      set({ notes: updated, selectedNoteId: nextSelected })
      persist({ folders: get().folders, notes: updated })
    },

    toggleFolderExpanded: (id) => {
      const { folders } = get()
      const updated = folders.map((f) => (f.id === id ? { ...f, isExpanded: !f.isExpanded } : f))
      set({ folders: updated })
      persist({ folders: updated, notes: get().notes })
    },
  }
})
