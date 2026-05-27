import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Asset } from '../types'
import { localStorageManager } from './utils/localStorage'

const STORAGE_KEY = 'studio-shell-assets'

interface AssetStore {
  assets: Asset[]
  
  // Actions
  importAssets: (files: File[]) => void
  renameAsset: (id: string, newName: string) => void
  createFolder: (name?: string) => string
  moveAssetToFolder: (assetId: string, targetFolderId: string) => void
  setAssets: (assets: Asset[]) => void
}

const generateAssetId = () => {
  return Math.floor(100000000 + Math.random() * 900000000).toString()
}

const generateDateModified = () => {
  const daysAgo = Math.floor(Math.random() * 30)
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(date.getDate()).padStart(2, '0')
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  
  return `${day} ${month} ${year}`
}

// Initial demo assets - extracted to separate function to avoid creating on every import
let cachedInitialAssets: Asset[] | null = null

const getInitialAssets = (): Asset[] => {
  if (cachedInitialAssets) return cachedInitialAssets
  
  cachedInitialAssets = []
  
  return cachedInitialAssets
}

const loadSavedAssets = (): Asset[] => {
  // One-time migration: clear stale demo assets from localStorage
  localStorage.removeItem(STORAGE_KEY)
  return getInitialAssets()
}

// Helper to save assets asynchronously with debouncing
const saveAssets = (assets: Asset[]) => {
  localStorageManager.saveLater(STORAGE_KEY, () => assets)
}

export const useAssetStore = create<AssetStore>((set) => ({
  assets: loadSavedAssets(),
  
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
      
      // Save asynchronously with debouncing
      saveAssets(assets)
      return { assets }
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
      
      // Save asynchronously with debouncing
      saveAssets(assets)
      return { assets }
    })
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
      const newAssets = [...state.assets, newFolder]
      // Save asynchronously with debouncing
      saveAssets(newAssets)
      return { assets: newAssets }
    })
    
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
      
      // Save asynchronously with debouncing
      saveAssets(assets)
      return { assets }
    })
  },

  setAssets: (assets) => {
    set({ assets })
    saveAssets(assets)
  },
}))
