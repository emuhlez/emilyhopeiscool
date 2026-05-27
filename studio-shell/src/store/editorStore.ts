import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { GameObject, Asset, ConsoleMessage, EditorState, GameObjectType, ViewportSelectedAsset, ImportQueueItem } from '../types'

interface EditorStore extends EditorState {
  // Scene hierarchy
  gameObjects: Record<string, GameObject>
  rootObjectIds: string[]
  
  // Assets
  assets: Asset[]

  // Collaborators (hardcoded for now)
  collaborators: Array<{ id: string; name: string }>
  
  // Cached flat asset order for efficient range selection
  _flatAssetOrder: string[]
  
  // Import Queue
  importQueue: ImportQueueItem[]
  
  // Console
  consoleMessages: ConsoleMessage[]
  
  // Reimporting objects
  reimportingObjectIds: string[]
  completingReimportIds: string[]
  
  // Actions - Selection
  selectObject: (id: string | null, options?: { additive?: boolean; range?: boolean }) => void
  selectAsset: (id: string | null, options?: { additive?: boolean; range?: boolean; visibleAssetIds?: string[] }) => void
  setViewportSelectedAsset: (asset: ViewportSelectedAsset | null, options?: { additive?: boolean }) => void
  setAIInputAnchorPosition: (pos: { x: number; y: number } | null) => void
  /** Last drawn point in pen tool (viewport-relative); used to anchor contextual input near recent drawing */
  penToolLastDrawnPosition: { x: number; y: number } | null
  setPenToolLastDrawnPosition: (pos: { x: number; y: number } | null) => void
  /** Shift+click/drag area selection circle (viewport-relative CSS px) */
  areaSelectionCircle: { centerX: number; centerY: number; radius: number } | null
  setAreaSelectionCircle: (circle: { centerX: number; centerY: number; radius: number } | null) => void
  /** When true, viewport will focus camera on selected object(s) on next frame */
  requestFocusSelection: boolean
  setRequestFocusSelection: (v: boolean) => void
  /** When true, the next selection change should NOT insert a pill into the AI input (e.g. double-click to focus) */
  skipPillInsertion: boolean
  setSkipPillInsertion: (v: boolean) => void
  /** Which input activated @-mention picking mode (null = inactive) */
  mentionPickingSource: 'ai-assistant' | 'viewport-input' | null
  setMentionPickingSource: (source: 'ai-assistant' | 'viewport-input' | null) => void
  /** One-shot signal: viewport picked an object for @-mention insertion */
  mentionPickedObject: { id: string; name: string; objectType?: string } | null
  setMentionPickedObject: (obj: { id: string; name: string; objectType?: string } | null) => void
  /** True when the main AI chat is streaming/generating a response */
  aiGenerating: boolean
  setAiGenerating: (v: boolean) => void
  /** When set, viewport plays a particle burst at this position (e.g. when AI creates an object) */
  creationEffectPosition: { x: number; y: number; z: number } | null
  setCreationEffectPosition: (p: { x: number; y: number; z: number } | null) => void
  
  // Actions - Scene
  createGameObject: (type: GameObjectType, name?: string, parentId?: string | null, options?: { select?: boolean }) => string
  /** Batched create: creates object, applies updates, selects, and sets creation effect in a single store update */
  createAndConfigureObject: (type: GameObjectType, name: string, parentId: string | null, updates: Partial<GameObject>, effectPos?: { x: number; y: number; z: number }) => string
  /** Batched update+select: applies updates and selects object in a single store update */
  updateAndSelectObject: (id: string, updates: Partial<GameObject>) => void
  addWorkspaceModel: (name: string) => string
  deleteGameObject: (id: string) => void
  updateGameObject: (id: string, updates: Partial<GameObject>) => void
  /** Set visible: true on all objects that are currently hidden */
  showAllHiddenObjects: () => void
  /** Remove all GLB models (library + user-loaded) from the scene; keeps default scene objects */
  removeAllGlbObjects: () => void
  duplicateGameObject: (id: string) => void
  reparentGameObject: (id: string, newParentId: string | null) => void
  reimportGameObject: (id: string) => void
  
  // Actions - Playmode
  play: () => void
  pause: () => void
  stop: () => void
  
  // Actions - Tools
  setActiveTool: (tool: EditorState['activeTool']) => void
  setSelectMode: (mode: EditorState['selectMode']) => void
  setViewMode: (mode: EditorState['viewMode']) => void
  toggleGrid: () => void
  toggleSnap: () => void
  
  // Actions - Console
  log: (message: string, type?: ConsoleMessage['type'], source?: string) => void
  clearConsole: () => void

