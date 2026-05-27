import { create } from 'zustand'
import type { DockZone, DockedWidget } from '../types'

export const DEFAULT_LEFT_WIDTH = 345
export const DEFAULT_RIGHT_WIDTH = 336
export const DEFAULT_CENTER_BOTTOM_HEIGHT = 470
export const DEFAULT_RIGHT_BOTTOM_HEIGHT = 470

export type PanelSizeKey = 'leftWidth' | 'rightWidth' | 'centerBottomHeight' | 'rightBottomHeight'

interface PanelSizes {
  leftWidth: number
  rightWidth: number
  centerBottomHeight: number
  rightBottomHeight: number
}

export const LEFT_COLLAPSED_WIDTH = 48

export interface ViewportBounds {
  left: number
  top: number
  width: number
  height: number
}

interface DockingStore {
  widgets: Record<string, DockedWidget>
  panelSizes: PanelSizes
  centerBottomCollapsed: boolean
  leftCollapsed: boolean
  viewportBounds: ViewportBounds | null

  // Actions
  toggleCenterBottomCollapsed: () => void
  toggleLeftCollapsed: () => void
  setLeftCollapsed: (collapsed: boolean) => void
  dockWidget: (widgetId: string, zone: DockZone, order?: number) => void
  undockWidget: (widgetId: string) => void
  moveWidget: (widgetId: string, newZone: DockZone, newOrder: number) => void
  getWidgetsInZone: (zone: DockZone) => DockedWidget[]
  setPanelSize: (key: PanelSizeKey, value: number) => void
  setWidgetPosition: (widgetId: string, x: number, y: number) => void
  getStickyWidgets: () => DockedWidget[]
  setViewportBounds: (bounds: ViewportBounds | null) => void
  /** While dragging a sticky widget, the panel follows the cursor (no separate preview) */
  draggingStickyWidgetId: string | null
  stickyDragPosition: { x: number; y: number } | null
  /** Offset from panel top-left to the point where the user started dragging (so panel doesn't jump) */
  stickyDragOffset: { x: number; y: number } | null
  setStickyDrag: (widgetId: string | null, position: { x: number; y: number } | null, offset?: { x: number; y: number } | null) => void
  /** When true, Properties panel shows only header (no selection) */
  inspectorBodyCollapsed: boolean
  setInspectorBodyCollapsed: (collapsed: boolean) => void
  /** When true, AI Assistant panel shows only header */
  aiAssistantBodyCollapsed: boolean
  setAiAssistantBodyCollapsed: (collapsed: boolean) => void
  /** When true, viewport Cmd+K AI input overlay is open */
  viewportAIInputOpen: boolean
  setViewportAIInputOpen: (open: boolean) => void
  /** Task drawer placement: 'mezzanine' = toolbar icon, 'above-composer' = drawer + queue above composer in collapsed panel, 'menu' = menu style */
  taskDrawerMode: 'mezzanine' | 'above-composer' | 'menu'
  setTaskDrawerMode: (mode: 'mezzanine' | 'above-composer' | 'menu') => void
  /** When taskDrawerMode is 'menu': place Tasks dropdown on 'left', 'center', or 'right' of title */
  taskDrawerMenuSide: 'left' | 'center' | 'right'
  setTaskDrawerMenuSide: (side: 'left' | 'center' | 'right') => void
  /** Chatbot UI: 'tabs' = conversation tabs, 'dropdown' = Tasks header with dropdown list, 'queue' = queue view, 'sidenav' = queue-like UI with a side navigation */
  chatbotUIMode: 'tabs' | 'dropdown' | 'queue' | 'sidenav'
  setChatbotUIMode: (mode: 'tabs' | 'dropdown' | 'queue' | 'sidenav') => void
  /** Dropdown task list status display: 'color' = colored indicators, 'status' = text status, 'none' = no status */
  dropdownTaskListStatusOption: 'color' | 'status' | 'none'
  setDropdownTaskListStatusOption: (option: 'color' | 'status' | 'none') => void
  /** Tabs status display: 'color' = dots, 'status' = checkmark icon, 'none' = only critical indicators */
  tabsStatusOption: 'color' | 'status' | 'none'
  setTabsStatusOption: (option: 'color' | 'status' | 'none') => void
  /** When queue mode: if true, tasks are ephemeral (e.g. not persisted in task list) */
  queueEphemeral: boolean
  setQueueEphemeral: (value: boolean) => void
  /** ID of any widget currently being dragged (sticky or non-sticky) — used for edge drop targets */
  draggingWidgetId: string | null
  setDraggingWidgetId: (id: string | null) => void
  /** Global Nebula mode: 'on' shows Nebula icons/animations, 'off' hides them */
  nebulaMode: 'on' | 'off'
  setNebulaMode: (mode: 'on' | 'off') => void
  /** Whether the right-side settings panel is open */
  settingsPanelOpen: boolean
  setSettingsPanelOpen: (open: boolean) => void
  toggleSettingsPanel: () => void
  /** Omnisearch mode: 'primary-search' or 'primary-assistant' */
  omnisearchMode: 'primary-search' | 'primary-assistant'
  setOmnisearchMode: (mode: 'primary-search' | 'primary-assistant') => void
  /** Assistant panel placement: 'menu' = floating/sticky, 'right' = docked right column */
  assistantPanelMode: 'menu' | 'right'
  setAssistantPanelMode: (mode: 'menu' | 'right') => void
  /** Whether the AI Assistant internal sidebar is open */
  aiSidebarOpen: boolean
  toggleAiSidebar: () => void
  setAiSidebarOpen: (open: boolean) => void
  /** Width of the AI Assistant internal sidebar (clamped 180–320) */
  aiSidebarWidth: number
  setAiSidebarWidth: (width: number) => void
  /** Width of the AI Assistant panel itself (clamped 300–900) */
  aiAssistantWidth: number
  setAiAssistantWidth: (width: number) => void
}

