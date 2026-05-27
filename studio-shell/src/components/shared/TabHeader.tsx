import { useRef, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useDockingStore } from '../../store/dockingStore'
import styles from './TabHeader.module.css'

export interface Tab {
  id: string
  title: string
  icon?: ReactNode
  actions?: ReactNode
}

interface TabHeaderProps {
  tabs: Tab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
  onTabClose?: (tabId: string) => void
  title?: string
  className?: string
}

export function TabHeader({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose: _onTabClose,
  title,
  className
}: TabHeaderProps) {
  const draggingWidgetId = useDockingStore((s) => s.draggingWidgetId)
  const isDraggingExternal = !!draggingWidgetId && !tabs.some((t) => t.id === draggingWidgetId)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!tabsRef.current) return
    const rect = tabsRef.current.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    // Only show indicator if cursor is within the tabs area (with some vertical tolerance)
    if (y < rect.top - 8 || y > rect.bottom + 8 || x < rect.left - 16 || x > rect.right + 16) {
      setDropIndex(null)
      return
    }
    // Find the closest gap between tabs
    const tabElements = tabsRef.current.querySelectorAll('[data-tab-id]')
    let bestIndex = tabs.length // Default: after last tab
    let bestDist = Infinity
    tabElements.forEach((el, i) => {
      const tabRect = el.getBoundingClientRect()
      // Left edge of this tab = gap before it
      const leftDist = Math.abs(x - tabRect.left)
      if (leftDist < bestDist) {
        bestDist = leftDist
        bestIndex = i
      }
      // Right edge of last tab = gap after it
      if (i === tabElements.length - 1) {
        const rightDist = Math.abs(x - tabRect.right)
        if (rightDist < bestDist) {
          bestDist = rightDist
          bestIndex = i + 1
        }
      }
    })
    setDropIndex(bestIndex)
  }, [tabs.length])

  useEffect(() => {
    if (!isDraggingExternal) {
      setDropIndex(null)
      return
    }
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      setDropIndex(null)
    }
  }, [isDraggingExternal, handleMouseMove])

  if (tabs.length <= 1) {
    // Single tab - show as regular header
    const tab = tabs[0]
    return (
      <div className={`${styles.header} ${className || ''}`}>
        {title && <span className={styles.zoneTitle}>{title}</span>}
        <div className={styles.titleArea}>
          <h2 className={styles.title}>{tab.title}</h2>
        </div>
        {isDraggingExternal && (
          <div className={styles.tabDropIndicator} />
        )}
        {tab.actions && <div className={styles.actions}>{tab.actions}</div>}
      </div>
    )
  }

  // Multiple tabs - show tab interface
  return (
    <div className={`${styles.tabContainer} ${className || ''}`}>
      {title && <span className={styles.zoneTitle}>{title}</span>}
      <div className={styles.tabs} ref={tabsRef}>
        {tabs.map((tab, i) => {
          const isActive = tab.id === activeTabId
          return (
            <span key={tab.id} style={{ display: 'contents' }}>
              {isDraggingExternal && dropIndex === i && (
                <div className={styles.tabDropIndicator} />
              )}
              <button
                data-tab-id={tab.id}
                className={`${styles.tab} ${isActive ? styles.active : ''}`}
                onClick={() => onTabSelect(tab.id)}
                title={tab.title}
              >
                <span className={styles.tabTitle}>{tab.title}</span>
              </button>
            </span>
          )
        })}
        {isDraggingExternal && dropIndex === tabs.length && (
          <div className={styles.tabDropIndicator} />
        )}
      </div>
      {tabs.find(t => t.id === activeTabId)?.actions && (
        <div className={styles.actions}>
          {tabs.find(t => t.id === activeTabId)?.actions}
        </div>
      )}
    </div>
  )
}