  // Actions - Assets
  importAssets: (files: File[]) => void
  addToImportQueue: (files: File[]) => void
  removeFromImportQueue: (id: string) => void
  clearImportQueue: () => void
  processImportQueue: () => void
  updateImportQueueItem: (id: string, updates: Partial<ImportQueueItem>) => void
  renameAsset: (id: string, newName: string) => void
  createFolder: (name?: string) => string
  moveAssetToFolder: (assetId: string, targetFolderId: string) => void
  saveGameObjectAsAsset: (gameObjectId: string, name?: string) => string

  // AI working object indicators (Gap 3)
  aiWorkingObjectIds: Set<string>
  addAIWorkingObject: (id: string) => void
  removeAIWorkingObject: (id: string) => void
  setAiWorkingObjectIds: (ids: Set<string>) => void
  /** Per-object screen positions for in-progress overlay icons */
  aiWorkingObjectPositions: { id: string; x: number; y: number }[]
  setAiWorkingObjectPositions: (pos: { id: string; x: number; y: number }[]) => void

  // Viewport capture for pen tool compositing
  captureViewportScreenshot: (() => string | null) | null
  setCaptureViewportScreenshot: (fn: (() => string | null) | null) => void

  // Screen-to-world raycast for spatial positioning
  screenToWorld: ((screenX: number, screenY: number) => { x: number; y: number; z: number } | null) | null
  setScreenToWorld: (fn: ((screenX: number, screenY: number) => { x: number; y: number; z: number } | null) | null) => void

  // Camera info for spatial context in AI prompts
  getCameraInfo: (() => { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number } | null) | null
  setGetCameraInfo: (fn: (() => { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number } | null) | null) => void
}

const createDefaultTransform = () => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
})

const createDefaultPivot = () => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
})

const generateAssetId = () => {
  // Generate a 9-digit asset ID
  return Math.floor(100000000 + Math.random() * 900000000).toString()
}

const generateDateModified = () => {
  // Generate a date within the last 30 days
  const daysAgo = Math.floor(Math.random() * 30)
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(date.getDate()).padStart(2, '0')
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  
  return `${day} ${month} ${year}`
}

const getDefaultName = (type: GameObjectType) => {
  const names: Record<GameObjectType, string> = {
    empty: 'Empty Object',
    mesh: 'Mesh',
    light: 'Light',
    camera: 'Camera',
    audio: 'Audio Source',
    sprite: 'Sprite',
    tilemap: 'Tilemap',
    particle: 'Particle System',
    script: 'Script',
  }
  return names[type]
}

// Initial demo scene
const createInitialScene = (): { objects: Record<string, GameObject>, rootIds: string[] } => {
  const workspaceId = uuid()
  const cameraId = uuid()
  const lightId = uuid()
  const environmentId = uuid()
  const groundId = uuid()
  const platformId = uuid()

  const objects: Record<string, GameObject> = {
    [workspaceId]: {
      id: workspaceId,
      name: 'Workspace',
      type: 'empty',
      transform: createDefaultTransform(),
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [cameraId, lightId, environmentId],
      parentId: null,
      components: [],
    },
    [cameraId]: {
      id: cameraId,
      name: 'Camera',
      type: 'camera',
      transform: { ...createDefaultTransform(), position: { x: 0, y: 0, z: -10 } },
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [],
      parentId: workspaceId,
      components: [],
    },
    [lightId]: {
      id: lightId,
      name: 'Terrain',
      type: 'light',
      transform: { ...createDefaultTransform(), rotation: { x: 50, y: -30, z: 0 } },
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [],
      parentId: workspaceId,
      components: [],
    },
    [environmentId]: {
      id: environmentId,
      name: 'Drops',
      type: 'empty',
      transform: createDefaultTransform(),
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [groundId, platformId],
      parentId: workspaceId,
      components: [],
    },
    [groundId]: {
      id: groundId,
      name: 'Ground',
      type: 'tilemap',
      transform: { ...createDefaultTransform(), position: { x: 0, y: -3, z: 0 } },
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [],
      parentId: environmentId,
      components: [],
    },
    [platformId]: {
      id: platformId,
      name: 'Platform',
      type: 'mesh',
      transform: { ...createDefaultTransform(), position: { x: 3, y: 1, z: 0 } },
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [],
      parentId: environmentId,
      components: [],
    },
  }

  return {
    objects,
    rootIds: [workspaceId],
  }
}

const initialScene = createInitialScene()

// Always use initial demo assets (don't persist to localStorage)
const loadSavedAssets = (): Asset[] => {
  return initialAssets
}

// Helper to compute flat asset order for efficient range selection
const computeFlatAssetOrder = (assets: Asset[]): string[] => {
  const order: string[] = []
  const walk = (assetList: Asset[]) => {
    assetList.forEach((asset) => {
      order.push(asset.id)
      if (asset.children?.length) walk(asset.children)
    })
  }
  walk(assets)
  return order
}

