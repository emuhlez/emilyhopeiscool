import { useRef, useEffect, useLayoutEffect, memo } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { useEditorStore } from '../../store/editorStore'
import {
  THREE_SPACE_ASSETS,
  assetUrl,
} from './threeSpaceAssets'
import { createNoise2D, fbm2D } from '../../utils/perlin-noise'
import { publicUrl } from '../../utils/assetUrl'
import type { TerrainData } from '../../types'
import styles from './Viewport.module.css'

const GRID_COLS = 6
const CELL_SPACING = 4
const MODEL_SCALE = 2
const CAMERA_FAR = 2000
const CAMERA_NEAR = 0.1
const CAMERA_FOV = 50

const ORBIT_SENSITIVITY = 0.004
const ZOOM_SENSITIVITY = 0.001
/** macOS/iOS use "natural" scroll; invert vertical orbit so drag-up = tilt view up */
const VERTICAL_ORBIT_INVERTED =
  typeof navigator !== 'undefined' &&
  (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
    (navigator as { userAgentData?: { platform: string } }).userAgentData?.platform === 'macOS')
const MIN_RADIUS = 8
const MAX_RADIUS = 400
const MIN_PHI = 0.05
const MAX_PHI = Math.PI - 0.05
const DRAG_THRESHOLD_PX = 4
const PAN_SPEED = 0.35
const CREATION_PARTICLE_COUNT = 140
const CREATION_EFFECT_DURATION_MS = 1800
const CREATION_BURST_SPEED = 5
const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'r', 'f'])
const FP_MOVE_SPEED = 8
const FP_MOUSE_SENSITIVITY = 0.002
const FP_EYE_HEIGHT = 1.6
const FP_CAMERA_DISTANCE = 6
const FP_CAMERA_HEIGHT = 2
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0)
const INITIAL_RADIUS = Math.sqrt(40 * 40 + 35 * 35 + 40 * 40)
const INITIAL_THETA = Math.atan2(40, 40)
const INITIAL_PHI = Math.acos(Math.max(-1, Math.min(1, 35 / INITIAL_RADIUS)))

function getAssetDisplayName(filename: string): string {
  return filename.replace(/\.glb$/i, '')
}

function findRootWithAssetName(obj: THREE.Object3D, modelsGroup: THREE.Group): THREE.Object3D | null {
  let current: THREE.Object3D | null = obj
  while (current) {
    if (current.userData.assetName != null) return current
    if (current.parent === modelsGroup) return current
    current = current.parent
  }
  return null
}

function createAvatarPlaceholder(): THREE.Group {
  const group = new THREE.Group()
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8)
  const headGeo = new THREE.SphereGeometry(0.32, 12, 12)
  const material = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.1 })
  const body = new THREE.Mesh(bodyGeo, material)
  body.position.y = 0.45
  body.castShadow = body.receiveShadow = true
  group.add(body)
  const head = new THREE.Mesh(headGeo, material)
  head.position.y = 1.1
  head.castShadow = head.receiveShadow = true
  group.add(head)
  group.userData.isAvatar = true
  return group
}

function setHighlight(root: THREE.Object3D, on: boolean) {
  root.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      
      materials.forEach((mat) => {
        if (mat && (mat as THREE.MeshStandardMaterial).emissive !== undefined) {
          const m = mat as THREE.MeshStandardMaterial
          if (on) {
            // Store original emissive if not already highlighted
            if (!mesh.userData.isHighlighted) {
              mesh.userData.originalEmissive = m.emissive.getHex()
              mesh.userData.originalEmissiveIntensity = m.emissiveIntensity
              mesh.userData.isHighlighted = true
            }
            // Set blue emissive glow
            m.emissive.setHex(0x3498db)
            m.emissiveIntensity = 0.6
            m.needsUpdate = true
          } else {
            // Restore original emissive
            if (mesh.userData.isHighlighted) {
              m.emissive.setHex(mesh.userData.originalEmissive || 0x000000)
              m.emissiveIntensity = mesh.userData.originalEmissiveIntensity || 0
              m.needsUpdate = true
              // Clear stored values
              mesh.userData.isHighlighted = false
              delete mesh.userData.originalEmissive
              delete mesh.userData.originalEmissiveIntensity
            }
          }
        }
      })
    }
  })
}

/** Orange emissive glow for AI-manipulated objects (Gap 3).
 *  Uses separate userData keys to avoid conflicts with selection highlight. */
function setWorkingHighlight(root: THREE.Object3D, on: boolean) {
  root.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

      materials.forEach((mat) => {
        if (mat && (mat as THREE.MeshStandardMaterial).emissive !== undefined) {
          const m = mat as THREE.MeshStandardMaterial
          if (on) {
            if (!mesh.userData.isWorkingHighlighted) {
              mesh.userData.savedEmissive = m.emissive.getHex()
              mesh.userData.savedEmissiveIntensity = m.emissiveIntensity
              mesh.userData.isWorkingHighlighted = true
            }
            m.emissive.setHex(0xff8800)
            m.emissiveIntensity = 0.7
            m.needsUpdate = true
          } else {
            if (mesh.userData.isWorkingHighlighted) {
              // If also selection-highlighted, restore to selection values instead
              if (mesh.userData.isHighlighted) {
                m.emissive.setHex(0x3498db)
                m.emissiveIntensity = 0.6
              } else {
                m.emissive.setHex(mesh.userData.savedEmissive || 0x000000)
                m.emissiveIntensity = mesh.userData.savedEmissiveIntensity || 0
              }
              m.needsUpdate = true
              mesh.userData.isWorkingHighlighted = false
              delete mesh.userData.savedEmissive
              delete mesh.userData.savedEmissiveIntensity
            }
          }
        }
      })
    }
  })
}

// --- Terrain generation helpers ---

/** Biome color palettes: array of [normalizedHeight, r, g, b] stops (0-1). */
const BIOME_PALETTES: Record<string, [number, number, number, number][]> = {
  grass: [
    [0.0, 0.18, 0.32, 0.16],  // dark green (valleys)
    [0.3, 0.24, 0.50, 0.18],  // medium green
    [0.6, 0.45, 0.62, 0.25],  // light green (slopes)
    [0.8, 0.55, 0.50, 0.30],  // brown-green (high slopes)
    [1.0, 0.65, 0.60, 0.50],  // tan/rock (peaks)
  ],
  desert: [
    [0.0, 0.76, 0.60, 0.38],  // dark sand (low)
    [0.3, 0.85, 0.72, 0.48],  // medium sand
    [0.6, 0.92, 0.80, 0.55],  // light sand
    [0.8, 0.80, 0.65, 0.42],  // darker ridge
    [1.0, 0.95, 0.88, 0.70],  // bright sand (peaks)
  ],
  snow: [
    [0.0, 0.35, 0.45, 0.35],  // dark green-gray (valleys)
    [0.25, 0.50, 0.55, 0.50], // gray-green
    [0.5, 0.65, 0.65, 0.65],  // gray rock
    [0.75, 0.85, 0.88, 0.90], // light snow
    [1.0, 0.95, 0.97, 1.0],   // bright white (peaks)
  ],
  rocky: [
    [0.0, 0.30, 0.28, 0.25],  // dark stone
    [0.3, 0.42, 0.40, 0.38],  // medium gray
    [0.6, 0.55, 0.52, 0.48],  // light gray
    [0.8, 0.48, 0.45, 0.40],  // brown-gray
    [1.0, 0.62, 0.58, 0.52],  // pale stone (peaks)
  ],
  volcanic: [
    [0.0, 0.60, 0.20, 0.05],  // lava orange (low)
    [0.15, 0.45, 0.10, 0.03], // dark red-orange
    [0.35, 0.18, 0.14, 0.12], // dark basalt
    [0.7, 0.25, 0.22, 0.20],  // medium basalt
    [1.0, 0.15, 0.12, 0.10],  // dark peak
  ],
}

function sampleBiomeColor(biome: string, t: number): [number, number, number] {
  const palette = BIOME_PALETTES[biome] ?? BIOME_PALETTES.grass
  if (t <= palette[0][0]) return [palette[0][1], palette[0][2], palette[0][3]]
  for (let i = 1; i < palette.length; i++) {
    if (t <= palette[i][0]) {
      const prev = palette[i - 1]
      const curr = palette[i]
      const f = (t - prev[0]) / (curr[0] - prev[0])
      return [
        prev[1] + (curr[1] - prev[1]) * f,
        prev[2] + (curr[2] - prev[2]) * f,
        prev[3] + (curr[3] - prev[3]) * f,
      ]
    }
  }
  const last = palette[palette.length - 1]
  return [last[1], last[2], last[3]]
}

