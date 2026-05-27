import { useRef, memo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Viewport3D } from './Viewport3D'
import { ViewportAIInput } from './ViewportAIInput'
import { ViewportToolbar } from './ViewportToolbar'
import { PenToolOverlay } from '../PenTool/PenToolOverlay'
import styles from './Viewport.module.css'

export const Viewport = memo(function Viewport() {
  const canvas3DRef = useRef<HTMLDivElement>(null)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const activeTool = useEditorStore((s) => s.activeTool)

  return (
    <div className={styles.viewport}>
      <div className={styles.canvas}>
        {/* Toolbar in top-left corner – functioning widget */}
        <ViewportToolbar />
        {/* 3D workspace – assets from /3d-space */}
        <div ref={canvas3DRef} className={styles.canvas3D} />
        <Viewport3D containerRef={canvas3DRef} />

        {/* Center crosshair — hidden in game mode */}
        {!isPlaying && (
          <div className={styles.origin}>
            <div className={styles.originX} />
            <div className={styles.originY} />
          </div>
        )}

        {isPlaying && (
          <div className={styles.info}>
            <span className={styles.playingBadge}>&#9654; Game mode — Arrow keys move • Esc exit</span>
          </div>
        )}

        {activeTool === 'pen' && !isPlaying && <PenToolOverlay />}

        {/* Pill-shaped AI input: Cmd+/ toggles; in pen tool mode, requests use sketch context (generate vs annotate). */}
        <ViewportAIInput />
      </div>
    </div>
  )
})
