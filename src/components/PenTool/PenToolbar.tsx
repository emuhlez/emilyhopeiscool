import { Pencil, Minus, Square, Circle, Eraser, Undo2, Trash2, X } from 'lucide-react'
import type { DrawingTool } from './drawing-engine'
import styles from './PenToolbar.module.css'

interface PenToolbarProps {
  activeTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  color: string
  onColorChange: (color: string) => void
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  onUndo: () => void
  onClear: () => void
  onCapture: () => void
  onClose: () => void
  canUndo: boolean
  isSending: boolean
}

const TOOLS: { tool: DrawingTool; icon: typeof Pencil; label: string }[] = [
  { tool: 'freehand', icon: Pencil, label: 'Freehand' },
  { tool: 'line', icon: Minus, label: 'Line' },
  { tool: 'rect', icon: Square, label: 'Rectangle' },
  { tool: 'circle', icon: Circle, label: 'Circle' },
  { tool: 'eraser', icon: Eraser, label: 'Eraser' },
]

const COLORS = ['#ffffff', '#ff3333', '#33cc33', '#3399ff', '#ffcc00', '#ff66ff', '#ff9933', '#666666']

export function PenToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onClear,
  onCapture,
  onClose,
  canUndo,
  isSending,
}: PenToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.section}>
        {TOOLS.map(({ tool, icon: Icon, label }) => (
          <button
            key={tool}
            className={`${styles.toolBtn} ${activeTool === tool ? styles.active : ''}`}
            onClick={() => onToolChange(tool)}
            title={label}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.colorPicker}>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`${styles.colorSwatch} ${color === c ? styles.colorActive : ''}`}
              style={{ background: c }}
              onClick={() => onColorChange(c)}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <label className={styles.widthLabel}>
          <span>{strokeWidth}px</span>
          <input
            type="range"
            min={1}
            max={20}
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className={styles.widthSlider}
          />
        </label>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <button
          className={styles.toolBtn}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          className={styles.toolBtn}
          onClick={onClear}
          title="Clear"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className={styles.divider} />

      <button
        className={styles.captureBtn}
        onClick={onCapture}
        disabled={isSending}
        title="Generate"
      >
        <span>Generate</span>
      </button>

      <button
        className={styles.closeBtn}
        onClick={onClose}
        title="Close Pen Tool"
      >
        <X size={14} />
      </button>
    </div>
  )
}
