import { useRef, useState, useEffect } from 'react'
import { X } from 'lucide-react'
import collapseIcon from '../../../icons/collapse.svg'
import { PanelHeader } from './Panel'
import { useDockingStore } from '../../store/dockingStore'
import { useWidgetMetadataStore } from '../../store/widgetMetadataStore'
import type { DockZone } from '../../types'
import type { ReactNode } from 'react'
import styles from './DockablePanel.module.css'

const STICKY_PANEL_MIN_WIDTH = 280
const STICKY_PANEL_MIN_HEIGHT = 160
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
  // Fall back to elementFromPoint for existing zone containers
  const element = document.elementFromPoint(clientX, clientY)
  if (element) {
    const zoneElement = element.closest('[data-zone]')
    if (zoneElement) return zoneElement.getAttribute('data-zone') as DockZone
  }
  return null
}

interface DockablePanelProps {
  widgetId: string
  title: string
  icon?: ReactNode
  children: ReactNode
  actions?: ReactNode
  /** Optional element before the title (e.g. Tasks dropdown when "On the left") */
  titleLeading?: ReactNode
  /** Optional element after the title (e.g. dropdown chevron) */
  titleTrailing?: ReactNode
  /** Optional content in header middle (e.g. conversation tabs); used when not collapsed */
  headerMiddle?: ReactNode
  /** When true, the header title (h2) is centered in the space between titleLeading and titleTrailing */
  headerCenterTitle?: boolean
  /** When true, render the title before titleLeading so the title is at the far left */
  headerTitleFirst?: boolean
  className?: string
  /** When true, the close (X) button is not shown (e.g. for viewport) */
  hideCloseButton?: boolean
  /** When true, only the header is shown (body hidden) */
  bodyCollapsed?: boolean
  /** When true and bodyCollapsed, keep content visible so child can show minimal UI (e.g. single input) */
  collapsedShowsMinimalContent?: boolean
  /** When bodyCollapsed, hide the header so only content (e.g. input) remains visible */
  hideHeaderWhenCollapsed?: boolean
  /** When bodyCollapsed, render this in the header row so header and content become one bar */
  collapsedHeaderContent?: ReactNode
  /** When true, content fills the panel (no max-height; use for viewport) */
  contentFills?: boolean
  /** Custom close handler; if provided, called instead of undockWidget */
  onClose?: () => void
}