function createTerrainGeometry(td: TerrainData): THREE.BufferGeometry {
  const { width, depth, heightScale, segments, seed, octaves, biome } = td
  const noise = createNoise2D(seed)

  // Create a plane in XZ orientation directly
  const geo = new THREE.PlaneGeometry(width, depth, segments, segments)
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const vertexCount = posAttr.count

  // PlaneGeometry is in XY by default — rotate vertices to XZ
  // (swap Y and Z, then negate new Z to maintain winding order)
  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i)
    const y = posAttr.getY(i)
    posAttr.setXYZ(i, x, 0, -y)
  }

  // Displace vertices along Y with fBm noise
  // Track min/max height for color normalization
  let minH = Infinity
  let maxH = -Infinity
  const heights = new Float32Array(vertexCount)
  const noiseScale = 0.15 // Controls how "zoomed in" the noise is

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i)
    const z = posAttr.getZ(i)
    const h = fbm2D(noise, x * noiseScale, z * noiseScale, octaves) * heightScale
    heights[i] = h
    if (h < minH) minH = h
    if (h > maxH) maxH = h
  }

  // Shift all vertices up so even the lowest dip is above the grid (y=0)
  const lift = -minH + 0.15
  for (let i = 0; i < vertexCount; i++) {
    heights[i] += lift
    posAttr.setY(i, heights[i])
  }
  maxH += lift
  minH = 0.15

  // Apply vertex colors based on normalized height
  const range = maxH - minH || 1
  const colors = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i++) {
    const t = (heights[i] - minH) / range
    const [r, g, b] = sampleBiomeColor(biome, t)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  geo.computeVertexNormals()
  return geo
}

/** Serialize terrainData to a simple comparison key for change detection.
 *  Bump TERRAIN_GEO_VERSION when the geometry algorithm changes to force rebuild. */
const TERRAIN_GEO_VERSION = 2
function terrainDataKey(td: TerrainData): string {
  return `v${TERRAIN_GEO_VERSION}_${td.width}_${td.depth}_${td.heightScale}_${td.segments}_${td.seed}_${td.octaves}_${td.biome}`
}