// Initial demo assets (empty — no preloaded content)
const initialAssets: Asset[] = []

export const useEditorStore = create<EditorStore>((set, get) => {
  const initialAssetList = loadSavedAssets()
  
  return {
  // Initial state
  selectedObjectIds: [],
  selectedAssetIds: [],
  selectedAssetAnchor: null as string | null,
  viewportSelectedAssetNames: [],
  aiInputAnchorPosition: null as { x: number; y: number } | null,
  penToolLastDrawnPosition: null as { x: number; y: number } | null,
  requestFocusSelection: false,
  skipPillInsertion: false,
  mentionPickingSource: null,
  mentionPickedObject: null,
  aiGenerating: false,
  creationEffectPosition: null,
  isPlaying: false,
  isPaused: false,
  activeTool: 'select',
  selectMode: 'single',
  viewMode: '3d',
  showGrid: true,
  snapToGrid: true,
  gridSize: 1,
    
    gameObjects: initialScene.objects,
    rootObjectIds: initialScene.rootIds,
    assets: initialAssetList,
    collaborators: [
      { id: 'collab-david', name: 'David' },
      { id: 'collab-jim', name: 'Jim' },
    ],
    _flatAssetOrder: computeFlatAssetOrder(initialAssetList),
    importQueue: [],
    consoleMessages: [],
    reimportingObjectIds: [],
    completingReimportIds: [],
  
  // Selection
  selectObject: (id, options) => {
    if (id == null) {
      set({ selectedObjectIds: [], viewportSelectedAssetNames: [] })
      return
    }
    const state = get()
    const workspaceId = state.rootObjectIds[0]
    const workspace = state.gameObjects[workspaceId]

    const getFlatTreeOrder = (): string[] => {
      const order: string[] = []
      const walk = (ids: string[]) => {
        ids.forEach((objId) => {
          order.push(objId)
          const obj = state.gameObjects[objId]
          if (obj?.children.length) walk(obj.children)
        })
      }
      walk(state.rootObjectIds)
      return order
    }

    const idsToNames = (ids: string[]) =>
      ids
        .map((objId) => workspace?.children.includes(objId) ? state.gameObjects[objId]?.name : null)
        .filter((n): n is string => n != null)

    if (options?.range && state.selectedObjectIds.length > 0) {
      const flat = getFlatTreeOrder()
      const lastId = state.selectedObjectIds[state.selectedObjectIds.length - 1]
      const lastIdx = flat.indexOf(lastId)
      const clickIdx = flat.indexOf(id)
      if (lastIdx === -1 || clickIdx === -1) {
        set({ selectedObjectIds: [id], viewportSelectedAssetNames: idsToNames([id]) })
        return
      }
      const [lo, hi] = lastIdx < clickIdx ? [lastIdx, clickIdx] : [clickIdx, lastIdx]
      const rangeIds = flat.slice(lo, hi + 1)
      set({ selectedObjectIds: rangeIds, viewportSelectedAssetNames: idsToNames(rangeIds) })
      return
    }

    if (options?.additive) {
      const has = state.selectedObjectIds.includes(id)
      const newIds = has
        ? state.selectedObjectIds.filter((x) => x !== id)
        : [...state.selectedObjectIds, id]
      set({ selectedObjectIds: newIds, viewportSelectedAssetNames: idsToNames(newIds) })
      return
    }

    const isOnlySelection = state.selectedObjectIds.length === 1 && state.selectedObjectIds[0] === id
    if (isOnlySelection) {
      set({ selectedObjectIds: [], viewportSelectedAssetNames: [] })
      return
    }

    set({ selectedObjectIds: [id], viewportSelectedAssetNames: idsToNames([id]) })
  },
  setRequestFocusSelection: (v) => set({ requestFocusSelection: v }),
  setSkipPillInsertion: (v) => set({ skipPillInsertion: v }),
  setMentionPickingSource: (source) => set({ mentionPickingSource: source }),
  setMentionPickedObject: (obj) => set({ mentionPickedObject: obj }),
  setAiGenerating: (v) => set({ aiGenerating: v }),
  setCreationEffectPosition: (p) => set({ creationEffectPosition: p }),
  selectAsset: (id, options) => {
    if (id == null) {
      set({ selectedAssetIds: [], selectedAssetAnchor: null })
      return
    }
    const state = get()

    if (options?.range && state.selectedAssetAnchor) {
      // Use visible asset order for range selection
      const visibleOrder = options.visibleAssetIds || state._flatAssetOrder
      const anchorIdx = visibleOrder.indexOf(state.selectedAssetAnchor)
      const clickIdx = visibleOrder.indexOf(id)
      
      if (anchorIdx === -1 || clickIdx === -1) {
        // If anchor or clicked item not in visible order, fall back to single selection
        set({ selectedAssetIds: [id], selectedAssetAnchor: id })
        return
      }
      
      const [lo, hi] = anchorIdx < clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx]
      const rangeIds = visibleOrder.slice(lo, hi + 1)
      set({ selectedAssetIds: rangeIds })
      return
    }

    if (options?.additive) {
      const has = state.selectedAssetIds.includes(id)
      const newIds = has
        ? state.selectedAssetIds.filter((x) => x !== id)
        : [...state.selectedAssetIds, id]
      // Don't change anchor on additive selection
      set({ selectedAssetIds: newIds })
      return
    }

    // Normal click: set as both selection and anchor
    set({ selectedAssetIds: [id], selectedAssetAnchor: id })
  },
  setViewportSelectedAsset: (asset, options) => {
    if (!asset) {
      set({ viewportSelectedAssetNames: [], selectedObjectIds: [] })
      return
    }
    const state = get()
    const workspaceId = state.rootObjectIds[0]
    const workspace = state.gameObjects[workspaceId]
    const matchingId = workspace?.children.find((cid) => state.gameObjects[cid]?.name === asset.name) ?? null

    const namesToIds = (names: string[]) =>
      names
        .map((name) => workspace?.children.find((cid) => state.gameObjects[cid]?.name === name))
        .filter((id): id is string => id != null)

    if (options?.additive) {
      const has = state.viewportSelectedAssetNames.includes(asset.name)
      const newNames = has
        ? state.viewportSelectedAssetNames.filter((n) => n !== asset.name)
        : [...state.viewportSelectedAssetNames, asset.name]
      const newIds = namesToIds(newNames)
      set({ viewportSelectedAssetNames: newNames, selectedObjectIds: newIds })
      return
    }

    set({
      viewportSelectedAssetNames: [asset.name],
      selectedObjectIds: matchingId ? [matchingId] : [],
    })
  },
  setAIInputAnchorPosition: (pos) => set({ aiInputAnchorPosition: pos }),
  setPenToolLastDrawnPosition: (pos) => set({ penToolLastDrawnPosition: pos }),
  areaSelectionCircle: null,
  setAreaSelectionCircle: (circle) => set({ areaSelectionCircle: circle }),

  // Scene manipulation
  createGameObject: (type, name, parentId = null, options) => {
    const id = uuid()
    const gameObject: GameObject = {
      id,
      name: name || getDefaultName(type),
      type,
      transform: createDefaultTransform(),
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [],
      parentId,
      components: [],
    }
    
    set((state) => {
      const newObjects = { ...state.gameObjects, [id]: gameObject }
      let newRootIds = state.rootObjectIds
      
      if (parentId) {
        const parent = newObjects[parentId]
        if (parent) {
          newObjects[parentId] = {
            ...parent,
            children: [...parent.children, id],
          }
        }
      } else {
        newRootIds = [...state.rootObjectIds, id]
      }
      
      return { gameObjects: newObjects, rootObjectIds: newRootIds, ...(options?.select !== false ? { selectedObjectIds: [id] } : {}) }
    })

    get().log(`Created ${gameObject.name}`, 'info')
    return id
  },

  createAndConfigureObject: (type, name, parentId = null, updates, effectPos) => {
    const id = uuid()
    const gameObject: GameObject = {
      id,
      name: name || getDefaultName(type),
      type,
      transform: createDefaultTransform(),
      pivot: createDefaultPivot(),
      visible: true,
      locked: false,
      children: [],
      parentId,
      components: [],
      ...updates,
    }

    set((state) => {
      const newObjects = { ...state.gameObjects, [id]: gameObject }
      let newRootIds = state.rootObjectIds

      if (parentId) {
        const parent = newObjects[parentId]
        if (parent) {
          newObjects[parentId] = {
            ...parent,
            children: [...parent.children, id],
          }
        }
      } else {
        newRootIds = [...state.rootObjectIds, id]
      }

      return {
        gameObjects: newObjects,
        rootObjectIds: newRootIds,
        selectedObjectIds: [id],
        creationEffectPosition: effectPos ?? null,
      }
    })

    get().log(`Created ${gameObject.name}`, 'info')
    return id
  },

  updateAndSelectObject: (id, updates) => {
    set((state) => {
      const obj = state.gameObjects[id]
      if (!obj) return state
      const newGameObjects = {
        ...state.gameObjects,
        [id]: { ...obj, ...updates },
      }
      // Update viewport selected names if name changed
      let viewportSelectedAssetNames = state.viewportSelectedAssetNames
      if (updates.name != null) {
        const oldName = obj.name
        if (oldName && viewportSelectedAssetNames.includes(oldName)) {
          viewportSelectedAssetNames = viewportSelectedAssetNames.map(
            (n) => (n === oldName ? updates.name as string : n)
          )
        }
      }
      return {
        gameObjects: newGameObjects,
        selectedObjectIds: [id],
        viewportSelectedAssetNames,
      }
    })
  },

  addWorkspaceModel: (name) => {
    const state = get()
    const workspaceId = state.rootObjectIds[0]
    const workspace = state.gameObjects[workspaceId]
    if (!workspace) return ''
    const existing = workspace.children.find((id) => state.gameObjects[id]?.name === name)
    if (existing) return existing
    return get().createGameObject('mesh', name, workspaceId, { select: false })
  },

  deleteGameObject: (id) => {
    const state = get()
    const obj = state.gameObjects[id]
    if (!obj) return

    if (obj.meshUrl) URL.revokeObjectURL(obj.meshUrl)
    
    // Recursively collect all children to delete
    const collectChildren = (objId: string): string[] => {
      const object = state.gameObjects[objId]
      if (!object) return []
      return [objId, ...object.children.flatMap(collectChildren)]
    }
    
    const toDelete = collectChildren(id)
    toDelete.forEach((deleteId) => {
      const o = state.gameObjects[deleteId]
      if (o?.meshUrl) URL.revokeObjectURL(o.meshUrl)
    })
    
    set((state) => {
      const newObjects = { ...state.gameObjects }
      toDelete.forEach((deleteId) => delete newObjects[deleteId])
      
      // Remove from parent's children
      if (obj.parentId && newObjects[obj.parentId]) {
        newObjects[obj.parentId] = {
          ...newObjects[obj.parentId],
          children: newObjects[obj.parentId].children.filter((childId) => childId !== id),
        }
      }
      
      // Remove from root if it was a root object
      const newRootIds = state.rootObjectIds.filter((rootId) => rootId !== id)
      
      return {
        gameObjects: newObjects,
        rootObjectIds: newRootIds,
        selectedObjectIds: state.selectedObjectIds.filter((x) => x !== id),
      }
    })
    
    get().log(`Deleted ${obj.name}`, 'info')
  },
  
  updateGameObject: (id, updates) => {
    set((state) => {
      const newGameObjects = {
        ...state.gameObjects,
        [id]: { ...state.gameObjects[id], ...updates },
      }
      if (updates.name != null) {
        const oldName = state.gameObjects[id]?.name
        if (oldName && state.viewportSelectedAssetNames.includes(oldName)) {
          return {
            gameObjects: newGameObjects,
            viewportSelectedAssetNames: state.viewportSelectedAssetNames.map(
              (n) => (n === oldName ? updates.name as string : n)
            ),
          }
        }
      }
      return { gameObjects: newGameObjects }
    })
  },

  showAllHiddenObjects: () => {
    set((state) => {
      const next = { ...state.gameObjects }
      let changed = false
      for (const id of Object.keys(next)) {
        // Show any object that isn't explicitly visible (handles false or undefined)
        if (next[id].visible !== true) {
          next[id] = { ...next[id], visible: true }
          changed = true
        }
      }
      return changed ? { gameObjects: next } : {}
    })
  },

  removeAllGlbObjects: () => {
    const state = get()
    if (state.rootObjectIds.length === 0) return
    const workspaceId = state.rootObjectIds[0]
    const workspace = state.gameObjects[workspaceId]
    if (!workspace?.children) return
    const keepNames = new Set(['Camera', 'Terrain', 'Drops', 'Ground', 'Platform'])
    const toRemove = workspace.children.filter((id) => {
      const obj = state.gameObjects[id]
      if (!obj) return false
      if (keepNames.has(obj.name)) return false
      const isUserGlb = !!(obj.meshUrl ?? obj.meshFilename ?? obj.importPath)
      const isLibraryMesh = obj.type === 'mesh' && !obj.primitiveType
      return isUserGlb || isLibraryMesh
    })
    toRemove.forEach((id) => get().deleteGameObject(id))
    if (toRemove.length > 0) {
      get().log(`Removed ${toRemove.length} GLB model(s) from scene`, 'info')
    }
  },

  duplicateGameObject: (id) => {
    const state = get()
    const obj = state.gameObjects[id]
    if (!obj) return
    
    const newId = state.createGameObject(obj.type, `${obj.name} (Copy)`, obj.parentId)
    state.updateGameObject(newId, {
      transform: { ...obj.transform },
      pivot: obj.pivot ? { ...obj.pivot } : createDefaultPivot(),
      visible: obj.visible,
      components: [...obj.components],
    })
  },
  
  reparentGameObject: (id, newParentId) => {
    set((state) => {
      const obj = state.gameObjects[id]
      if (!obj) return state
      
      const newObjects = { ...state.gameObjects }
      
      // Remove from old parent
      if (obj.parentId && newObjects[obj.parentId]) {
        newObjects[obj.parentId] = {
          ...newObjects[obj.parentId],
          children: newObjects[obj.parentId].children.filter((childId) => childId !== id),
        }
      }
      
      // Update root IDs
      let newRootIds = state.rootObjectIds.filter((rootId) => rootId !== id)
      
      // Add to new parent
      if (newParentId && newObjects[newParentId]) {
        newObjects[newParentId] = {
          ...newObjects[newParentId],
          children: [...newObjects[newParentId].children, id],
        }
      } else {
        newRootIds = [...newRootIds, id]
      }
      
      // Update object's parent reference
      newObjects[id] = { ...obj, parentId: newParentId }
      
      return { gameObjects: newObjects, rootObjectIds: newRootIds }
    })
  },

  reimportGameObject: (id) => {
    const state = get()
    const obj = state.gameObjects[id]
    if (!obj) return

    // Check if object has an import source or is from assets
    const hasImportSource = obj.importPath || obj.meshUrl || obj.meshFilename
    const isFromAssets = state.assets.some(asset => asset.name === obj.name || asset.children?.some(child => child.name === obj.name))
    
    if (!hasImportSource && !isFromAssets) {
      get().log(`Cannot reimport "${obj.name}": No import source found`, 'warning')
      return
    }

    // Check if already reimporting
    if (state.reimportingObjectIds.includes(id)) {
      return
    }

    // Add to reimporting list
    set((state) => ({
      reimportingObjectIds: [...state.reimportingObjectIds, id]
    }))

    // Log the reimport action
    const source = obj.importPath || obj.meshFilename || (isFromAssets ? `asset: ${obj.name}` : 'unknown source')
    get().log(`Reimporting "${obj.name}" from ${source}`, 'info')
    
    // Simulate reimport process (2-3 seconds)
    setTimeout(() => {
      // Move to completing state (shows frame 4/100%)
      set((state) => ({
        reimportingObjectIds: state.reimportingObjectIds.filter(objId => objId !== id),
        completingReimportIds: [...state.completingReimportIds, id]
      }))
      
      // Remove from completing after brief display
      setTimeout(() => {
        set((state) => ({
          completingReimportIds: state.completingReimportIds.filter(objId => objId !== id)
        }))
        get().log(`Reimported "${obj.name}" successfully`, 'info')
      }, 400)
    }, 2500)
  },
  
  // Playmode
  play: () => {
    set({ isPlaying: true, isPaused: false })
    get().log('Entered Play Mode', 'info', 'Editor')
  },
  pause: () => {
    set({ isPaused: true })
    get().log('Paused', 'info', 'Editor')
  },
  stop: () => {
    set({ isPlaying: false, isPaused: false })
    get().log('Stopped Play Mode', 'info', 'Editor')
  },
  
  // Tools
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectMode: (mode) => set({ selectMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  
  // Console
  log: (message, type = 'log', source) => {
    set((state) => ({
      consoleMessages: [
        ...state.consoleMessages,
        {
          id: uuid(),
          type,
          message,
          timestamp: new Date(),
          source,
        },
      ],
    }))
  },
  clearConsole: () => set({ consoleMessages: [] }),

  // Assets
  addToImportQueue: (files) => {
    const EXCLUDED_EXT = new Set(['.gif', '.pdf'])
    const EXT_TO_TYPE: Record<string, Asset['type']> = {
      '.gltf': 'model', '.glb': 'model', '.fbx': 'model', '.obj': 'model', '.dae': 'model',
      '.mp3': 'audio', '.mp4': 'audio', '.m4a': 'audio', '.wav': 'audio', '.ogg': 'audio', '.aac': 'audio', '.flac': 'audio',
      '.mov': 'video', '.webm': 'video', '.avi': 'video', '.mkv': 'video',
      '.png': 'texture', '.jpg': 'texture', '.jpeg': 'texture', '.webp': 'texture', '.tga': 'texture', '.tif': 'texture', '.tiff': 'texture', '.bmp': 'texture',
      '.js': 'script', '.ts': 'script', '.cjs': 'script', '.mjs': 'script',
      '.mat': 'material',
      '.prefab': 'prefab',
      '.scene': 'scene',
      '.anim': 'animation', '.animset': 'animation',
    }

    const queueItems: ImportQueueItem[] = []
    for (const file of files) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
      if (EXCLUDED_EXT.has(ext)) continue
      const type = EXT_TO_TYPE[ext]
      if (!type) continue
      
      queueItems.push({
        id: uuid(),
        file,
        fileName: file.name,
        filePath: file.webkitRelativePath || `~/Downloads/${file.name}`,
        creator: 'ehopehopehope',
        importPreset: 'Default',
        status: 'pending',
        assetType: type,
      })
    }

    if (queueItems.length > 0) {
      set((state) => ({
        importQueue: [...state.importQueue, ...queueItems]
      }))
      get().log(`Added ${queueItems.length} file(s) to import queue`, 'info')
    }
  },

  removeFromImportQueue: (id) => {
    set((state) => ({
      importQueue: state.importQueue.filter(item => item.id !== id)
    }))
  },

  clearImportQueue: () => {
    set({ importQueue: [] })
    get().log('Cleared import queue', 'info')
  },

  updateImportQueueItem: (id, updates) => {
    set((state) => ({
      importQueue: state.importQueue.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    }))
  },

  processImportQueue: () => {
    const state = get()
    const pendingItems = state.importQueue.filter(item => item.status === 'pending')
    
    if (pendingItems.length === 0) {
      get().log('No pending items in import queue', 'info')
      return
    }

    // Mark items as importing
    set((state) => ({
      importQueue: state.importQueue.map(item =>
        item.status === 'pending' ? { ...item, status: 'importing' as const } : item
      )
    }))

    // Process each item
    pendingItems.forEach((item) => {
      // Simulate import process
      setTimeout(() => {
        const files = [item.file]
        get().importAssets(files)
        
        // Mark as success
        set((state) => ({
          importQueue: state.importQueue.map(qItem =>
            qItem.id === item.id ? { ...qItem, status: 'success' as const, progress: 100 } : qItem
          )
        }))
      }, Math.random() * 1000 + 500) // Random delay 500-1500ms
    })
  },

  importAssets: (files) => {
    const EXCLUDED_EXT = new Set(['.gif', '.pdf'])
    const EXT_TO_TYPE: Record<string, Asset['type']> = {
      '.gltf': 'model', '.glb': 'model', '.fbx': 'model', '.obj': 'model', '.dae': 'model',
      '.mp3': 'audio', '.mp4': 'audio', '.m4a': 'audio', '.wav': 'audio', '.ogg': 'audio', '.aac': 'audio', '.flac': 'audio',
      '.mov': 'video', '.webm': 'video', '.avi': 'video', '.mkv': 'video',
      '.png': 'texture', '.jpg': 'texture', '.jpeg': 'texture', '.webp': 'texture', '.tga': 'texture', '.tif': 'texture', '.tiff': 'texture', '.bmp': 'texture',
      '.js': 'script', '.ts': 'script', '.cjs': 'script', '.mjs': 'script',
      '.mat': 'material',
      '.prefab': 'prefab',
      '.scene': 'scene',
    }
    const TYPE_TO_FOLDER: Record<Asset['type'], string> = {
      texture: 'Sprites', model: 'Models', audio: 'Audio', video: 'Videos',
      script: 'Scripts', material: 'Materials', prefab: 'Prefabs', scene: 'Scenes', folder: 'Sprites', animation: 'Animations',
    }

    const toAdd: { file: File; type: Asset['type'] }[] = []
    for (const file of files) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
      if (EXCLUDED_EXT.has(ext)) continue
      const type = EXT_TO_TYPE[ext]
      if (!type) continue
      toAdd.push({ file, type })
    }
    if (toAdd.length === 0) return

    set((state) => {
      const assets = state.assets.map((a) => ({ ...a, children: a.children ? [...a.children] : [] }))
      const ensureFolder = (name: string): Asset => {
        let folder = assets.find((a) => a.type === 'folder' && a.name === name)
        if (!folder) {
          folder = { id: uuid(), name, type: 'folder', path: `/${name}`, children: [] }
          assets.push(folder)
        }
        return folder
      }

      for (const { file, type } of toAdd) {
        const folderName = TYPE_TO_FOLDER[type]
        const folder = ensureFolder(folderName)
        const path = `${folder.path}/${file.name}`
        const child: Asset = {
          id: uuid(),
          name: file.name,
          type,
          path,
          assetId: generateAssetId(),
          dateModified: generateDateModified(),
        }
        folder.children = [...(folder.children ?? []), child]
      }
      
      // Recompute flat asset order cache
      const flatOrder = computeFlatAssetOrder(assets)
      
      return { assets, _flatAssetOrder: flatOrder }
    })
  },

  renameAsset: (id, newName) => {
    set((state) => {
      const assets = state.assets.map((asset) => {
        // Rename top-level asset
        if (asset.id === id) {
          return { ...asset, name: newName }
        }
        
        // Rename nested asset within folder children
        if (asset.children) {
          const updatedChildren = asset.children.map((child) =>
            child.id === id ? { ...child, name: newName } : child
          )
          return { ...asset, children: updatedChildren }
        }
        
        return asset
      })
      
      // Note: Rename doesn't change asset order, so no need to recompute cache
      return { assets }
    })
    
    get().log(`Renamed asset to "${newName}"`, 'info')
  },

  createFolder: (name = 'New Folder') => {
    const id = uuid()
    const newFolder: Asset = {
      id,
      name,
      type: 'folder',
      path: `/${name}`,
      children: [],
      dateModified: generateDateModified(),
    }
    
    set((state) => {
      const assets = [...state.assets, newFolder]
      const flatOrder = computeFlatAssetOrder(assets)
      return { assets, _flatAssetOrder: flatOrder }
    })
    
    get().log(`Created folder "${name}"`, 'info')
    return id
  },

  moveAssetToFolder: (assetId, targetFolderId) => {
    set((state) => {
      const assets = state.assets.map(asset => ({ ...asset, children: asset.children ? [...asset.children] : [] }))
      
      // Find the asset to move
      let assetToMove: Asset | undefined
      
      // Check if it's a top-level asset
      const topLevelIndex = assets.findIndex(a => a.id === assetId)
      if (topLevelIndex !== -1) {
        assetToMove = assets[topLevelIndex]
        assets.splice(topLevelIndex, 1)
      } else {
        // Check if it's in a folder's children
        for (const folder of assets) {
          if (folder.children) {
            const childIndex = folder.children.findIndex(c => c.id === assetId)
            if (childIndex !== -1) {
              assetToMove = folder.children[childIndex]
              folder.children.splice(childIndex, 1)
              break
            }
          }
        }
      }
      
      // If asset found, add it to target folder
      if (assetToMove) {
        const targetFolder = assets.find(a => a.id === targetFolderId)
        if (targetFolder && targetFolder.type === 'folder') {
          targetFolder.children = [...(targetFolder.children || []), assetToMove]
        }
      }
      
      // Recompute flat asset order cache
      const flatOrder = computeFlatAssetOrder(assets)
      
      return { assets, _flatAssetOrder: flatOrder }
    })
    
    const asset = get().assets.find(a => a.id === assetId) || 
                  get().assets.flatMap(a => a.children || []).find(c => c.id === assetId)
    const folder = get().assets.find(a => a.id === targetFolderId)
    
    if (asset && folder) {
      get().log(`Moved "${asset.name}" to "${folder.name}"`, 'info')
    }
  },

  // AI working object indicators (Gap 3)
  aiWorkingObjectIds: new Set<string>(),
  addAIWorkingObject: (id) => {
    set((state) => {
      const next = new Set(state.aiWorkingObjectIds)
      next.add(id)
      return { aiWorkingObjectIds: next }
    })
  },
  removeAIWorkingObject: (id) => {
    set((state) => {
      const next = new Set(state.aiWorkingObjectIds)
      next.delete(id)
      return { aiWorkingObjectIds: next }
    })
  },
  setAiWorkingObjectIds: (ids) => set({ aiWorkingObjectIds: ids }),
  aiWorkingObjectPositions: [],
  setAiWorkingObjectPositions: (pos) => set({ aiWorkingObjectPositions: pos }),

  // Viewport capture for pen tool compositing
  captureViewportScreenshot: null,
  setCaptureViewportScreenshot: (fn) => set({ captureViewportScreenshot: fn }),

  // Screen-to-world raycast for spatial positioning
  screenToWorld: null,
  setScreenToWorld: (fn) => set({ screenToWorld: fn }),

  // Camera info for spatial context
  getCameraInfo: null,
  setGetCameraInfo: (fn) => set({ getCameraInfo: fn }),

  saveGameObjectAsAsset: (gameObjectId, name) => {
    const state = get()
    const gameObject = state.gameObjects[gameObjectId]
    
    if (!gameObject) return ''
    
    const assetName = name || gameObject.name
    const assetId = uuid()
    
    // Create a prefab asset from the game object
    const newAsset: Asset = {
      id: assetId,
      name: assetName,
      type: 'prefab',
      path: `/Prefabs/${assetName}.prefab`,
      assetId: generateAssetId(),
      dateModified: generateDateModified(),
    }
    
    // Find or create Prefabs folder
    set((state) => {
      const assets = [...state.assets]
      let prefabsFolder = assets.find(a => a.type === 'folder' && a.name === 'Prefabs')
      
      if (!prefabsFolder) {
        // Create Prefabs folder if it doesn't exist
        prefabsFolder = {
          id: uuid(),
          name: 'Prefabs',
          type: 'folder',
          path: '/Prefabs',
          children: [newAsset],
          dateModified: generateDateModified(),
        }
        assets.push(prefabsFolder)
      } else {
        // Add to existing Prefabs folder
        prefabsFolder.children = [...(prefabsFolder.children || []), newAsset]
      }
      
      // Recompute flat asset order cache
      const flatOrder = computeFlatAssetOrder(assets)
      
      return { assets, _flatAssetOrder: flatOrder }
    })
    
    get().log(`Saved "${assetName}" as prefab`, 'info')
    return assetId
  },
}})





