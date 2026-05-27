import { useState, useRef, useEffect } from 'react'
import { TabHeader, type Tab } from './TabHeader'
import { useDockingStore } from '../../store/dockingStore'
import type { DockZone } from '../../types'
import type { ReactNode } from 'react'
import styles from './TabbedPanel.module.css'

const STICKY_PANEL_MIN_WIDTH = 280
const STICKY_PANEL_MIN_HEIGHT = 160
const STICKY_PANEL_WIDTH = 336
const EDGE_SIZE = 48

/** Detect which dock zone the cursor is near, using proximity to viewport edges + elementFromPoint fallback.
 *  Center of viewport maps to 'right-top' (sticky/floating overlay). */
function detectEdgeZone(clientX: number, clientY: number, viewportBounds: { left: number; top: number; width: number; height: number } | null): DockZone | null {
  if (viewportBounds) {
    const vx = clientX - viewportBounds.left
    const vy = clientY - viewportBounds.top
    const inViewport = vx >= 0 && vx <= viewportBounds.width && vy >= 0 && vy <= viewportBounds.height
    if (inViewport && vy > viewportBounds.height - EDGE_SIZE) return 'center-bottom'
    if (inViewport && vx > viewportBounds.width - EDGE_SIZE) return 'right-bottom'
    if (inViewport && vx < EDGE_SIZE) return 'left'
    if (inViewport && vy < EDGE_SIZE) return 'center-top'
    // Center of viewport → sticky/floating overlay (right-top)
    if (inViewport) return 'right-top'
  }
  const element = document.elementFromPoint(clientX, clientY)
  if (element) {
    const zoneElement = element.closest('[data-zone]')
    if (zoneElement) return zoneElement.getAttribute('data-zone') as DockZone
  }
  return null
}

interface TabbedPanelProps {
  tabs: Tab[]
  tabContents: Record<string, ReactNode>
  zone: DockZone
  title?: string
  className?: string
}

const DRAG_THRESHOLD = 5 // px before mousedown becomes a drag