export const Viewport3D = memo(function Viewport3D({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const modelsGroupRef = useRef<THREE.Group | null>(null)
  const avatarRef = useRef<THREE.Group | null>(null)
  const frameRef = useRef<number>(0)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const resetViewRef = useRef(false)
  const focusSelectedRef = useRef(false)
  const needsRenderRef = useRef(false)
  const isPlayingRef = useRef(false)
  const wasPlayingRef = useRef(false)
  const fpInitializedRef = useRef(false)
  const mouseDeltaXRef = useRef(0)
  const mouseDeltaYRef = useRef(0)
  const lastPointerXRef = useRef(0)
  const lastPointerYRef = useRef(0)
  const initializedRef = useRef(false)
  const creationEffectRef = useRef<{
    position: { x: number; y: number; z: number }
    startTime: number
    points: THREE.Points | null
    geometry: THREE.BufferGeometry | null
    velocities: Float32Array
  } | null>(null)
  const resizeTimeoutRef = useRef<number | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const eventHandlersRef = useRef<{
    onPointerDown?: (e: PointerEvent) => void
    onPointerMove?: (e: PointerEvent) => void
    onPointerUp?: (e: PointerEvent) => void
    onPointerEnter?: () => void
    onPointerLeave?: () => void
    onWheel?: (e: WheelEvent) => void
    onDblClick?: (e: MouseEvent) => void
    onKeyDown?: (e: KeyboardEvent) => void
    onKeyUp?: (e: KeyboardEvent) => void
    onResize?: () => void
    wheelOpts?: AddEventListenerOptions
  }>({})
  const transformControlsRef = useRef<InstanceType<typeof TransformControls> | null>(null)
  const transformControlsDraggingRef = useRef(false)
  
  // Store function refs to keep stable references
  const setViewportSelectedAssetRef = useRef(useEditorStore.getState().setViewportSelectedAsset)
  const addWorkspaceModelRef = useRef(useEditorStore.getState().addWorkspaceModel)
  const updateGameObjectRef = useRef(useEditorStore.getState().updateGameObject)
  const setAIInputAnchorPositionRef = useRef(useEditorStore.getState().setAIInputAnchorPosition)
  const setAiWorkingObjectPositionsRef = useRef(useEditorStore.getState().setAiWorkingObjectPositions)
  const setAreaSelectionCircleRef = useRef(useEditorStore.getState().setAreaSelectionCircle)
  const setMentionPickedObjectRef = useRef(useEditorStore.getState().setMentionPickedObject)

  useEffect(() => {
    setViewportSelectedAssetRef.current = useEditorStore.getState().setViewportSelectedAsset
    addWorkspaceModelRef.current = useEditorStore.getState().addWorkspaceModel
    updateGameObjectRef.current = useEditorStore.getState().updateGameObject
    setAIInputAnchorPositionRef.current = useEditorStore.getState().setAIInputAnchorPosition
    setAiWorkingObjectPositionsRef.current = useEditorStore.getState().setAiWorkingObjectPositions
    setAreaSelectionCircleRef.current = useEditorStore.getState().setAreaSelectionCircle
    setMentionPickedObjectRef.current = useEditorStore.getState().setMentionPickedObject
  })

  const viewportSelectedAssetNames = useEditorStore((s) => s.viewportSelectedAssetNames)
  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds)
  const activeTool = useEditorStore((s) => s.activeTool)
  const mentionPickingSource = useEditorStore((s) => s.mentionPickingSource)
  const gameObjects = useEditorStore((s) => s.gameObjects)
  const rootObjectIds = useEditorStore((s) => s.rootObjectIds)

  // Track previous gameObjects for diff-based scene sync
  const prevGameObjectsRef = useRef<typeof gameObjects>(gameObjects)
  const isPlaying = useEditorStore((s) => s.isPlaying)

  useEffect(() => {
    const wasPlaying = isPlayingRef.current
    isPlayingRef.current = isPlaying
    if (!isPlaying) {
      document.exitPointerLock()
      fpInitializedRef.current = false
      wasPlayingRef.current = wasPlaying
    }
  }, [isPlaying])
  const loadedMeshUrlsRef = useRef<Record<string, string>>({})

  useLayoutEffect(() => {
    console.log('[Viewport3D] useLayoutEffect triggered')
    const container = containerRef.current
    if (!container) {
      console.warn('[Viewport3D] Container ref not ready')
      return
    }
    
    console.log('[Viewport3D] Container found', {
      width: container.clientWidth,
      height: container.clientHeight,
      display: window.getComputedStyle(container).display,
      visibility: window.getComputedStyle(container).visibility,
      initializedFlag: initializedRef.current,
      hasRenderer: !!rendererRef.current,
      hasScene: !!sceneRef.current,
      hasCamera: !!cameraRef.current
    })
    
    if (!container.clientWidth || !container.clientHeight) {
      console.warn('[Viewport3D] Container has no dimensions - scheduling retry')
      // Retry after a short delay to allow layout to complete
      const retryTimer = window.setTimeout(() => {
        if (containerRef.current && containerRef.current.clientWidth > 0) {
          console.log('[Viewport3D] Retry successful, triggering re-render')
          needsRenderRef.current = true
        }
      }, 100)
      return () => clearTimeout(retryTimer)
    }
    
    // Check if initialization was started but not completed
    if (initializedRef.current) {
      // If flag is true but refs aren't set, initialization failed - retry
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        console.warn('[Viewport3D] Initialization flag set but refs missing - retrying initialization')
        initializedRef.current = false
        // Clean up any partial refs
        rendererRef.current?.dispose()
        rendererRef.current = null
        sceneRef.current = null
        cameraRef.current = null
        modelsGroupRef.current = null
      } else {
        console.log('[Viewport3D] Already initialized and refs valid, skipping')
        return
      }
    }
    
    // Double-check refs aren't somehow set without flag
    if (rendererRef.current || sceneRef.current || cameraRef.current) {
      console.warn('[Viewport3D] Refs are set but flag is false - cleaning up stale refs')
      rendererRef.current?.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      modelsGroupRef.current = null
    }

    console.log('[Viewport3D] ✅ Starting Three.js initialization', {
      width: container.clientWidth,
      height: container.clientHeight
    })
    
    // Set flag immediately to prevent double initialization in React strict mode
    initializedRef.current = true
    
    try {
      const width = container.clientWidth
      const height = container.clientHeight

      console.log('[Viewport3D] Creating scene...')
      const scene = new THREE.Scene()
      sceneRef.current = scene
      console.log('[Viewport3D] Scene created ✓')

    // Create skybox with blue sky gradient
    const skyGeometry = new THREE.SphereGeometry(CAMERA_FAR * 0.9, 32, 32)
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1E88E5) }, // Bright sky blue
        bottomColor: { value: new THREE.Color(0xE8F4FD) }, // Very pale blue/white horizon
        offset: { value: 0.4 },
        exponent: { value: 0.8 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = max(pow(max(h + offset, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `
    })
    const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial)
    skyMesh.renderOrder = -1 // Render first
    scene.add(skyMesh)

    console.log('[Viewport3D] Creating camera...')
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR)
    camera.position.set(40, 35, 40)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera
    console.log('[Viewport3D] Camera created ✓')

    const target = new THREE.Vector3(0, 0, 0)
    let radius = camera.position.distanceTo(target)
    let theta = Math.atan2(camera.position.x - target.x, camera.position.z - target.z)
    let phi = Math.acos(Math.max(-1, Math.min(1, (camera.position.y - target.y) / radius)))

    const updateCameraFromOrbit = () => {
      camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta)
      camera.position.y = target.y + radius * Math.cos(phi)
      camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta)
      camera.lookAt(target)
    }

    console.log('[Viewport3D] Creating renderer...')
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: 'high-performance', // Optimize for performance on Safari/Arc
      stencil: false, // Disable stencil buffer for better performance
    })
    renderer.setSize(width, height)
    // Limit pixel ratio to 1.5 for better performance on Retina displays (Safari/Arc)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Environment map for realistic reflections on metallic/glossy materials
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture
    scene.environment = envTexture
    pmremGenerator.dispose()

    console.log('[Viewport3D] Renderer created ✓')

    const canvas = renderer.domElement
    canvasRef.current = canvas
    canvas.className = styles.viewport3dCanvas
    canvas.style.pointerEvents = 'auto'
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('title', 'Viewport — F: focus on selected object, R: reset view')
    canvas.setAttribute('data-viewport-canvas', '1')

    const keysPressed = new Set<string>()
    let lastPanTime = performance.now()

    const wrapper = document.createElement('div')
    wrapperRef.current = wrapper
    wrapper.className = styles.canvas3DInner
    wrapper.style.pointerEvents = 'none'
    wrapper.appendChild(canvas)
    container.appendChild(wrapper)
    ;(canvas as HTMLCanvasElement).style.pointerEvents = 'auto'
    ;(canvas as HTMLCanvasElement).style.cursor = 'grab'

    const enforceCanvasLock = () => {
      canvas.style.setProperty('inset', '0', 'important')
    }
    enforceCanvasLock()

    rendererRef.current = renderer

    // Register viewport screenshot capture for pen tool compositing
    useEditorStore.getState().setCaptureViewportScreenshot(() => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null
      rendererRef.current.render(sceneRef.current, cameraRef.current)
      return rendererRef.current.domElement.toDataURL('image/png')
    })

    // Register screen-to-world raycast for spatial positioning
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    useEditorStore.getState().setScreenToWorld((screenX: number, screenY: number) => {
      const cam = cameraRef.current
      const group = modelsGroupRef.current
      const cont = containerRef.current
      if (!cam || !cont) return null

      const rect = cont.getBoundingClientRect()
      const ndcX = (screenX / rect.width) * 2 - 1
      const ndcY = -(screenY / rect.height) * 2 + 1

      const rc = raycasterRef.current
      rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam)

      // Try intersecting scene objects first
      if (group) {
        const hits = rc.intersectObjects(group.children, true)
        if (hits.length > 0) {
          const p = hits[0].point
          return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100 }
        }
      }

      // Fall back to ground plane at y=0
      const intersection = new THREE.Vector3()
      const hit = rc.ray.intersectPlane(groundPlane, intersection)
      if (hit) {
        return { x: Math.round(intersection.x * 100) / 100, y: Math.round(intersection.y * 100) / 100, z: Math.round(intersection.z * 100) / 100 }
      }

      return null
    })

    // Register camera info getter for AI spatial context
    useEditorStore.getState().setGetCameraInfo(() => {
      const cam = cameraRef.current
      if (!cam) return null
      const r = (v: number) => Math.round(v * 100) / 100
      return {
        position: { x: r(cam.position.x), y: r(cam.position.y), z: r(cam.position.z) },
        target: { x: r(target.x), y: r(target.y), z: r(target.z) },
        fov: cam.fov,
      }
    })

    // Transform controls (move / rotate / scale) for selected objects
    const RAD2DEG = 180 / Math.PI
    const transformControls = new TransformControls(camera, canvas)
    transformControls.addEventListener('objectChange', () => {
      const obj = transformControls.object as THREE.Object3D | undefined
      if (!obj) return
      const objectId = obj.userData.objectId as string | undefined
      if (!objectId) return
      const baseScale = (obj.userData.baseScale as number) ?? 1
      const position = { x: obj.position.x, y: obj.position.y, z: obj.position.z }
      const rotation = {
        x: obj.rotation.x * RAD2DEG,
        y: obj.rotation.y * RAD2DEG,
        z: obj.rotation.z * RAD2DEG,
      }
      const scale = {
        x: obj.scale.x / baseScale,
        y: obj.scale.y / baseScale,
        z: obj.scale.z / baseScale,
      }
      updateGameObjectRef.current(objectId, { transform: { position, rotation, scale } })
    })
    transformControls.addEventListener('mouseDown', () => {
      transformControlsDraggingRef.current = true
    })
    transformControls.addEventListener('mouseUp', () => {
      transformControlsDraggingRef.current = false
    })
    scene.add(transformControls.getHelper())
    transformControlsRef.current = transformControls

    // Lights – brighter setup so assets are well lit
    const ambient = new THREE.AmbientLight(0xa0a0b8, 0.95)
    scene.add(ambient)
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x8888aa, 0.55)
    scene.add(hemisphere)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
    dirLight.position.set(25, 45, 25)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 200
    dirLight.shadow.camera.left = -50
    dirLight.shadow.camera.right = 50
    dirLight.shadow.camera.top = 50
    dirLight.shadow.camera.bottom = -50
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5)
    fillLight.position.set(-20, 15, 10)
    scene.add(fillLight)

    // Floor: plane for shadows + line grid for reference (always visible, no texture required)
    const gridSize = 72
    const gridDivisions = 36 // lines per axis (1 unit spacing at 72/36 = 2)
    const floorGeometry = new THREE.PlaneGeometry(gridSize, gridSize)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x3c3e44,
      roughness: 0.9,
      metalness: 0.05,
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    floor.receiveShadow = true
    scene.add(floor)

    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x9a9ca6, 0x6c6e78)
    gridHelper.position.y = 0.01 // Slightly above floor to avoid z-fight
    scene.add(gridHelper)

    const textureLoader = new THREE.TextureLoader()
    const gridTextureUrl = `${publicUrl('textures/grid-floor.png')}?v=${Date.now()}`
    textureLoader.load(
      gridTextureUrl,
      (gridTexture) => {
        gridTexture.wrapS = THREE.RepeatWrapping
        gridTexture.wrapT = THREE.RepeatWrapping
        gridTexture.repeat.set(18, 18)
        gridTexture.colorSpace = THREE.SRGBColorSpace
        floorMaterial.map = gridTexture
        floorMaterial.needsUpdate = true
      },
      undefined,
      () => {
        // Texture failed; floor + GridHelper still give a clear reference grid
      }
    )

    // Area selection circle — 3D disc on the ground plane
    const areaCircleGroup = new THREE.Group()
    areaCircleGroup.visible = false
    areaCircleGroup.position.y = 0.02
    areaCircleGroup.rotation.x = -Math.PI / 2
    const areaFillGeo = new THREE.CircleGeometry(1, 64)
    const areaFillMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    areaCircleGroup.add(new THREE.Mesh(areaFillGeo, areaFillMat))
    const areaRingGeo = new THREE.RingGeometry(0.96, 1, 64)
    const areaRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    areaCircleGroup.add(new THREE.Mesh(areaRingGeo, areaRingMat))
    scene.add(areaCircleGroup)

    const loader = new GLTFLoader()
    const modelsGroup = new THREE.Group()
    scene.add(modelsGroup)
    modelsGroupRef.current = modelsGroup

    // Declare needsRender early so model loading can access it
    let needsRender = true

    function placeModel(index: number): { x: number; z: number } {
      const col = index % GRID_COLS
      const row = Math.floor(index / GRID_COLS)
      const x = (col - (GRID_COLS - 1) / 2) * CELL_SPACING
      const z = row * CELL_SPACING
      return { x, z }
    }

    function fitScale(obj: THREE.Object3D): number {
      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim <= 0) return 1
      return MODEL_SCALE / maxDim
    }

    // Optimized model loading with better batching
    // Load models in batches with controlled concurrency
    let loadedCount = 0
    let activeLoads = 0

    const loadNextModel = (index: number) => {
      if (index >= THREE_SPACE_ASSETS.length) return
      
      activeLoads++
      const filename = THREE_SPACE_ASSETS[index]
      const url = assetUrl(filename)
      
      loader.load(
        url,
        (gltf: { scene: THREE.Group }) => {
          const root = gltf.scene
          const displayName = getAssetDisplayName(filename)
          const objId = addWorkspaceModelRef.current(displayName)
          root.userData.assetName = displayName
          root.userData.objectId = objId
          root.userData.isLibraryModel = true
          const storeObj = useEditorStore.getState().gameObjects[objId]
          root.visible = storeObj?.visible !== false
          root.traverse((node: THREE.Object3D) => {
            if ((node as THREE.Mesh).isMesh) {
              (node as THREE.Mesh).castShadow = true
              ;(node as THREE.Mesh).receiveShadow = true
            }
          })
          const baseScale = fitScale(root)
          root.userData.baseScale = baseScale
          const { x, z } = placeModel(index)
          updateGameObjectRef.current(objId, {
            transform: {
              position: { x, y: 0, z },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
            },
          })
          root.position.set(x, 0, z)
          root.scale.setScalar(baseScale)
          modelsGroup.add(root)
          needsRender = true
          
          activeLoads--
          loadedCount++
          
          // Load next model if available
          if (loadedCount + activeLoads < THREE_SPACE_ASSETS.length) {
            loadNextModel(loadedCount + activeLoads)
          }
        },
        undefined,
        () => {
          activeLoads--
          // On error, try loading next model
          if (loadedCount + activeLoads < THREE_SPACE_ASSETS.length) {
            loadNextModel(loadedCount + activeLoads)
          }
        }
      )
    }
    
    // Default library GLBs disabled — scene starts empty of preloaded models
    // const initialBatchSize = Math.min(MAX_CONCURRENT_LOADS, THREE_SPACE_ASSETS.length)
    // for (let i = 0; i < initialBatchSize; i++) { loadNextModel(i) }

    const raycaster = raycasterRef.current
    const mouse = mouseRef.current
    const projectVec = new THREE.Vector3()
    const projectBox = new THREE.Box3()
    let lastAnchorX = -Infinity
    let lastAnchorY = -Infinity
    let hadAnchor = false

    const fpPos = new THREE.Vector3()
    let fpYaw = 0
    let fpPitch = 0

    let isOrbiting = false
    let dragStartX = 0
    let dragStartY = 0
    let pointerSessionStartedOnCanvas = false
    let shiftCircleDragging = false
    let shiftCircleCenterX = 0
    let shiftCircleCenterY = 0
    const DEFAULT_CIRCLE_RADIUS = 60

    const performPick = (clientX: number, clientY: number, additive: boolean) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(modelsGroup.children, true)
      const state = useEditorStore.getState()
      const currentNames = state.viewportSelectedAssetNames

      if (hits.length > 0) {
        const root = findRootWithAssetName(hits[0].object, modelsGroup)
        const name = root?.userData.assetName as string | undefined
        if (name) {
          const isOnlySelection = currentNames.length === 1 && currentNames[0] === name
          if (isOnlySelection && !additive) {
            setViewportSelectedAssetRef.current(null)
          } else {
            setViewportSelectedAssetRef.current({ name }, { additive })
          }
        }
      } else if (!additive) {
        setViewportSelectedAssetRef.current(null)
      }
    }

    const selectObjectsInCircle = (cx: number, cy: number, r: number) => {
      const cont = containerRef.current
      if (!cont || !cameraRef.current || !modelsGroupRef.current) return
      const rect = cont.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const cam = cameraRef.current
      const group = modelsGroupRef.current
      const center = new THREE.Vector3()
      const box = new THREE.Box3()
      const matchedNames: string[] = []
      const matchedIds: string[] = []
      const state = useEditorStore.getState()
      const workspaceId = state.rootObjectIds[0]
      const workspace = state.gameObjects[workspaceId]
      if (!workspace) return

      group.children.forEach((child) => {
        const name = child.userData.assetName as string | undefined
        const objId = child.userData.objectId as string | undefined
        if (!name || !objId) return
        box.makeEmpty()
        box.setFromObject(child)
        box.getCenter(center)
        center.project(cam)
        if (center.z > 1) return // behind camera
        const screenX = ((center.x + 1) / 2) * w
        const screenY = ((1 - center.y) / 2) * h
        const dx = screenX - cx
        const dy = screenY - cy
        if (Math.sqrt(dx * dx + dy * dy) <= r) {
          matchedNames.push(name)
          matchedIds.push(objId)
        }
      })

      // Batch-set selection
      useEditorStore.setState({
        viewportSelectedAssetNames: matchedNames,
        selectedObjectIds: matchedIds,
      })
    }

    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      pointerSessionStartedOnCanvas = true
      ;(canvas as HTMLCanvasElement).focus()
      dragStartX = e.clientX
      dragStartY = e.clientY
      isOrbiting = false

      if (e.shiftKey && !isPlayingRef.current && !useEditorStore.getState().mentionPickingSource) {
        const cont = containerRef.current
        if (cont) {
          const rect = cont.getBoundingClientRect()
          shiftCircleCenterX = e.clientX - rect.left
          shiftCircleCenterY = e.clientY - rect.top
          shiftCircleDragging = true
          setAreaSelectionCircleRef.current({ centerX: shiftCircleCenterX, centerY: shiftCircleCenterY, radius: 0 })
        }
        return
      }

      // Non-shift click clears existing area selection circle
      if (useEditorStore.getState().areaSelectionCircle) {
        setAreaSelectionCircleRef.current(null)
      }
    }

    const onPointerMove = (e: MouseEvent) => {
      if (shiftCircleDragging) {
        const cont = containerRef.current
        if (cont) {
          const rect = cont.getBoundingClientRect()
          const mx = e.clientX - rect.left
          const my = e.clientY - rect.top
          const dx = mx - shiftCircleCenterX
          const dy = my - shiftCircleCenterY
          const r = Math.sqrt(dx * dx + dy * dy)
          setAreaSelectionCircleRef.current({ centerX: shiftCircleCenterX, centerY: shiftCircleCenterY, radius: r })
          selectObjectsInCircle(shiftCircleCenterX, shiftCircleCenterY, r)
        }
        return
      }
      if (transformControlsDraggingRef.current) return
      if (isPlayingRef.current) {
        if (lastPointerXRef.current !== 0 || lastPointerYRef.current !== 0) {
          mouseDeltaXRef.current += e.clientX - lastPointerXRef.current
          mouseDeltaYRef.current += e.clientY - lastPointerYRef.current
        }
        lastPointerXRef.current = e.clientX
        lastPointerYRef.current = e.clientY
        return
      }
      if (e.buttons !== 1) return
      if (!pointerSessionStartedOnCanvas) return
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (!isOrbiting && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
        isOrbiting = true
        canvas.style.cursor = 'grabbing'
      }
      if (isOrbiting) {
        theta -= dx * ORBIT_SENSITIVITY
        const orbitDy = VERTICAL_ORBIT_INVERTED ? -dy : dy
        phi = Math.max(MIN_PHI, Math.min(MAX_PHI, phi - orbitDy * ORBIT_SENSITIVITY))
        updateCameraFromOrbit()
        needsRender = true // Force render on camera movement
        dragStartX = e.clientX
        dragStartY = e.clientY
      }
    }

    const onPointerUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      const pickingSource = useEditorStore.getState().mentionPickingSource
      const defaultCursor = pickingSource ? 'crosshair' : 'grab'
      if (shiftCircleDragging) {
        shiftCircleDragging = false
        const circle = useEditorStore.getState().areaSelectionCircle
        if (circle && circle.radius < DRAG_THRESHOLD_PX) {
          // Click without meaningful drag — use default radius
          setAreaSelectionCircleRef.current({ centerX: shiftCircleCenterX, centerY: shiftCircleCenterY, radius: DEFAULT_CIRCLE_RADIUS })
          selectObjectsInCircle(shiftCircleCenterX, shiftCircleCenterY, DEFAULT_CIRCLE_RADIUS)
        }
        pointerSessionStartedOnCanvas = false
        canvas.style.cursor = defaultCursor
        return
      }
      if (transformControlsDraggingRef.current) {
        pointerSessionStartedOnCanvas = false
        return
      }
      if (pointerSessionStartedOnCanvas && !isOrbiting) {
        if (pickingSource) {
          // @-mention picking mode: raycast and signal the picked object
          const rect = canvas.getBoundingClientRect()
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const hits = raycaster.intersectObjects(modelsGroup.children, true)
          if (hits.length > 0) {
            const root = findRootWithAssetName(hits[0].object, modelsGroup)
            const name = root?.userData.assetName as string | undefined
            const objId = root?.userData.objectId as string | undefined
            if (name && objId) {
              const storeObj = useEditorStore.getState().gameObjects[objId]
              const objectType = storeObj?.primitiveType === 'terrain' ? 'terrain'
                : storeObj?.type !== 'mesh' && storeObj?.type !== 'empty' ? storeObj?.type
                : undefined
              setMentionPickedObjectRef.current({ id: objId, name, objectType })
            }
          }
          // Miss (empty space): picking mode stays active for retry
        } else {
          const tool = useEditorStore.getState().activeTool
          if (tool === 'select') {
            performPick(e.clientX, e.clientY, e.ctrlKey || e.metaKey)
          }
        }
      }
      pointerSessionStartedOnCanvas = false
      isOrbiting = false
      canvas.style.cursor = defaultCursor
    }

    const onPointerEnter = () => {
      canvas.style.cursor = useEditorStore.getState().mentionPickingSource ? 'crosshair' : 'grab'
    }

    const onPointerLeave = () => {
      isOrbiting = false
      canvas.style.cursor = 'default'
    }

    const onWheel = (e: Event) => {
      const ev = e as WheelEvent
      ev.preventDefault()
      const factor = 1 + ev.deltaY * ZOOM_SENSITIVITY
      radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radius * factor))
      updateCameraFromOrbit()
      needsRender = true // Force render on zoom
    }

    const onDblClick = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (useEditorStore.getState().mentionPickingSource) return
      const tool = useEditorStore.getState().activeTool
      if (tool === 'select') {
        useEditorStore.getState().setSkipPillInsertion(true)
        performPick(e.clientX, e.clientY, false)
        focusSelectedRef.current = true
      }
    }

    const wheelOpts = { passive: false }

    // Store event handlers in ref for cleanup
    eventHandlersRef.current = {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerEnter,
      onPointerLeave,
      onWheel,
      onDblClick,
      wheelOpts
    }

    canvas.addEventListener('wheel', onWheel, wheelOpts as object)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerenter', onPointerEnter)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('dblclick', onDblClick)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const viewportFocused =
        document.activeElement === canvas ||
        (container.contains(document.activeElement as Node) && document.activeElement !== document.body)
      const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable

      if (isPlayingRef.current) {
        if (key === 'escape') {
          useEditorStore.getState().stop()
          e.preventDefault()
          return
        }
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
          keysPressed.add(key)
          e.preventDefault()
        }
        return
      }

      // P key is handled globally in App.tsx to avoid duplicate toggle
      if (key === 'f' && !inInput) {
        const state = useEditorStore.getState()
        const hasSelection = state.viewportSelectedAssetNames.length > 0 || state.selectedObjectIds.length > 0
        if (hasSelection) {
          focusSelectedRef.current = true
          if (!viewportFocused && canvas) (canvas as HTMLCanvasElement).focus()
          e.preventDefault()
        }
      }
      if (PAN_KEYS.has(key) && viewportFocused) {
        if (key === 'r') {
          resetViewRef.current = true
        } else if (key === 'f') {
          focusSelectedRef.current = true
        } else {
          keysPressed.add(key)
        }
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase())
    }
    
    // Store keyboard handlers in ref
    eventHandlersRef.current.onKeyDown = onKeyDown
    eventHandlersRef.current.onKeyUp = onKeyUp
    
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let lastTransformVersion = 0 // Track transform version for lightweight change detection
    let isAnimating = false // Track if actively animating
    let framesSinceLastCheck = 0 // Throttle transform checks
    const TRANSFORM_CHECK_INTERVAL = 10 // Check every N frames instead of every frame
    
    // Create a version counter in store to track changes
    const getTransformVersion = () => {
      const state = useEditorStore.getState()
      const { gameObjects, rootObjectIds } = state
      if (rootObjectIds.length === 0) return 0
      const workspace = gameObjects[rootObjectIds[0]]
      if (!workspace?.children) return 0
      // Simple sum-based version - much faster than JSON.stringify (includes visibility so sync runs when toggling)
      return workspace.children.reduce((sum, id) => {
        const obj = gameObjects[id]
        if (!obj?.transform) return sum
        const t = obj.transform
        const vis = obj.visible === true ? 1 : 0
        return sum + t.position.x + t.position.y + t.position.z +
               t.rotation.x + t.rotation.y + t.rotation.z +
               t.scale.x + t.scale.y + t.scale.z + vis
      }, 0)
    }

    const syncObjects = () => {
      const group = modelsGroupRef.current
      if (!group) return false
      
      const state = useEditorStore.getState()
      const { gameObjects, rootObjectIds } = state
      if (rootObjectIds.length === 0) return false
      
      const workspace = gameObjects[rootObjectIds[0]]
      if (!workspace?.children) return false
      
      const DEG2RAD = Math.PI / 180
      let changed = false

      workspace.children.forEach((objId) => {
        const obj = gameObjects[objId]
        if (!obj?.transform) return
        
        const root = group.children.find(
          (c) => (c.userData.objectId as string) === objId
        ) as THREE.Object3D | undefined
        if (!root) return
        
        root.userData.assetName = obj.name
        const shouldBeVisible = obj.visible !== false
        if (root.visible !== shouldBeVisible) {
          root.visible = shouldBeVisible
          changed = true
        }
        const { position, rotation, scale } = obj.transform
        
        // Only update if values changed
        if (root.position.x !== position.x || root.position.y !== position.y || root.position.z !== position.z) {
          root.position.set(position.x, position.y, position.z)
          changed = true
        }
        
        const newRotX = rotation.x * DEG2RAD
        const newRotY = rotation.y * DEG2RAD
        const newRotZ = rotation.z * DEG2RAD
        if (root.rotation.x !== newRotX || root.rotation.y !== newRotY || root.rotation.z !== newRotZ) {
          root.rotation.set(newRotX, newRotY, newRotZ)
          changed = true
        }
        
        const baseScale = (root.userData.baseScale as number) ?? 1
        const newScaleX = baseScale * scale.x
        const newScaleY = baseScale * scale.y
        const newScaleZ = baseScale * scale.z
        if (root.scale.x !== newScaleX || root.scale.y !== newScaleY || root.scale.z !== newScaleZ) {
          root.scale.set(newScaleX, newScaleY, newScaleZ)
          changed = true
        }
      })
      
      return changed
    }

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      const now = performance.now()
      const delta = (now - lastPanTime) / 1000
      lastPanTime = now

      let cameraChanged = false

      if (wasPlayingRef.current && !isPlayingRef.current && cameraRef.current && sceneRef.current) {
        wasPlayingRef.current = false
        lastPointerXRef.current = 0
        lastPointerYRef.current = 0
        if (avatarRef.current && sceneRef.current) {
          sceneRef.current.remove(avatarRef.current)
        }
        const cam = cameraRef.current
        const dir = new THREE.Vector3()
        cam.getWorldDirection(dir)
        radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, 30))
        target.copy(cam.position).addScaledVector(dir, radius)
        theta = Math.atan2(-dir.x, -dir.z)
        phi = Math.acos(Math.max(-1, Math.min(1, -dir.y)))
        updateCameraFromOrbit()
        cameraChanged = true
      }

      if (resetViewRef.current && cameraRef.current) {
        resetViewRef.current = false
        target.copy(INITIAL_TARGET)
        radius = INITIAL_RADIUS
        theta = INITIAL_THETA
        phi = INITIAL_PHI
        updateCameraFromOrbit()
        cameraChanged = true
        isAnimating = false
      }

      // Honor request from store (e.g. after AI creates an object)
      const storeState = useEditorStore.getState()
      if (storeState.requestFocusSelection) {
        storeState.setRequestFocusSelection(false)
        focusSelectedRef.current = true
      }

      // Creation particle burst (when AI creates an object)
      const effectPos = storeState.creationEffectPosition
      if (effectPos && sceneRef.current) {
        storeState.setCreationEffectPosition(null)
        const velocities = new Float32Array(CREATION_PARTICLE_COUNT * 3)
        for (let i = 0; i < CREATION_PARTICLE_COUNT; i++) {
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1) * 0.6 + Math.PI * 0.2
          const s = CREATION_BURST_SPEED * (0.6 + Math.random() * 0.4)
          velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * s
          velocities[i * 3 + 1] = Math.cos(phi) * s + 0.8
          velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s
        }
        creationEffectRef.current = {
          position: { ...effectPos },
          startTime: now,
          points: null,
          geometry: null,
          velocities,
        }
      }

      const effect = creationEffectRef.current
      if (effect && sceneRef.current) {
        const elapsed = (now - effect.startTime) / 1000
        if (effect.points === null) {
          const positions = new Float32Array(CREATION_PARTICLE_COUNT * 3)
          for (let i = 0; i < CREATION_PARTICLE_COUNT; i++) {
            positions[i * 3] = effect.position.x
            positions[i * 3 + 1] = effect.position.y
            positions[i * 3 + 2] = effect.position.z
          }
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          const material = new THREE.PointsMaterial({
            size: 0.35,
            color: 0x88ccff,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
          })
          const points = new THREE.Points(geometry, material)
          points.frustumCulled = false
          sceneRef.current.add(points)
          effect.points = points
          effect.geometry = geometry
        } else {
          const posAttr = effect.geometry!.getAttribute('position') as THREE.BufferAttribute
          const pos = posAttr.array as Float32Array
          for (let i = 0; i < CREATION_PARTICLE_COUNT; i++) {
            pos[i * 3] += effect.velocities[i * 3] * delta
            pos[i * 3 + 1] += effect.velocities[i * 3 + 1] * delta
            pos[i * 3 + 2] += effect.velocities[i * 3 + 2] * delta
          }
          posAttr.needsUpdate = true
          const mat = effect.points!.material as THREE.PointsMaterial
          const fade = Math.max(0, 1 - elapsed / (CREATION_EFFECT_DURATION_MS / 1000))
          mat.opacity = 0.9 * fade
          mat.size = 0.35 * fade
          if (elapsed * 1000 >= CREATION_EFFECT_DURATION_MS) {
            sceneRef.current.remove(effect.points!)
            effect.geometry!.dispose()
            mat.dispose()
            creationEffectRef.current = null
          }
        }
        cameraChanged = true
      }

      if (focusSelectedRef.current && cameraRef.current && modelsGroupRef.current) {
        focusSelectedRef.current = false
        const group = modelsGroupRef.current
        const state = useEditorStore.getState()
        const currentNames = state.viewportSelectedAssetNames
        const selectedIds = new Set(state.selectedObjectIds)
        const selectedNames = new Set(currentNames)

        // Find selected object(s) by name or by id (for AI-created objects)
        let selectedObjects = group.children.filter((child) => {
          const name = child.userData.assetName as string | undefined
          return name && selectedNames.has(name)
        })
        if (selectedObjects.length === 0 && selectedIds.size > 0) {
          selectedObjects = group.children.filter((child) => {
            const id = child.userData.objectId as string | undefined
            return id && selectedIds.has(id)
          })
        }

        if (selectedObjects.length > 0) {
            // Calculate bounding box for all selected objects
            const box = new THREE.Box3()
            selectedObjects.forEach((obj) => box.expandByObject(obj))
            
            // Get center and size
            const center = new THREE.Vector3()
            box.getCenter(center)
            const size = new THREE.Vector3()
            box.getSize(size)
            
            // Move target to center of selection
            target.copy(center)
            
            // Calculate appropriate distance to fit object in view
            const maxDim = Math.max(size.x, size.y, size.z)
            radius = Math.max(maxDim * 2, MIN_RADIUS)
            
            updateCameraFromOrbit()
            cameraChanged = true
            isAnimating = false
          }

      }

      if (isPlayingRef.current && cameraRef.current && sceneRef.current) {
        const camera = cameraRef.current
        const scene = sceneRef.current

        if (!avatarRef.current) {
          avatarRef.current = createAvatarPlaceholder()
        }
        const avatar = avatarRef.current
        if (!avatar.parent) {
          scene.add(avatar)
        }

        if (!fpInitializedRef.current) {
          fpPos.set(0, FP_EYE_HEIGHT, 0)
          fpYaw = 0
          fpPitch = 0
          fpInitializedRef.current = true
        }
        fpYaw -= mouseDeltaXRef.current * FP_MOUSE_SENSITIVITY
        fpPitch += mouseDeltaYRef.current * FP_MOUSE_SENSITIVITY
        fpPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, fpPitch))
        mouseDeltaXRef.current = 0
        mouseDeltaYRef.current = 0
        const speed = FP_MOVE_SPEED * delta
        const forward = new THREE.Vector3(-Math.sin(fpYaw), 0, -Math.cos(fpYaw))
        const right = new THREE.Vector3(Math.cos(fpYaw), 0, -Math.sin(fpYaw))
        if (keysPressed.has('arrowup')) fpPos.addScaledVector(forward, speed)
        if (keysPressed.has('arrowdown')) fpPos.addScaledVector(forward, -speed)
        if (keysPressed.has('arrowleft')) fpPos.addScaledVector(right, -speed)
        if (keysPressed.has('arrowright')) fpPos.addScaledVector(right, speed)
        fpPos.y = FP_EYE_HEIGHT

        avatar.position.copy(fpPos)
        avatar.rotation.y = fpYaw

        const camDist = FP_CAMERA_DISTANCE * Math.cos(fpPitch)
        camera.position.set(
          fpPos.x + Math.sin(fpYaw) * camDist,
          fpPos.y + FP_CAMERA_HEIGHT + FP_CAMERA_DISTANCE * Math.sin(fpPitch),
          fpPos.z + Math.cos(fpYaw) * camDist
        )
        // Look at avatar (eye height) so the character is centered at viewport center
        const lookHeight = FP_EYE_HEIGHT + 0.2
        camera.lookAt(fpPos.x, lookHeight, fpPos.z)
        cameraChanged = true
      } else if (keysPressed.size > 0 && cameraRef.current) {
        const speed = PAN_SPEED * (delta * 60)
        const forward = new THREE.Vector3()
          .subVectors(camera.position, target)
          .setY(0)
        if (forward.lengthSq() > 1e-6) {
          forward.normalize()
          const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
          if (keysPressed.has('w')) target.addScaledVector(forward, -speed)
          if (keysPressed.has('s')) target.addScaledVector(forward, speed)
          if (keysPressed.has('a')) target.addScaledVector(right, -speed)
          if (keysPressed.has('d')) target.addScaledVector(right, speed)
        }
        if (keysPressed.has('e')) target.y += speed
        if (keysPressed.has('q')) target.y -= speed
        updateCameraFromOrbit()
        cameraChanged = true
        isAnimating = true
      } else if (isAnimating && keysPressed.size === 0) {
        isAnimating = false
      }

      // Check for transform updates only when idle (no camera movement)
      // Throttle checks to every N frames for better performance
      if (!isAnimating && !cameraChanged) {
        framesSinceLastCheck++
        if (framesSinceLastCheck >= TRANSFORM_CHECK_INTERVAL) {
          framesSinceLastCheck = 0
          const currentVersion = getTransformVersion()
          if (currentVersion !== lastTransformVersion) {
            lastTransformVersion = currentVersion
            const changed = syncObjects()
            if (changed) {
              needsRender = true
            }
          }
        }
      } else {
        // Reset counter when animating to check immediately after animation stops
        framesSinceLastCheck = 0
      }

      // Sync area selection circle to 3D ground plane
      {
        const areaCircle = useEditorStore.getState().areaSelectionCircle
        if (areaCircle && areaCircle.radius > 0 && containerRef.current && cameraRef.current) {
          const cont = containerRef.current
          const rect = cont.getBoundingClientRect()
          const w = rect.width
          const h = rect.height
          const rc = raycasterRef.current
          const hitPt = new THREE.Vector3()

          // Project center to ground
          const cNdcX = (areaCircle.centerX / w) * 2 - 1
          const cNdcY = -(areaCircle.centerY / h) * 2 + 1
          rc.setFromCamera(new THREE.Vector2(cNdcX, cNdcY), camera)
          const centerHit = rc.ray.intersectPlane(groundPlane, hitPt)
          if (centerHit) {
            const cx = hitPt.x
            const cz = hitPt.z

            // Project edge point to ground for world radius
            const eNdcX = ((areaCircle.centerX + areaCircle.radius) / w) * 2 - 1
            rc.setFromCamera(new THREE.Vector2(eNdcX, cNdcY), camera)
            const edgePt = new THREE.Vector3()
            const edgeHit = rc.ray.intersectPlane(groundPlane, edgePt)
            if (edgeHit) {
              const worldRadius = Math.sqrt((edgePt.x - cx) ** 2 + (edgePt.z - cz) ** 2)
              areaCircleGroup.position.x = cx
              areaCircleGroup.position.z = cz
              areaCircleGroup.scale.setScalar(Math.max(worldRadius, 0.1))
              areaCircleGroup.visible = true
              needsRender = true
            }
          }
        } else if (areaCircleGroup.visible) {
          areaCircleGroup.visible = false
          needsRender = true
        }
      }

      // Check if external trigger requested render
      if (needsRenderRef.current) {
        needsRender = true
        needsRenderRef.current = false
      }

      // Update AI input anchor position for contextual placement
      const containerEl = containerRef.current
      if (cameraRef.current && modelsGroupRef.current && containerEl) {
        const state = useEditorStore.getState()
        // When an area selection circle is active, App.tsx already positioned
        // the anchor relative to the circle — don't override it here.
        if (state.areaSelectionCircle) {
          // no-op: preserve area-selection anchor
        } else {
        const selectedIds = new Set(state.selectedObjectIds)
        if (selectedIds.size > 0) {
          const group = modelsGroupRef.current
          const selectedObjects = group.children.filter(
            (c) => (c.userData.objectId as string) && selectedIds.has(c.userData.objectId as string)
          )
          if (selectedObjects.length > 0) {
            projectBox.makeEmpty()
            selectedObjects.forEach((obj) => projectBox.expandByObject(obj))
            projectBox.getCenter(projectVec)
            projectVec.project(cameraRef.current)
            const rect = containerEl.getBoundingClientRect()
            const width = rect.width
            const height = rect.height
            const pixelX = ((projectVec.x + 1) / 2) * width
            const pixelY = ((1 - projectVec.y) / 2) * height
            if (projectVec.z <= 1) {
              const inputWidth = 400
              const inputHeight = 48
              const offsetY = 4
              const left = Math.max(0, Math.min(width - inputWidth, pixelX - inputWidth / 2))
              const top = Math.max(0, Math.min(height - inputHeight - offsetY, pixelY + offsetY))
              if (Math.abs(left - lastAnchorX) > 2 || Math.abs(top - lastAnchorY) > 2) {
                lastAnchorX = left
                lastAnchorY = top
                hadAnchor = true
                setAIInputAnchorPositionRef.current({ x: left, y: top })
              }
            } else {
              if (hadAnchor) {
                hadAnchor = false
                lastAnchorX = -Infinity
                lastAnchorY = -Infinity
                setAIInputAnchorPositionRef.current(null)
              }
            }
          } else {
            if (hadAnchor) {
              hadAnchor = false
              lastAnchorX = -Infinity
              lastAnchorY = -Infinity
              setAIInputAnchorPositionRef.current(null)
            }
          }
        } else {
          if (hadAnchor) {
            hadAnchor = false
            lastAnchorX = -Infinity
            lastAnchorY = -Infinity
            setAIInputAnchorPositionRef.current(null)
          }
        }
        }
      } else {
        if (hadAnchor) {
          hadAnchor = false
          lastAnchorX = -Infinity
          lastAnchorY = -Infinity
          setAIInputAnchorPositionRef.current(null)
        }
      }

      // Project per-object screen positions for AI working indicators
      if (cameraRef.current && modelsGroupRef.current && containerRef.current) {
        const es = useEditorStore.getState()
        if (es.aiGenerating && es.aiWorkingObjectIds.size > 0) {
          const group = modelsGroupRef.current
          const rect = containerRef.current.getBoundingClientRect()
          const w = rect.width
          const h = rect.height
          const positions: { id: string; x: number; y: number }[] = []
          es.aiWorkingObjectIds.forEach((objId) => {
            const child = group.children.find(
              (c) => (c.userData.objectId as string) === objId,
            )
            if (!child) return
            projectBox.makeEmpty()
            projectBox.expandByObject(child)
            projectBox.getCenter(projectVec)
            projectVec.project(cameraRef.current!)
            if (projectVec.z <= 1) {
              positions.push({
                id: objId,
                x: ((projectVec.x + 1) / 2) * w,
                y: ((1 - projectVec.y) / 2) * h,
              })
            }
          })
          setAiWorkingObjectPositionsRef.current(positions)
        } else if (useEditorStore.getState().aiWorkingObjectPositions.length > 0) {
          setAiWorkingObjectPositionsRef.current([])
        }
      }

      // Only render when needed
      if (needsRender || cameraChanged || isAnimating) {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current)
        }
        if (!isAnimating) {
          needsRender = false
        }
      }
    }
    animate()
    
    // Force initial render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
      console.log('[Viewport3D] Initial render complete')
    }

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
      
      // Throttle resize to avoid too many updates
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      resizeTimeoutRef.current = window.setTimeout(() => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        
        if (w === 0 || h === 0) {
          console.warn('[Viewport3D] Resize to zero dimensions, skipping')
          return
        }
        
        console.log('[Viewport3D] Resizing to', { w, h })
        cameraRef.current.aspect = w / h
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(w, h)
        enforceCanvasLock()
        needsRenderRef.current = true
      }, 100)
    }
    
    // Store resize handler in ref
    eventHandlersRef.current.onResize = onResize
    
    window.addEventListener('resize', onResize)

    resizeObserverRef.current = new ResizeObserver(onResize)
    resizeObserverRef.current.observe(container)
    
    console.log('[Viewport3D] ✅ Initialization complete!')
    
    } catch (error) {
      console.error('[Viewport3D] ❌ Initialization failed:', error)
      initializedRef.current = false
      return
    }

    return () => {
      console.log('[Viewport3D] Cleaning up Three.js scene')
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect()
      
      const canvas = canvasRef.current
      const handlers = eventHandlersRef.current
      
      if (canvas && handlers) {
        if (handlers.onPointerDown) canvas.removeEventListener('pointerdown', handlers.onPointerDown)
        if (handlers.onPointerMove) canvas.removeEventListener('pointermove', handlers.onPointerMove)
        if (handlers.onPointerUp) canvas.removeEventListener('pointerup', handlers.onPointerUp)
        if (handlers.onPointerEnter) canvas.removeEventListener('pointerenter', handlers.onPointerEnter)
        if (handlers.onPointerLeave) canvas.removeEventListener('pointerleave', handlers.onPointerLeave)
        if (handlers.onWheel) canvas.removeEventListener('wheel', handlers.onWheel, handlers.wheelOpts as object)
        if (handlers.onDblClick) canvas.removeEventListener('dblclick', handlers.onDblClick)
      }
      
      if (handlers) {
        if (handlers.onPointerMove) window.removeEventListener('pointermove', handlers.onPointerMove)
        if (handlers.onPointerUp) window.removeEventListener('pointerup', handlers.onPointerUp)
        if (handlers.onKeyDown) window.removeEventListener('keydown', handlers.onKeyDown)
        if (handlers.onKeyUp) window.removeEventListener('keyup', handlers.onKeyUp)
        if (handlers.onResize) window.removeEventListener('resize', handlers.onResize)
      }
      
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      
      const wrapper = wrapperRef.current
      if (containerRef.current && wrapper && wrapper.parentNode === containerRef.current) {
        containerRef.current.removeChild(wrapper)
      }

      useEditorStore.getState().setCaptureViewportScreenshot(null)
      useEditorStore.getState().setScreenToWorld(null)
      useEditorStore.getState().setGetCameraInfo(null)
      const scene = sceneRef.current
      const tcon = transformControlsRef.current
      if (tcon && scene) {
        tcon.detach()
        scene.remove(tcon.getHelper())
        if (typeof tcon.dispose === 'function') tcon.dispose()
        transformControlsRef.current = null
      }
      rendererRef.current?.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      modelsGroupRef.current = null
      canvasRef.current = null
      wrapperRef.current = null
      eventHandlersRef.current = {}
      initializedRef.current = false
      console.log('[Viewport3D] Cleanup complete')
    }
    // Empty deps - only initialize once, never cleanup unless component unmounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attach/detach transform controls based on active tool and selection
  useEffect(() => {
    const controls = transformControlsRef.current
    const group = modelsGroupRef.current
    const camera = cameraRef.current
    if (!controls || !group || !camera) return

    const transformTools = new Set(['move', 'rotate', 'scale', 'transform'])
    const singleId = selectedObjectIds.length === 1 ? selectedObjectIds[0] : null

    if (!singleId || !activeTool || !transformTools.has(activeTool)) {
      controls.detach()
      return
    }

    const root = group.children.find(
      (c) => (c.userData.objectId as string) === singleId
    ) as THREE.Object3D | undefined
    if (!root) {
      controls.detach()
      return
    }

    if (activeTool === 'move') controls.setMode('translate')
    else if (activeTool === 'rotate') controls.setMode('rotate')
    else if (activeTool === 'scale') controls.setMode('scale')
    else controls.setMode('translate') // transform -> translate
    controls.camera = camera
    controls.attach(root)
  }, [activeTool, selectedObjectIds])

  // @-mention picking mode: crosshair cursor while active
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (mentionPickingSource) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = 'grab'
    }
  }, [mentionPickingSource])

  // Highlight selected assets
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group) return
    const names = new Set(viewportSelectedAssetNames)
    group.children.forEach((root) => {
      const name = root.userData.assetName as string | undefined
      setHighlight(root, !!name && names.has(name))
    })
    // Force a render to show the highlight changes
    needsRenderRef.current = true
  }, [viewportSelectedAssetNames])

  // AI working object highlight (Gap 3)
  const aiWorkingObjectIds = useEditorStore((s) => s.aiWorkingObjectIds)
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group) return
    group.children.forEach((root) => {
      const objId = root.userData.objectId as string | undefined
      if (!objId) return
      const isWorking = aiWorkingObjectIds.has(objId)
      const wasWorking = !!root.userData._aiWorking
      if (isWorking !== wasWorking) {
        setWorkingHighlight(root, isWorking)
        root.userData._aiWorking = isWorking || undefined
      }
    })
    needsRenderRef.current = true
  }, [aiWorkingObjectIds])

  // Sync color/material for changed objects only (GLB models + primitives)
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group || rootObjectIds.length === 0) return

    const workspaceId = rootObjectIds[0]
    const workspace = gameObjects[workspaceId]
    if (!workspace?.children) return

    const prev = prevGameObjectsRef.current

    workspace.children.forEach((objId) => {
      const obj = gameObjects[objId]
      if (!obj?.color) return
      // Skip objects whose color hasn't changed
      const prevObj = prev[objId]
      if (prevObj && prevObj.color === obj.color && prevObj.reflectance === obj.reflectance && prevObj.roughness === obj.roughness && prevObj.transparency === obj.transparency) return

      const root = group.children.find(
        (c) => (c.userData.objectId as string) === objId
      ) as THREE.Object3D | undefined
      if (!root) return

      const shouldBeVisible = obj.visible !== false
      if (root.visible !== shouldBeVisible) {
        root.visible = shouldBeVisible
        needsRenderRef.current = true
      }
      root.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial
          if (mat) {
            if (mat.color && obj.color) {
              const newColor = new THREE.Color(obj.color!)
              if (!mat.color.equals(newColor)) {
                mat.color.copy(newColor)
                mat.needsUpdate = true
                needsRenderRef.current = true
              }
            }
            const targetRoughness = obj.roughness ?? 0.6
            if (mat.roughness !== targetRoughness) {
              mat.roughness = targetRoughness
              mat.needsUpdate = true
              needsRenderRef.current = true
            }
            const targetMetalness = obj.reflectance ?? 0.1
            if (mat.metalness !== targetMetalness) {
              mat.metalness = targetMetalness
              mat.needsUpdate = true
              needsRenderRef.current = true
            }
          }
        }
      })
    })
  }, [gameObjects, rootObjectIds])

  // Create/update/remove primitive meshes for AI-created objects (box, sphere, cylinder, etc.)
  // Diff-based: only processes new, changed, or removed objects.
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group || rootObjectIds.length === 0) return

    const workspaceId = rootObjectIds[0]
    const workspace = gameObjects[workspaceId]
    if (!workspace?.children) return

    const allObjectIds = new Set(Object.keys(gameObjects))
    const prev = prevGameObjectsRef.current
    const DEG2RAD = Math.PI / 180

    // Remove Three.js objects for deleted game objects (GLBs and primitives)
    const toRemove: THREE.Object3D[] = []
    group.children.forEach((child) => {
      const objId = child.userData.objectId as string | undefined
      if (objId && !allObjectIds.has(objId)) {
        toRemove.push(child)
      }
    })
    toRemove.forEach((child) => {
      group.remove(child)
      child.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh
          mesh.geometry?.dispose()
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose())
          else mesh.material?.dispose()
        }
      })
      needsRenderRef.current = true
    })

    workspace.children.forEach((objId) => {
      const obj = gameObjects[objId]
      if (!obj?.primitiveType) return

      const existing = group.children.find(
        (c) => (c.userData.objectId as string) === objId
      )

      if (existing) {
        // Sync visibility (e.g. after "Show all hidden")
        const shouldBeVisible = obj.visible !== false
        if (existing.visible !== shouldBeVisible) {
          existing.visible = shouldBeVisible
          needsRenderRef.current = true
        }

        // Terrain: rebuild geometry when parameters change OR key is missing (stale mesh)
        if (obj.primitiveType === 'terrain' && obj.terrainData) {
          const newKey = terrainDataKey(obj.terrainData)
          if (existing.userData.terrainKey !== newKey) {
            existing.userData.terrainKey = newKey
            existing.traverse((node: THREE.Object3D) => {
              if ((node as THREE.Mesh).isMesh) {
                const m = node as THREE.Mesh
                m.geometry?.dispose()
                m.geometry = createTerrainGeometry(obj.terrainData!)
              }
            })
            needsRenderRef.current = true
          }
          if (prev[objId] === obj) return
          return
        }

        // Skip rest if this object hasn't changed
        if (prev[objId] === obj) return

        // Update color/material on existing primitives
        existing.traverse((node: THREE.Object3D) => {
          if ((node as THREE.Mesh).isMesh) {
            const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial
            if (mat) {
              if (mat.color && obj.color) {
                const newColor = new THREE.Color(obj.color)
                if (!mat.color.equals(newColor)) {
                  mat.color.copy(newColor)
                  mat.needsUpdate = true
                  needsRenderRef.current = true
                }
              }
              const targetRoughness = obj.roughness ?? 0.6
              if (mat.roughness !== targetRoughness) {
                mat.roughness = targetRoughness
                mat.needsUpdate = true
                needsRenderRef.current = true
              }
              const targetMetalness = obj.reflectance ?? 0.1
              if (mat.metalness !== targetMetalness) {
                mat.metalness = targetMetalness
                mat.needsUpdate = true
                needsRenderRef.current = true
              }
            }
          }
        })
        return
      }

      // New primitive — create geometry
      let geometry: THREE.BufferGeometry
      let isTerrain = false
      switch (obj.primitiveType) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(0.5, 32, 32)
          break
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
          break
        case 'cone':
          geometry = new THREE.ConeGeometry(0.5, 1, 32)
          break
        case 'torus':
          geometry = new THREE.TorusGeometry(0.4, 0.15, 16, 32)
          break
        case 'plane':
          geometry = new THREE.PlaneGeometry(1, 1)
          break
        case 'terrain': {
          if (!obj.terrainData) {
            geometry = new THREE.BoxGeometry(1, 1, 1)
            break
          }
          geometry = createTerrainGeometry(obj.terrainData)
          isTerrain = true
          break
        }
        case 'box':
        default:
          geometry = new THREE.BoxGeometry(1, 1, 1)
          break
      }

      const color = obj.color || '#888888'
      const material = isTerrain
        ? new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            roughness: 0.85,
            metalness: 0.05,
          })
        : new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            roughness: obj.roughness ?? 0.6,
            metalness: obj.reflectance ?? 0.1,
            transparent: (obj.transparency ?? 0) > 0,
            opacity: 1 - (obj.transparency ?? 0),
          })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true

      const root = new THREE.Group()
      root.add(mesh)
      root.userData.assetName = obj.name
      root.userData.objectId = objId
      root.userData.baseScale = 1
      root.userData.isPrimitive = true
      if (isTerrain && obj.terrainData) {
        root.userData.terrainKey = terrainDataKey(obj.terrainData)
      }
      root.visible = obj.visible !== false

      const { position, rotation, scale } = obj.transform
      root.position.set(position.x, position.y, position.z)
      root.rotation.set(
        rotation.x * DEG2RAD,
        rotation.y * DEG2RAD,
        rotation.z * DEG2RAD
      )
      root.scale.set(scale.x, scale.y, scale.z)

      group.add(root)
      needsRenderRef.current = true
    })
  }, [gameObjects, rootObjectIds])

  // Replace meshes when meshUrl is set (user-selected file) — diff-based
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group || rootObjectIds.length === 0) return

    const workspaceId = rootObjectIds[0]
    const workspace = gameObjects[workspaceId]
    if (!workspace?.children) return

    // Quick check: skip if no meshUrl changed
    const prev = prevGameObjectsRef.current
    const anyMeshUrlChanged = workspace.children.some((objId) => {
      const obj = gameObjects[objId]
      const prevObj = prev[objId]
      return obj?.meshUrl && (!prevObj || prevObj.meshUrl !== obj.meshUrl)
    })
    if (!anyMeshUrlChanged) return

    const MODEL_SCALE = 2
    const fitScale = (obj: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim <= 0) return 1
      return MODEL_SCALE / maxDim
    }

    const loader = new GLTFLoader()
    const DEG2RAD = Math.PI / 180

    workspace.children.forEach((objId) => {
      const obj = gameObjects[objId]
      if (!obj?.meshUrl) {
        delete loadedMeshUrlsRef.current[objId]
        return
      }
      if (loadedMeshUrlsRef.current[objId] === obj.meshUrl) return

      const oldRoot = group.children.find(
        (c) => (c.userData.objectId as string) === objId
      ) as THREE.Object3D | undefined
      if (!oldRoot) return

      loadedMeshUrlsRef.current[objId] = obj.meshUrl

      loader.load(
        obj.meshUrl,
        (gltf: { scene: THREE.Group }) => {
          const newRoot = gltf.scene
          const baseScale = fitScale(newRoot)
          newRoot.userData.assetName = obj.name
          newRoot.userData.objectId = objId
          newRoot.userData.baseScale = baseScale
          newRoot.visible = obj.visible !== false
          newRoot.traverse((node: THREE.Object3D) => {
            if ((node as THREE.Mesh).isMesh) {
              (node as THREE.Mesh).castShadow = true
              ;(node as THREE.Mesh).receiveShadow = true
            }
          })

          const { position, rotation, scale } = obj.transform
          newRoot.position.set(position.x, position.y, position.z)
          newRoot.rotation.set(
            rotation.x * DEG2RAD,
            rotation.y * DEG2RAD,
            rotation.z * DEG2RAD
          )
          newRoot.scale.set(
            baseScale * scale.x,
            baseScale * scale.y,
            baseScale * scale.z
          )

          group.remove(oldRoot)
          group.add(newRoot)
          ;(oldRoot as THREE.Object3D).traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh
              mesh.geometry?.dispose()
              if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose())
              else mesh.material?.dispose()
            }
          })
        },
        undefined,
        () => {}
      )
    })
  }, [gameObjects, rootObjectIds])

  // Update prev snapshot after all sync effects have run
  useEffect(() => {
    prevGameObjectsRef.current = gameObjects
  }, [gameObjects])

  return null
})
