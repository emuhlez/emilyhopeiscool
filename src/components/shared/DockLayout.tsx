import { useCallback, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useDockingStore, LEFT_COLLAPSED_WIDTH } from '../../store/dockingStore'
import type { DockZone } from '../../types'
import styles from './DockLayout.module.css'

type ResizeDirection = 'n' | 's' | 'e' | 'w'

interface ResizeHandleProps {
  direction: ResizeDirection
  onDrag: (deltaX: number, deltaY: number) => void
  className?: string
}

function ResizeHandle({ direction, onDrag, className }: ResizeHandleProps) {
  const draggingRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      startRef.current = { x: e.clientX, y: e.clientY }
      draggingRef.current = true
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      startRef.current = { x: e.clientX, y: e.clientY }
      onDrag(dx, dy)
    },
    [onDrag]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      draggingRef.current = false
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    },
    []
  )

  return (
    <div
      role="separator"
      aria-orientation={direction === 'e' || direction === 'w' ? 'vertical' : 'horizontal'}
      className={`${styles.resizeHandle} ${styles[`resizeHandle_${direction}`]} ${className ?? ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}

interface DockZoneContainerProps {
  zone: DockZone
  children: ReactNode
  className?: string
}

export function DockZoneContainer({ zone, children, className }: DockZoneContainerProps) {
  const widgets = useDockingStore((state) => state.getWidgetsInZone(zone))
  const isEmpty = widgets.length === 0
  
  return (
    <div 
      className={`${styles.dockZone} ${styles[zone]} ${className || ''} ${isEmpty ? styles.empty : ''}`}
      data-zone={zone}
    >
      {children}
    </div>
  )
}

interface DockLayoutProps {
  leftZone: ReactNode
  centerTopZone: ReactNode
  centerBottomZone: ReactNode
  /** Sticky viewport panels keyed by widget id (inspector, ai-assistant). Replaces rightTopZone. */
  rightTopPanels: Record<string, ReactNode>
  rightBottomZone: ReactNode
}

/** Sticky panels (e.g. Properties): below viewport panel header, equal right spacing */
const STICKY_RIGHT_INSET = 16
const STICKY_TOP_INSET = 52 /* panel header (~36px) + gap so panel sits just below */
const DEFAULT_STICKY_INSET = { top: STICKY_TOP_INSET, right: STICKY_RIGHT_INSET }
/** AI Assistant (collapsed and expanded): sticky at bottom-left of viewport with spacing */
const DEFAULT_AI_ASSISTANT_INSET = { left: 16, bottom: 16 }

export function DockLayout({ leftZone, centerTopZone, centerBottomZone, rightTopPanels, rightBottomZone }: DockLayoutProps) {
  const leftWidgets = useDockingStore((state) => state.getWidgetsInZone('left'))
  const centerTopWidgets = useDockingStore((state) => state.getWidgetsInZone('center-top'))
  const centerBottomWidgets = useDockingStore((state) => state.getWidgetsInZone('center-bottom'))
  const rightBottomWidgets = useDockingStore((state) => state.getWidgetsInZone('right-bottom'))
  const stickyWidgets = useDockingStore((state) => state.getStickyWidgets())
  const draggingStickyWidgetId = useDockingStore((state) => state.draggingStickyWidgetId)
  const stickyDragPosition = useDockingStore((state) => state.stickyDragPosition)
  const draggingWidgetId = useDockingStore((state) => state.draggingWidgetId)
  const inspectorBodyCollapsed = useDockingStore((state) => state.inspectorBodyCollapsed)
  const aiAssistantBodyCollapsed = useDockingStore((state) => state.aiAssistantBodyCollapsed)
  const viewportAIInputOpen = useDockingStore((state) => state.viewportAIInputOpen)
  const aiAssistantWidth = useDockingStore((state) => state.aiAssistantWidth)
  const setAiAssistantWidth = useDockingStore((state) => state.setAiAssistantWidth)
  const panelSizes = useDockingStore((state) => state.panelSizes)
  const centerBottomCollapsed = useDockingStore((state) => state.centerBottomCollapsed)
  const leftCollapsed = useDockingStore((state) => state.leftCollapsed)
  const setPanelSize = useDockingStore((state) => state.setPanelSize)
  const setViewportBounds = useDockingStore((state) => state.setViewportBounds)
  const viewportRef = useRef<HTMLDivElement>(null)

  const hasLeftWidgets = leftWidgets.length > 0
  const hasCenterWidgets = centerTopWidgets.length > 0 || centerBottomWidgets.length > 0
  const hasCenterBottomWidgets = centerBottomWidgets.length > 0
  const hasRightWidgets = rightBottomWidgets.length > 0
  const isDraggingAnyWidget = !!draggingWidgetId

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setViewportBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setViewportBounds, hasCenterWidgets])

  const onResizeLeft = useCallback(
    (dx: number) => setPanelSize('leftWidth', panelSizes.leftWidth + dx),
    [panelSizes.leftWidth, setPanelSize]
  )
  const onResizeRight = useCallback(
    (dx: number) => setPanelSize('rightWidth', panelSizes.rightWidth - dx),
    [panelSizes.rightWidth, setPanelSize]
  )
  const onResizeCenterBottom = useCallback(
    (dy: number) => setPanelSize('centerBottomHeight', panelSizes.centerBottomHeight + dy),
    [panelSizes.centerBottomHeight, setPanelSize]
  )
  return (
    <div className={styles.dockLayout}>
      <div
        className={`${styles.leftColumn} ${!hasLeftWidgets ? styles.emptyColumn : ''} ${hasLeftWidgets && leftCollapsed ? styles.leftCollapsed : ''}`}
        style={
          hasLeftWidgets
            ? {
                flex: '0 0 auto',
                width: leftCollapsed ? LEFT_COLLAPSED_WIDTH : panelSizes.leftWidth,
                minWidth: leftCollapsed ? LEFT_COLLAPSED_WIDTH : panelSizes.leftWidth,
                maxWidth: leftCollapsed ? LEFT_COLLAPSED_WIDTH : panelSizes.leftWidth,
              }
            : undefined
        }
      >
        <DockZoneContainer zone="left">
          {leftZone}
        </DockZoneContainer>
        {hasLeftWidgets && (
          <ResizeHandle
            direction="e"
            className={styles.resizeHandleLeft}
            onDrag={(dx) => onResizeLeft(dx)}
          />
        )}
      </div>

      <div ref={viewportRef} className={styles.centerColumnWrapper}>
        <div className={`${styles.centerColumn} ${!hasCenterWidgets ? styles.emptyColumn : ''}`}>
          <div className={styles.centerTop}>
            <DockZoneContainer zone="center-top">
              {centerTopZone}
            </DockZoneContainer>
          </div>
          {hasCenterWidgets && hasCenterBottomWidgets && (
            <ResizeHandle
              direction="s"
              className={styles.resizeHandleCenterBottom}
              onDrag={(_, dy) => onResizeCenterBottom(dy)}
            />
          )}
          <div
            className={`${styles.centerBottom} ${!hasCenterBottomWidgets ? styles.centerBottomHidden : ''} ${hasCenterBottomWidgets && centerBottomCollapsed ? styles.centerBottomCollapsed : ''}`}
            style={hasCenterBottomWidgets ? { height: centerBottomCollapsed ? 36 : panelSizes.centerBottomHeight } : undefined}
          >
            <DockZoneContainer zone="center-bottom">
              {centerBottomZone}
            </DockZoneContainer>
          </div>
        </div>

        {isDraggingAnyWidget && (
          <>
            <div className={styles.dockEdge} data-zone="left" data-edge="left" />
            <div className={styles.dockEdge} data-zone="center-top" data-edge="top" />
            <div className={styles.dockEdge} data-zone="center-bottom" data-edge="bottom" />
            <div className={styles.dockEdge} data-zone="right-bottom" data-edge="right" />
            <div className={styles.dockCenter} data-edge="center" />
          </>
        )}

        {stickyWidgets.length > 0 && (
          <div className={styles.stickyLayer} aria-hidden="false">
            {stickyWidgets.map((w) => {
              const content = rightTopPanels[w.id]
              if (!content) return null
              /* Hide AI Assistant sticky panel when viewport AI input is open (contextual mode) */
              if (w.id === 'ai-assistant' && viewportAIInputOpen) return null
              const isDraggingThis = draggingStickyWidgetId === w.id && stickyDragPosition
              const collapsed =
                (w.id === 'inspector' && inspectorBodyCollapsed) ||
                (w.id === 'ai-assistant' && aiAssistantBodyCollapsed)
              const isAiAssistantCollapsed = w.id === 'ai-assistant' && collapsed
              const defaultInset =
                w.id === 'ai-assistant'
                  ? { left: DEFAULT_AI_ASSISTANT_INSET.left, bottom: DEFAULT_AI_ASSISTANT_INSET.bottom, top: 'auto' as const }
                  : { top: DEFAULT_STICKY_INSET.top, right: DEFAULT_STICKY_INSET.right, left: 'auto' as const }
              /* Collapsed AI assistant is always anchored to viewport corner (bottom-left); expanded uses saved position */
              // When dragging, disable pointer-events so elementFromPoint can detect zones underneath
              const style = isDraggingThis
                ? { left: stickyDragPosition.x, top: stickyDragPosition.y, pointerEvents: 'none' as const }
                : w.id === 'ai-assistant' && collapsed
                  ? defaultInset
                  : w.id === 'ai-assistant'
                    ? w.position
                      ? { left: w.position.x, top: w.position.y }
                      : defaultInset
                    : w.position
                      ? { left: w.position.x, top: w.position.y }
                      : defaultInset
              const panelStyle = w.id === 'ai-assistant' && !collapsed
                ? { ...style, '--sticky-panel-width': `${aiAssistantWidth}px` } as unknown as React.CSSProperties
                : style
              return (
                <div
                  key={w.id}
                  className={`${styles.stickyPanel} ${collapsed ? styles.stickyPanelCollapsed : ''} ${isAiAssistantCollapsed ? styles.stickyPanelAiCollapsed : ''}`}
                  style={panelStyle}
                >
                  {content}
                  {w.id === 'ai-assistant' && !collapsed && (
                    <ResizeHandle
                      direction="e"
                      className={styles.stickyResizeHandle}
                      onDrag={(dx) => setAiAssistantWidth(aiAssistantWidth + dx)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasRightWidgets && (
        <div
          className={styles.rightColumnOverlay}
          style={{ width: panelSizes.rightWidth, minWidth: panelSizes.rightWidth }}
        >
          <ResizeHandle
            direction="w"
            className={styles.resizeHandleRight}
            onDrag={(dx) => onResizeRight(dx)}
          />
          <div className={styles.rightTop}>
            <DockZoneContainer zone="right-bottom">
              {rightBottomZone}
            </DockZoneContainer>
          </div>
        </div>
      )}
    </div>
  )
}

