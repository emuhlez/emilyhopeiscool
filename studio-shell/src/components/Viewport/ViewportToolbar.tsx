import { memo, useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { EditorState } from '../../types'
import { publicUrl } from '../../utils/assetUrl'
import styles from './ViewportToolbar.module.css'

type ToolId = NonNullable<EditorState['activeTool']>

function useTools() {
  return useMemo(
    () =>
      [
        { id: 'select' as ToolId, icon: 'select.svg', label: 'Select', title: 'Select (S)' },
        { id: 'move' as ToolId, icon: 'move.svg', label: 'Move', title: 'Move (W)' },
        { id: 'rotate' as ToolId, icon: 'rotate.svg', label: 'Rotate', title: 'Rotate (E)' },
        { id: 'scale' as ToolId, icon: 'scale.svg', label: 'Scale', title: 'Scale (R)' },
        { id: 'transform' as ToolId, icon: 'transform.svg', label: 'Transform', title: 'Transform (T)' },
        { id: 'pen' as ToolId, icon: 'pen.svg', label: 'Pen', title: 'Pen — Sketch for AI (P)' },
      ].map((t) => ({
        ...t,
        icon: <img src={publicUrl(`icons/${t.icon}`)} alt="" width={16} height={16} className={styles.toolIconImg} />,
      })),
    []
  )
}

export const ViewportToolbar = memo(function ViewportToolbar() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const TOOLS = useTools()

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Viewport tools">
      <div className={styles.track}>
        {TOOLS.map(({ id, icon, label, title }) => (
          <button
            key={id}
            type="button"
            className={`${styles.toolBtn} ${activeTool === id ? styles.active : ''}`}
            onClick={() => setActiveTool(activeTool === id ? null : id)}
            title={title}
            aria-label={label}
            aria-pressed={activeTool === id}
          >
            {icon}
          </button>
        ))}
        <div className={styles.divider} aria-hidden />
        <button
          type="button"
          className={styles.dotsBtn}
          title="More options"
          aria-label="More options"
        >
          <img
            src={publicUrl('icons/more.svg')}
            alt=""
            width={16}
            height={16}
            className={styles.toolIconImg}
          />
        </button>
      </div>
    </div>
  )
})
