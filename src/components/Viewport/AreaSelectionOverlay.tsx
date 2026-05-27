import { useEditorStore } from '../../store/editorStore'
import styles from './AreaSelectionOverlay.module.css'

export function AreaSelectionOverlay() {
  const circle = useEditorStore((s) => s.areaSelectionCircle)

  if (!circle || circle.radius <= 0) return null

  return (
    <svg className={styles.overlay} width="100%" height="100%">
      {/* Outer glow */}
      <circle
        cx={circle.centerX}
        cy={circle.centerY}
        r={circle.radius}
        fill="none"
        stroke="rgba(52,152,219,0.25)"
        strokeWidth={6}
      />
      {/* Main dashed ring */}
      <circle
        className={styles.ring}
        cx={circle.centerX}
        cy={circle.centerY}
        r={circle.radius}
        fill="rgba(52,152,219,0.12)"
        stroke="rgba(52,152,219,0.85)"
        strokeWidth={2.5}
        strokeDasharray="8 5"
      />
      {/* Center dot */}
      <circle
        cx={circle.centerX}
        cy={circle.centerY}
        r={4}
        fill="rgba(52,152,219,0.9)"
      />
    </svg>
  )
}
