import type { ReactNode } from 'react'
import { Box } from 'lucide-react'
import styles from './SelectionPill.module.css'

export interface SelectionPillProps {
  /** Display label (e.g. object name or "3 objects") */
  label: string
  /** Icon shown to the left of the label. Defaults to Box. */
  icon?: ReactNode
  /** Optional title for tooltip */
  title?: string
  className?: string
}

export function SelectionPill({ label, icon, title, className }: SelectionPillProps) {
  return (
    <span
      className={`${styles.pill} ${className ?? ''}`}
      title={title ?? label}
    >
      <span className={styles.icon} aria-hidden>
        {icon ?? <Box size={12} />}
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  )
}