export function DockablePanel({
  widgetId,
  title,
  icon,
  children,
  actions,
  titleLeading,
  titleTrailing,
  headerMiddle,
  headerCenterTitle,
  headerTitleFirst,
  className,
  hideCloseButton = false,
  bodyCollapsed = false,
  collapsedShowsMinimalContent = false,
  hideHeaderWhenCollapsed = false,
  collapsedHeaderContent,
  contentFills = false,
  onClose,
}: DockablePanelProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [_targetZone, setTargetZone] = useState<DockZone | null>(null)
  const dockWidget = useDockingStore((state) => state.dockWidget)
  const setWidgetPosition = useDockingStore((state) => state.setWidgetPosition)
  const setStickyDrag = useDockingStore((state) => state.setStickyDrag)
  const widget = useDockingStore((state) => state.widgets[widgetId])
  const getWidgetsInZone = useDockingStore((state) => state.getWidgetsInZone)
  const centerBottomCollapsed = useDockingStore((state) => state.centerBottomCollapsed)
  const leftCollapsed = useDockingStore((state) => state.leftCollapsed)
  const toggleCenterBottomCollapsed = useDockingStore((state) => state.toggleCenterBottomCollapsed)
  const toggleLeftCollapsed = useDockingStore((state) => state.toggleLeftCollapsed)
  const aiAssistantBodyCollapsed = useDockingStore((state) => state.aiAssistantBodyCollapsed)
  const setAiAssistantBodyCollapsed = useDockingStore((state) => state.setAiAssistantBodyCollapsed)
  const undockWidget = useDockingStore((state) => state.undockWidget)
  const setDraggingWidgetId = useDockingStore((state) => state.setDraggingWidgetId)
  const registerWidget = useWidgetMetadataStore((state) => state.registerWidget)
  // Register widget metadata
  useEffect(() => {
    registerWidget(widgetId, { title, icon, actions })
  }, [widgetId, title, icon, actions, registerWidget])
  
  // Check if this widget is in a tabbed panel (multiple widgets in zone).
  // Sticky (right-top) widgets are rendered as separate panels, so always show their headers.
  const widgetsInZone = widget ? getWidgetsInZone(widget.zone) : []
  const isInTabbedPanel = widgetsInZone.length > 1 && widget?.zone !== 'right-top'
  const isSticky = widget?.zone === 'right-top'

  const handleCollapseClick = () => {
    if (widget?.zone === 'center-bottom') toggleCenterBottomCollapsed()
    else if (widget?.zone === 'left') toggleLeftCollapsed()
    else if ((widget?.zone === 'right-top' || widget?.zone === 'right-bottom') && widgetId === 'ai-assistant')
      setAiAssistantBodyCollapsed(!aiAssistantBodyCollapsed)
  }

  useEffect(() => {
    if (!isDragging) {
      // Remove any drag over classes when not dragging
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
        const currentWidget = store.widgets[widgetId]
        const currentIsSticky = currentWidget?.zone === 'right-top'
        const offset = store.stickyDragOffset

        setDragPosition({ x: e.clientX, y: e.clientY })
        if (currentIsSticky && bounds) {
          const vx = e.clientX - bounds.left
          const vy = e.clientY - bounds.top
          const x = offset ? vx - offset.x : vx
          const y = offset ? vy - offset.y : vy
          setStickyDrag(widgetId, { x, y })
        }
        // Zone detection for all panels (including sticky)
        const detectedZone = detectEdgeZone(e.clientX, e.clientY, bounds)
        // Apply highlight
        document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))
        setTargetZone(detectedZone)
        if (detectedZone && detectedZone !== currentWidget?.zone) {
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
      setIsDragging(false)
      setDraggingWidgetId(null)
      setTargetZone(null)
      setStickyDrag(null, null)
      document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))

      // Read latest store state directly
      const store = useDockingStore.getState()
      const bounds = store.viewportBounds
      const currentWidget = store.widgets[widgetId]
      const currentIsSticky = currentWidget?.zone === 'right-top'
      const offset = store.stickyDragOffset

      const dropZone = detectEdgeZone(e.clientX, e.clientY, bounds)

      if (currentIsSticky && bounds) {
        if (dropZone && dropZone !== currentWidget?.zone) {
          dockWidget(widgetId, dropZone)
          if (widgetId === 'ai-assistant') setAiAssistantBodyCollapsed(false)
        } else {
          const vx = e.clientX - bounds.left
          const vy = e.clientY - bounds.top
          const x = offset ? vx - offset.x : vx
          const y = offset ? vy - offset.y : vy
          const clampedX = Math.max(0, Math.min(bounds.width - STICKY_PANEL_MIN_WIDTH, x))
          const clampedY = Math.max(0, Math.min(bounds.height - STICKY_PANEL_MIN_HEIGHT, y))
          setWidgetPosition(widgetId, clampedX, clampedY)
        }
      } else if (!currentIsSticky) {
        if (dropZone && dropZone !== currentWidget?.zone) dockWidget(widgetId, dropZone)
      }

      document.body.style.cursor = ''
    }
    
    // Prevent all interactions during drag
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
      // Clean up any remaining drag over classes
      document.querySelectorAll('[data-zone]').forEach((el) => {
        el.classList.remove('dragOver')
      })
      // Remove drag mode styles
      document.body.classList.remove('dragging-widget')
      document.body.style.cursor = ''
    }
  }, [isDragging, widgetId, dockWidget, setWidgetPosition, setStickyDrag, setAiAssistantBodyCollapsed])
  
  const isCenterBottomCollapsed = widget?.zone === 'center-bottom' && centerBottomCollapsed
  const isLeftCollapsed = widget?.zone === 'left' && leftCollapsed
  const isCollapsed = isCenterBottomCollapsed || isLeftCollapsed
  const showCollapseButton =
    widgetId === 'ai-assistant'
      ? widget?.zone === 'right-top' || widget?.zone === 'right-bottom'
      : (widget?.zone === 'center-bottom' && !centerBottomCollapsed) ||
        (widget?.zone === 'left' && !leftCollapsed)
  const isAiAssistantCollapsed = widgetId === 'ai-assistant' && aiAssistantBodyCollapsed

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button
    if (isInTabbedPanel) return // Don't drag if in tabbed panel (TabbedPanel handles it)
    // AI Assistant: only allow dragging when in floating panel mode (sticky)
    if (widgetId === 'ai-assistant' && !isSticky) return

    const target = e.target as HTMLElement
    const isCornerDragHandle = target.closest(`.${styles.cornerDragHandle}`) !== null

    // When panel is collapsed, normal header click expands — but corner drag handle always starts drag
    if (isCollapsed && !isCornerDragHandle) {
      handleCollapseClick()
      return
    }

    // Don't start drag if clicking on interactive elements (except corner handles)
    if (!isCornerDragHandle) {
      const isInteractive = target.closest('button, input, a, [role="button"]') !== null
      if (isInteractive) return
    }

    setIsDragging(true)
    setDraggingWidgetId(widgetId)
    document.body.style.cursor = 'grabbing'
    if (isSticky && panelRef.current) {
      const bounds = useDockingStore.getState().viewportBounds
      if (bounds) {
        // Use the panel's actual DOM position so it doesn't jump (handles left/bottom, top/right defaults)
        const rect = panelRef.current.getBoundingClientRect()
        const panelLeft = rect.left - bounds.left
        const panelTop = rect.top - bounds.top
        const offsetX = e.clientX - rect.left
        const offsetY = e.clientY - rect.top
        setStickyDrag(widgetId, { x: panelLeft, y: panelTop }, { x: offsetX, y: offsetY })
      }
    }
    e.preventDefault()
    e.stopPropagation()
  }
  
  if (!widget) {
    // Widget not in store yet, but still render so it can be initialized
    return (
      <div className={`${styles.dockablePanel} ${className || ''}`} data-widget-id={widgetId}>
        {!isInTabbedPanel && (
          <div className={styles.draggableHeader}>
            <PanelHeader title={title} icon={icon} titleLeading={titleLeading} titleTrailing={titleTrailing} centerTitle={headerCenterTitle} titleFirst={headerTitleFirst} actions={actions} />
          </div>
        )}
        <div className={`${styles.panelContent} ${bodyCollapsed && (!collapsedShowsMinimalContent || collapsedHeaderContent) ? styles.panelContentCollapsed : ''} ${bodyCollapsed && collapsedShowsMinimalContent ? styles.panelContentMinimal : ''} ${bodyCollapsed && collapsedShowsMinimalContent ? styles.panelContentMinimalHeight : ''} ${contentFills && !(bodyCollapsed && collapsedShowsMinimalContent) ? styles.panelContentFills : ''}`}>
          {children}
        </div>
      </div>
    )
  }

  const showLeftCollapseInTitle = false

  const headerTitleLeading = showLeftCollapseInTitle ? (
    <>
      {showCollapseButton && (
        <button
          type="button"
          className={styles.collapseButton}
          onClick={(e) => {
            e.stopPropagation()
            handleCollapseClick()
          }}
          aria-label={isAiAssistantCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <img
            src={collapseIcon}
            alt=""
            width={16}
            height={16}
            className={isAiAssistantCollapsed ? styles.collapseIconExpand : undefined}
            aria-hidden
          />
        </button>
      )}
      {titleLeading}
    </>
  ) : titleLeading

  const collapseButtonEl =
    showCollapseButton && !showLeftCollapseInTitle ? (
      <button
        type="button"
        className={styles.collapseButton}
        onClick={(e) => {
          e.stopPropagation()
          handleCollapseClick()
        }}
        aria-label={isAiAssistantCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <img
          src={collapseIcon}
          alt=""
          width={16}
          height={16}
          className={isAiAssistantCollapsed ? styles.collapseIconExpand : undefined}
          aria-hidden
        />
      </button>
    ) : null

  const closeButtonEl =
    !hideCloseButton ? (
      <button
        type="button"
        className={styles.collapseButton}
        onClick={(e) => {
          e.stopPropagation()
          if (onClose) onClose()
          else undockWidget(widgetId)
        }}
        aria-label="Close"
      >
        <X size={16} />
      </button>
    ) : null

  const headerActions = widgetId === 'ai-assistant'
    ? (
      <>
        {actions}
        {collapseButtonEl}
        {closeButtonEl}
      </>
    ) : (
      <>
        {collapseButtonEl}
        {actions}
        {closeButtonEl}
      </>
    )

  return (
    <>
      <div 
        ref={panelRef}
        className={`${styles.dockablePanel} ${className || ''} ${isDragging && !isSticky ? styles.dragging : ''} ${isInTabbedPanel ? styles.inTabbedPanel : ''} ${isCollapsed ? styles.collapsedAsTab : ''} ${bodyCollapsed && hideHeaderWhenCollapsed ? styles.dockablePanelCornerDrag : ''} ${bodyCollapsed && hideHeaderWhenCollapsed && collapsedShowsMinimalContent ? styles.dockablePanelMinimalBar : ''}`}
        data-widget-id={widgetId}
      >
        {!isInTabbedPanel && (
          <div
            ref={headerRef}
            className={`${styles.draggableHeader} ${isDragging && !isSticky ? styles.dragging : ''} ${isCollapsed && !collapsedHeaderContent ? styles.collapsedHeader : ''} ${isCollapsed && collapsedHeaderContent ? styles.headerWithInlineContent : ''} ${bodyCollapsed && hideHeaderWhenCollapsed ? styles.headerCollapsedToBar : ''} ${widgetId === 'ai-assistant' && !isSticky ? styles.noDrag : ''}`}
            onMouseDown={handleMouseDown}
          >
            <PanelHeader
              title={title}
              icon={icon}
              titleLeading={headerTitleLeading}
              titleTrailing={titleTrailing}
              centerTitle={headerCenterTitle}
              titleFirst={headerTitleFirst}
              middle={bodyCollapsed ? collapsedHeaderContent : undefined}
              headerClassName={undefined}
              actions={headerActions}
            />
          </div>
        )}
        {!bodyCollapsed && headerMiddle && (
          <div className={styles.headerMiddleRow}>{headerMiddle}</div>
        )}
        <div className={`${styles.panelContent} ${bodyCollapsed && (!collapsedShowsMinimalContent || collapsedHeaderContent) ? styles.panelContentCollapsed : ''} ${bodyCollapsed && collapsedShowsMinimalContent ? styles.panelContentMinimal : ''} ${bodyCollapsed && collapsedShowsMinimalContent ? styles.panelContentMinimalHeight : ''} ${contentFills && !(bodyCollapsed && collapsedShowsMinimalContent) ? styles.panelContentFills : ''}`}>
          {children}
        </div>
        {bodyCollapsed && hideHeaderWhenCollapsed && widgetId !== 'ai-assistant' && (
          <>
            <div
              className={styles.cornerDragHandle}
              data-corner="top-left"
              onMouseDown={handleMouseDown}
              title="Drag to move"
              aria-label="Drag panel"
            />
            <div
              className={styles.cornerDragHandle}
              data-corner="top-right"
              onMouseDown={handleMouseDown}
              title="Drag to move"
              aria-label="Drag panel"
            />
            <div
              className={styles.cornerDragHandle}
              data-corner="bottom-left"
              onMouseDown={handleMouseDown}
              title="Drag to move"
              aria-label="Drag panel"
            />
            <div
              className={styles.cornerDragHandle}
              data-corner="bottom-right"
              onMouseDown={handleMouseDown}
              title="Drag to move"
              aria-label="Drag panel"
            />
          </>
        )}
      </div>
      
      {isDragging && !isSticky && (
        <div
          className={styles.dragPreview}
          style={{ left: dragPosition.x, top: dragPosition.y }}
        >
          <div className={styles.dragPreviewContent}>
            <PanelHeader
              title={title}
              icon={icon}
              titleLeading={headerTitleLeading}
              titleTrailing={titleTrailing}
              centerTitle={headerCenterTitle}
              titleFirst={headerTitleFirst}
              actions={headerActions}
              headerClassName={undefined}
            />
            <div className={styles.dragPreviewBody}>{children}</div>
          </div>
        </div>
      )}
    </>
  )
}