export const useDockingStore = create<DockingStore>((set, get) => ({
  widgets: {
    inspector: { id: 'inspector', zone: 'right-top', order: 0, position: undefined },
    'ai-assistant': { id: 'ai-assistant', zone: 'right-top', order: 1, position: undefined },
    viewport: { id: 'viewport', zone: 'center-top', order: 0 },
    scripting: { id: 'scripting', zone: 'center-top', order: 1 },
  },
  panelSizes: {
    leftWidth: DEFAULT_LEFT_WIDTH,
    rightWidth: DEFAULT_RIGHT_WIDTH,
    centerBottomHeight: DEFAULT_CENTER_BOTTOM_HEIGHT,
    rightBottomHeight: DEFAULT_RIGHT_BOTTOM_HEIGHT,
  },
  centerBottomCollapsed: true,
  leftCollapsed: false,
  viewportBounds: null,

  toggleCenterBottomCollapsed: () => {
    set((state) => ({ centerBottomCollapsed: !state.centerBottomCollapsed }))
  },

  toggleLeftCollapsed: () => {
    set((state) => ({ leftCollapsed: !state.leftCollapsed }))
  },
  setLeftCollapsed: (collapsed) => {
    set({ leftCollapsed: collapsed })
  },

  dockWidget: (widgetId, zone, order) => {
    set((state) => {
      const widgets = { ...state.widgets }
      const existing = widgets[widgetId]

      // If order not specified, add to end of zone
      if (order === undefined) {
        const zoneWidgets = get().getWidgetsInZone(zone)
        order = zoneWidgets.length
      }

      // Clear position when moving to a different zone (position is zone-specific)
      const position = existing?.zone === zone ? existing.position : undefined

      widgets[widgetId] = { id: widgetId, zone, order, position }
      
      // Reorder widgets in the new zone
      const newZoneWidgets = Object.values(widgets)
        .filter((w) => w.zone === zone)
        .sort((a, b) => a.order - b.order)
      
      newZoneWidgets.forEach((w, index) => {
        widgets[w.id] = { ...w, order: index }
      })

      // Keep assistantPanelMode in sync when the AI Assistant is moved via
      // drag-and-drop (or any other direct dockWidget call). 'right-top' is
      // the floating/sticky zone, anything else counts as docked.
      const patch: Partial<DockingStore> = { widgets }
      if (widgetId === 'ai-assistant') {
        patch.assistantPanelMode = zone === 'right-top' ? 'menu' : 'right'
      }

      return patch
    })
  },
  
  undockWidget: (widgetId) => {
    set((state) => {
      const widgets = { ...state.widgets }
      delete widgets[widgetId]
      return { widgets }
    })
  },
  
  moveWidget: (widgetId, newZone, newOrder) => {
    set((state) => {
      const widgets = { ...state.widgets }
      const widget = widgets[widgetId]
      if (!widget) return state
      
      // Remove from old zone
      const oldZoneWidgets = Object.values(widgets)
        .filter((w) => w.zone === widget.zone && w.id !== widgetId)
        .sort((a, b) => a.order - b.order)
      
      // Reorder old zone
      oldZoneWidgets.forEach((w, index) => {
        widgets[w.id] = { ...w, order: index }
      })
      
      // Add to new zone
      const newZoneWidgets = Object.values(widgets)
        .filter((w) => w.zone === newZone && w.id !== widgetId)
        .sort((a, b) => a.order - b.order)
      
      // Insert at newOrder position
      newZoneWidgets.splice(newOrder, 0, { ...widget, zone: newZone, order: newOrder })
      
      // Reorder new zone
      newZoneWidgets.forEach((w, index) => {
        widgets[w.id] = { ...w, order: index }
      })
      
      return { widgets }
    })
  },
  
  getWidgetsInZone: (zone) => {
    return Object.values(get().widgets)
      .filter((w) => w.zone === zone)
      .sort((a, b) => a.order - b.order)
  },

  setPanelSize: (key, value) => {
    const min = key === 'leftWidth' ? 345 : key === 'rightWidth' ? 336 : 120
    const clamped = Math.max(min, value)
    set((state) => ({
      panelSizes: { ...state.panelSizes, [key]: clamped },
    }))
  },

  setWidgetPosition: (widgetId, x, y) => {
    set((state) => {
      const w = state.widgets[widgetId]
      if (!w) return state
      return {
        widgets: { ...state.widgets, [widgetId]: { ...w, position: { x, y } } },
      }
    })
  },

  getStickyWidgets: () => {
    return Object.values(get().widgets)
      .filter((w) => w.zone === 'right-top')
      .sort((a, b) => a.order - b.order)
  },

  setViewportBounds: (bounds) => set({ viewportBounds: bounds }),

  draggingStickyWidgetId: null,
  stickyDragPosition: null,
  stickyDragOffset: null,
  setStickyDrag: (widgetId, position, offset) =>
    set((state) => ({
      draggingStickyWidgetId: widgetId,
      stickyDragPosition: position,
      stickyDragOffset: offset !== undefined ? offset : (position === null ? null : state.stickyDragOffset),
    })),

  inspectorBodyCollapsed: false,
  setInspectorBodyCollapsed: (collapsed) => set({ inspectorBodyCollapsed: collapsed }),
  aiAssistantBodyCollapsed: false,
  setAiAssistantBodyCollapsed: (collapsed) => set({ aiAssistantBodyCollapsed: collapsed }),
  viewportAIInputOpen: false,
  setViewportAIInputOpen: (open) => set({ viewportAIInputOpen: open }),
  taskDrawerMode: 'menu',
  setTaskDrawerMode: (mode) => set({ taskDrawerMode: mode }),
  taskDrawerMenuSide: 'center',
  setTaskDrawerMenuSide: (side) => set({ taskDrawerMenuSide: side }),
  chatbotUIMode: 'sidenav',
  setChatbotUIMode: (mode) => set({ chatbotUIMode: mode }),
  dropdownTaskListStatusOption: 'status',
  setDropdownTaskListStatusOption: (option: 'color' | 'status' | 'none') =>
    set({ dropdownTaskListStatusOption: option }),
  tabsStatusOption: 'status',
  setTabsStatusOption: (option: 'color' | 'status' | 'none') =>
    set({ tabsStatusOption: option }),
  queueEphemeral: false,
  setQueueEphemeral: (value) => set({ queueEphemeral: value }),
  draggingWidgetId: null,
  setDraggingWidgetId: (id) => set({ draggingWidgetId: id }),
  nebulaMode: 'on',
  setNebulaMode: (mode) => set({ nebulaMode: mode }),
  settingsPanelOpen: false,
  setSettingsPanelOpen: (open) => set({ settingsPanelOpen: open }),
  toggleSettingsPanel: () => set((state) => ({ settingsPanelOpen: !state.settingsPanelOpen })),
  omnisearchMode: 'primary-search',
  setOmnisearchMode: (mode) => set({ omnisearchMode: mode }),
  assistantPanelMode: 'menu',
  setAssistantPanelMode: (mode) => {
    set({ assistantPanelMode: mode })
    const state = get()
    if (mode === 'right') {
      state.dockWidget('ai-assistant', 'right-bottom')
      state.setAiAssistantBodyCollapsed(false)
    } else {
      state.dockWidget('ai-assistant', 'right-top')
    }
  },
  aiSidebarOpen: false,
  toggleAiSidebar: () => set((state) => ({ aiSidebarOpen: !state.aiSidebarOpen })),
  setAiSidebarOpen: (open: boolean) => set({ aiSidebarOpen: open }),
  aiSidebarWidth: 220,
  setAiSidebarWidth: (width) => set({ aiSidebarWidth: Math.max(180, Math.min(320, width)) }),
  aiAssistantWidth: 345,
  setAiAssistantWidth: (width) => set({ aiAssistantWidth: Math.max(345, Math.min(900, width)) }),
}))