export function TabbedPanel({ tabs, tabContents, zone, title, className }: TabbedPanelProps) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || '')
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [_targetZone, setTargetZone] = useState<DockZone | null>(null)
  /** Which single tab is being dragged (null = all tabs / whole panel) */
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const draggingTabIdRef = useRef<string | null>(null)
  const dockWidget = useDockingStore((state) => state.dockWidget)
  const setWidgetPosition = useDockingStore((state) => state.setWidgetPosition)
  const setStickyDrag = useDockingStore((state) => state.setStickyDrag)
  const undockWidget = useDockingStore((state) => state.undockWidget)
  const setDraggingWidgetId = useDockingStore((state) => state.setDraggingWidgetId)
  const isSticky = zone === 'right-top'

  // Update active tab if current one is removed
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id || '')
    }
  }, [tabs, activeTabId])

  const handleTabClose = (tabId: string) => {
    if (tabs.length <= 1) return // Don't close if it's the last tab
    
    // If closing active tab, switch to another
    if (tabId === activeTabId) {
      const currentIndex = tabs.findIndex(t => t.id === tabId)
      const newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex + 1
      if (tabs[newIndex]) {
        setActiveTabId(tabs[newIndex].id)
      }
    }
    
    // Remove widget from docking store
    undockWidget(tabId)
  }

  useEffect(() => {
    if (!isDragging) {
      document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))
      document.body.classList.remove('dragging-widget')
      document.body.style.cursor = ''
      return
    }

    document.body.classList.add('dragging-widget')
    document.body.style.cursor = 'grabbing'

    let rafId: number | null = null
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        // Read latest store state directly to avoid stale closures
        const store = useDockingStore.getState()
        const bounds = store.viewportBounds
        const offset = store.stickyDragOffset
        const currentIsSticky = zone === 'right-top'

        setDragPosition({ x: e.clientX, y: e.clientY })
        if (currentIsSticky && bounds && tabs[0]) {
          const vx = e.clientX - bounds.left
          const vy = e.clientY - bounds.top
          const x = offset ? vx - offset.x : vx
          const y = offset ? vy - offset.y : vy
          setStickyDrag(tabs[0].id, { x, y })
        }
        // Zone detection
        const detectedZone = detectEdgeZone(e.clientX, e.clientY, bounds)
        document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))
        setTargetZone(detectedZone)
        if (detectedZone && detectedZone !== zone) {
          const edgeMap: Record<string, string> = { 'center-bottom': 'bottom', 'right-bottom': 'right', 'left': 'left', 'center-top': 'top', 'right-top': 'center' }
          const edgeAttr = edgeMap[detectedZone]
          if (edgeAttr) {
            document.querySelector(`[data-edge="${edgeAttr}"]`)?.classList.add('dragOver')
          } else {
            const element = document.elementFromPoint(e.clientX, e.clientY)
            element?.closest('[data-zone]')?.classList.add('dragOver')
          }
        }
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      const singleTabId = draggingTabIdRef.current
      setIsDragging(false)
      setDraggingTabId(null)
      draggingTabIdRef.current = null
      setDraggingWidgetId(null)
      setTargetZone(null)
      setStickyDrag(null, null)
      document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))

      const store = useDockingStore.getState()
      const bounds = store.viewportBounds
      const offset = store.stickyDragOffset
      const currentIsSticky = zone === 'right-top'

      const dropZone = detectEdgeZone(e.clientX, e.clientY, bounds)

      // Determine which widgets to move
      const widgetsToMove = singleTabId ? [singleTabId] : tabs.map((t) => t.id)

      if (currentIsSticky && bounds) {
        if (dropZone && dropZone !== zone) {
          widgetsToMove.forEach((id) => dockWidget(id, dropZone!))
        } else {
          const vx = e.clientX - bounds.left
          const vy = e.clientY - bounds.top
          const x = offset ? vx - offset.x : vx
          const y = offset ? vy - offset.y : vy
          const clampedX = Math.max(0, Math.min(bounds.width - STICKY_PANEL_MIN_WIDTH, x))
          const clampedY = Math.max(0, Math.min(bounds.height - STICKY_PANEL_MIN_HEIGHT, y))
          widgetsToMove.forEach((id) => setWidgetPosition(id, clampedX, clampedY))
        }
      } else if (!currentIsSticky) {
        if (dropZone && dropZone !== zone) {
          widgetsToMove.forEach((id) => dockWidget(id, dropZone!))
        }
      }

      document.body.style.cursor = ''
    }

    const preventInteraction = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('click', preventInteraction, true)
    document.addEventListener('mousedown', preventInteraction, true)
    document.addEventListener('contextmenu', preventInteraction, true)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('click', preventInteraction, true)
      document.removeEventListener('mousedown', preventInteraction, true)
      document.removeEventListener('contextmenu', preventInteraction, true)
      document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => {
        el.classList.remove('dragOver')
      })
      document.body.classList.remove('dragging-widget')
      document.body.style.cursor = ''
    }
  }, [isDragging, zone, tabs, dockWidget, setWidgetPosition, setStickyDrag])
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[aria-label="Close"]')) return

    // Only allow dragging individual tabs, not the whole header
    const tabEl = target.closest('[data-tab-id]')
    const clickedTabId = tabEl?.getAttribute('data-tab-id') ?? null
    if (!clickedTabId) return // Don't start drag from header area

    const startX = e.clientX
    const startY = e.clientY

    const handlePreDragMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        cleanup()
        setDraggingTabId(clickedTabId)
        draggingTabIdRef.current = clickedTabId
        setIsDragging(true)
        setDraggingWidgetId(clickedTabId)
        document.body.style.cursor = 'grabbing'
        if (isSticky && tabs[0]) {
          const store = useDockingStore.getState()
          const bounds = store.viewportBounds
          const w = store.widgets[tabs[0].id]
          if (bounds) {
            const panelLeft = w?.position?.x ?? bounds.width - STICKY_PANEL_WIDTH - 16
            const panelTop = w?.position?.y ?? 16
            const offsetX = startX - bounds.left - panelLeft
            const offsetY = startY - bounds.top - panelTop
            setStickyDrag(tabs[0].id, { x: panelLeft, y: panelTop }, { x: offsetX, y: offsetY })
          }
        }
      }
    }
    const handlePreDragUp = () => {
      cleanup()
    }
    const cleanup = () => {
      document.removeEventListener('mousemove', handlePreDragMove)
      document.removeEventListener('mouseup', handlePreDragUp)
    }
    document.addEventListener('mousemove', handlePreDragMove)
    document.addEventListener('mouseup', handlePreDragUp)
    e.preventDefault()
  }

  const activeContent = tabContents[activeTabId]

  return (
    <>
      <div 
        ref={panelRef}
        className={`${styles.tabbedPanel} ${className || ''} ${isDragging && !isSticky ? styles.dragging : ''}`}
      >
        <div className={styles.panelContainer}>
          <div
            ref={headerRef}
            className={`${styles.draggableHeader} ${isDragging && !isSticky ? styles.dragging : ''}`}
            onMouseDown={handleMouseDown}
          >
            <TabHeader
              tabs={tabs}
              activeTabId={activeTabId}
              onTabSelect={setActiveTabId}
              onTabClose={handleTabClose}
              title={title}
            />
          </div>
          <div className={styles.panelContent}>
            {activeContent}
          </div>
        </div>
      </div>
      
      {isDragging && !isSticky && draggingTabId && (() => {
        const dragTab = tabs.find(t => t.id === draggingTabId)
        if (!dragTab) return null
        return (
          <div
            className={styles.dragPreview}
            style={{ left: dragPosition.x, top: dragPosition.y }}
          >
            <div className={styles.dragPreviewContent}>
              <TabHeader
                tabs={[dragTab]}
                activeTabId={draggingTabId}
                onTabSelect={() => {}}
              />
              <div className={styles.dragPreviewBody}>{tabContents[draggingTabId]}</div>
            </div>
          </div>
        )
      })()}
    </>
  )
}

