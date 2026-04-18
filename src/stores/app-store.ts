import { create } from 'zustand'

interface AppState {
  openApps: Set<string>
  minimizedApps: Set<string>
  minimizedSnapshots: Map<string, string>
  focusedAppId: string
  fullscreenAppId: string | null
  windowOrder: string[]

  openApp: (id: string) => void
  closeApp: (id: string) => void
  focusApp: (id: string) => void
  toggleApp: (id: string) => void
  minimizeApp: (id: string, snapshot?: string) => void
  unminimizeApp: (id: string) => void
  setFullscreenApp: (id: string | null) => void
  unminimizingAppId: string | null
  clearUnminimizing: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  openApps: new Set(['finder']),
  minimizedApps: new Set(),
  minimizedSnapshots: new Map(),
  focusedAppId: 'finder',
  fullscreenAppId: null,
  windowOrder: [],
  unminimizingAppId: null,

  openApp: (id: string) => {
    const { openApps, minimizedApps, windowOrder } = get()

    if (minimizedApps.has(id)) {
      get().unminimizeApp(id)
      return
    }

    if (openApps.has(id)) {
      get().focusApp(id)
      return
    }
    const newOpen = new Set(openApps)
    newOpen.add(id)
    set({
      openApps: newOpen,
      windowOrder: [...windowOrder.filter((wId) => wId !== id), id],
      focusedAppId: id,
    })
  },

  closeApp: (id: string) => {
    if (id === 'finder') return
    const { openApps, minimizedApps, minimizedSnapshots, fullscreenAppId, windowOrder } = get()
    const newOpen = new Set(openApps)
    newOpen.delete(id)
    const newMinimized = new Set(minimizedApps)
    newMinimized.delete(id)
    const newSnapshots = new Map(minimizedSnapshots)
    newSnapshots.delete(id)
    const newOrder = windowOrder.filter((wId) => wId !== id)
    const nextFocus = newOrder.length > 0 ? newOrder[newOrder.length - 1] : 'finder'
    set({
      openApps: newOpen,
      minimizedApps: newMinimized,
      minimizedSnapshots: newSnapshots,
      fullscreenAppId: fullscreenAppId === id ? null : fullscreenAppId,
      windowOrder: newOrder,
      focusedAppId: nextFocus,
    })
  },

  focusApp: (id: string) => {
    const { windowOrder } = get()
    set({
      windowOrder: [...windowOrder.filter((wId) => wId !== id), id],
      focusedAppId: id,
    })
  },

  toggleApp: (id: string) => {
    const { openApps, minimizedApps } = get()
    if (minimizedApps.has(id)) {
      get().unminimizeApp(id)
    } else if (openApps.has(id) && id !== 'finder') {
      get().closeApp(id)
    } else {
      get().openApp(id)
    }
  },

  minimizeApp: (id: string, snapshot?: string) => {
    const { minimizedApps, minimizedSnapshots, fullscreenAppId, windowOrder } = get()
    const newMinimized = new Set(minimizedApps)
    newMinimized.add(id)
    const newSnapshots = new Map(minimizedSnapshots)
    if (snapshot) newSnapshots.set(id, snapshot)
    const newOrder = windowOrder.filter((wId) => wId !== id)
    const nextFocus = newOrder.length > 0 ? newOrder[newOrder.length - 1] : 'finder'
    set({
      minimizedApps: newMinimized,
      minimizedSnapshots: newSnapshots,
      fullscreenAppId: fullscreenAppId === id ? null : fullscreenAppId,
      windowOrder: newOrder,
      focusedAppId: nextFocus,
    })
  },

  unminimizeApp: (id: string) => {
    const { minimizedApps, minimizedSnapshots, windowOrder } = get()
    const newMinimized = new Set(minimizedApps)
    newMinimized.delete(id)
    const newSnapshots = new Map(minimizedSnapshots)
    newSnapshots.delete(id)
    set({
      minimizedApps: newMinimized,
      minimizedSnapshots: newSnapshots,
      windowOrder: [...windowOrder.filter((wId) => wId !== id), id],
      focusedAppId: id,
      unminimizingAppId: id,
    })
  },

  clearUnminimizing: () => set({ unminimizingAppId: null }),

  setFullscreenApp: (id: string | null) => {
    set({ fullscreenAppId: id })
  },
}))
