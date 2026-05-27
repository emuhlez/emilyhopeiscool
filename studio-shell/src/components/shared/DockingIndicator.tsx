import { useEffect, useState } from 'react'
import type { DockZone } from '../../types'
import styles from './DockingIndicator.module.css'

interface DockingIndicatorProps {
  targetZone: DockZone | null
  hoveredZone: DockZone | null
  onZoneHover: (zone: DockZone | null) => void
  isVisible: boolean
}

export function DockingIndicator({ targetZone, hoveredZone, onZoneHover, isVisible }: DockingIndicatorProps) {
  const [indicatorPosition, setIndicatorPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!targetZone || !isVisible) {
      return
    }

    let rafId: number | null = null
    
    const updatePosition = () => {
      // Use requestAnimationFrame to prevent glitches
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      
      rafId = requestAnimationFrame(() => {
        const zoneElement = document.querySelector(`[data-zone="${targetZone}"]`) as HTMLElement
        if (zoneElement) {
          const rect = zoneElement.getBoundingClientRect()
          setIndicatorPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        } else {
          // Fallback: try to find the column and position indicator there
          let targetRect: DOMRect | null = null
          
          if (targetZone === 'left') {
            const leftCol = document.querySelector('.leftColumn')
            if (leftCol) targetRect = leftCol.getBoundingClientRect()
          } else if (targetZone === 'right-top' || targetZone === 'right-bottom') {
            const rightCol = document.querySelector('.rightColumn')
            if (rightCol) {
              const rect = rightCol.getBoundingClientRect()
              const halfH = rect.height / 2
              targetRect = new DOMRect(
                rect.left,
                targetZone === 'right-top' ? rect.top : rect.top + halfH,
                rect.width,
                halfH
              )
            }
          } else if (targetZone === 'center-top' || targetZone === 'center-bottom') {
            const centerCol = document.querySelector('.centerColumn')
            if (centerCol) {
              const rect = centerCol.getBoundingClientRect()
              targetRect = new DOMRect(
                rect.left,
                targetZone === 'center-top' ? rect.top : rect.top + rect.height * 0.6,
                rect.width,
                rect.height * 0.4
              )
            }
          }
          
          if (targetRect) {
            setIndicatorPosition({
              x: targetRect.left + targetRect.width / 2,
              y: targetRect.top + targetRect.height / 2,
            })
          }
        }
      })
    }

    updatePosition()
    
    // Update on scroll/resize (throttled)
    let resizeTimeout: number | null = null
    const throttledUpdate = () => {
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = window.setTimeout(updatePosition, 16) // ~60fps
    }
    
    window.addEventListener('scroll', throttledUpdate, true)
    window.addEventListener('resize', throttledUpdate)
    
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout)
      }
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
    }
  }, [targetZone, isVisible])

  if (!isVisible || !targetZone) {
    return null
  }

  const getZoneClass = (zone: DockZone) => {
    switch (zone) {
      case 'left':
        return styles.leftZone
      case 'right-top':
      case 'right-bottom':
        return styles.rightZone
      case 'center-top':
        return styles.centerTopZone
      case 'center-bottom':
        return styles.centerBottomZone
      default:
        return ''
    }
  }

  return (
    <div
      className={`${styles.dockingIndicator} ${getZoneClass(targetZone)}`}
      style={{
        left: indicatorPosition.x,
        top: indicatorPosition.y,
      }}
    >
      <div className={styles.cross}>
        <div 
          className={`${styles.center} ${hoveredZone === targetZone ? styles.centerActive : ''}`}
          onMouseEnter={() => onZoneHover(targetZone)}
          onMouseLeave={() => onZoneHover(null)}
        />
        <div 
          className={`${styles.arm} ${hoveredZone === 'left' ? styles.active : ''}`} 
          data-direction="left"
          data-zone="left"
          onMouseEnter={() => onZoneHover('left')}
          onMouseLeave={() => onZoneHover(null)}
        >
          <span className={styles.zoneLabel}>Left</span>
        </div>
        <div 
          className={`${styles.arm} ${hoveredZone === 'right-top' ? styles.active : ''}`} 
          data-direction="right"
          data-zone="right-top"
          onMouseEnter={() => onZoneHover('right-top')}
          onMouseLeave={() => onZoneHover(null)}
        >
          <span className={styles.zoneLabel}>Right top</span>
        </div>
        <div 
          className={`${styles.arm} ${hoveredZone === 'right-bottom' ? styles.active : ''}`} 
          data-direction="right"
          data-zone="right-bottom"
          onMouseEnter={() => onZoneHover('right-bottom')}
          onMouseLeave={() => onZoneHover(null)}
        >
          <span className={styles.zoneLabel}>Right bottom</span>
        </div>
        <div 
          className={`${styles.arm} ${hoveredZone === 'center-top' ? styles.active : ''}`} 
          data-direction="top"
          data-zone="center-top"
          onMouseEnter={() => onZoneHover('center-top')}
          onMouseLeave={() => onZoneHover(null)}
        >
          <span className={styles.zoneLabel}>Top</span>
        </div>
        <div 
          className={`${styles.arm} ${hoveredZone === 'center-bottom' ? styles.active : ''}`} 
          data-direction="bottom"
          data-zone="center-bottom"
          onMouseEnter={() => onZoneHover('center-bottom')}
          onMouseLeave={() => onZoneHover(null)}
        >
          <span className={styles.zoneLabel}>Bottom</span>
        </div>
      </div>
      
      {(targetZone === 'center-top' || targetZone === 'center-bottom') && (
        <div className={styles.splitIndicator}>
          <div className={styles.splitSegment} />
          <div className={styles.splitArrow} data-direction={targetZone === 'center-top' ? 'up' : 'down'} />
          <div className={styles.splitSegment} />
        </div>
      )}
    </div>
  )
}

