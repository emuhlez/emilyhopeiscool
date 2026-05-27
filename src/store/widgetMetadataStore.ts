import { create } from 'zustand'
import type { ReactNode } from 'react'
import type { Tab } from '../components/shared/TabHeader'

interface WidgetMetadata {
  id: string
  title: string
  icon?: ReactNode
  actions?: ReactNode
}

interface WidgetMetadataStore {
  metadata: Record<string, WidgetMetadata>
  registerWidget: (id: string, metadata: Omit<WidgetMetadata, 'id'>) => void
  getTab: (id: string) => Tab | null
}

export const useWidgetMetadataStore = create<WidgetMetadataStore>((set, get) => ({
  metadata: {},
  
  registerWidget: (id, metadata) => {
    set((state) => ({
      metadata: {
        ...state.metadata,
        [id]: { ...metadata, id },
      },
    }))
  },
  
  getTab: (id) => {
    const meta = get().metadata[id]
    if (!meta) return null
    return {
      id: meta.id,
      title: meta.title,
      icon: meta.icon,
      actions: meta.actions,
    }
  },
}))


