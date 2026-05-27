import { useEffect, useRef } from 'react'
import { useDockingStore } from '../../store/dockingStore'
import styles from './SettingsPanel.module.css'

export function SettingsPanel() {
  const open = useDockingStore((s) => s.settingsPanelOpen)
  const setOpen = useDockingStore((s) => s.setSettingsPanelOpen)

  const studioMode = useDockingStore((s) => s.studioMode)
  const setStudioMode = useDockingStore((s) => s.setStudioMode)

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent) => {
      const container = ref.current?.parentElement
      if (container && !container.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div ref={ref} className={styles.dropdown}>
      {/* Studio */}
      <div className={styles.sectionHeader}>Studio</div>
      <label className={styles.radioRow}>
        <input
          type="radio"
          name="studio-mode"
          checked={studioMode === 'ribbon'}
          onChange={() => setStudioMode('ribbon')}
        />
        Ribbon
      </label>
      <label className={styles.radioRow}>
        <input
          type="radio"
          name="studio-mode"
          checked={studioMode === 'shell'}
          onChange={() => setStudioMode('shell')}
        />
        Shell
      </label>
    </div>
  )
}
