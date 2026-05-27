import { useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { SlashCommandQuery, PillInputHandle } from '../../types'
import type { SlashCommand } from './slashCommands'
import styles from './MentionDropdown.module.css'

interface SlashCommandDropdownProps {
  query: SlashCommandQuery | null
  commands: SlashCommand[]
  pillInputRef: React.RefObject<PillInputHandle | null>
  onClose: () => void
}

export function SlashCommandDropdown({ query, commands, pillInputRef, onClose }: SlashCommandDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(0)

  const filtered = useMemo(() => {
    if (!query) return []
    const q = query.query.toLowerCase()
    return commands.filter((cmd) => cmd.label.toLowerCase().includes(q) || cmd.id.toLowerCase().includes(q))
  }, [query, commands])

  // Reset selection when query changes
  useEffect(() => {
    selectedRef.current = 0
  }, [query?.query])

  const selectItem = useCallback(
    (cmd: SlashCommand) => {
      pillInputRef.current?.replaceSlashCommand(cmd.label)
      onClose()
    },
    [pillInputRef, onClose],
  )

  // Keyboard navigation
  useEffect(() => {
    if (!query || filtered.length === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        selectedRef.current = Math.min(selectedRef.current + 1, filtered.length - 1)
        updateHighlight()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        selectedRef.current = Math.max(selectedRef.current - 1, 0)
        updateHighlight()
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedRef.current]) {
          e.preventDefault()
          e.stopPropagation()
          selectItem(filtered[selectedRef.current])
        }
      }
    }
    const updateHighlight = () => {
      const options = menuRef.current?.querySelectorAll('[role="option"]')
      options?.forEach((el, i) => {
        ;(el as HTMLElement).dataset.selected = String(i === selectedRef.current)
      })
      options?.[selectedRef.current]?.scrollIntoView({ block: 'nearest' })
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [query, filtered, selectItem])

  if (!query || filtered.length === 0) return null

  const { rect } = query
  const menuStyle: React.CSSProperties = {
    left: rect.left,
    top: rect.top - 6,
    transform: 'translateY(-100%)',
  }

  const dropdown = (
    <div
      ref={menuRef}
      className={styles.dropdown}
      style={menuStyle}
      role="listbox"
      aria-label="Slash commands"
    >
      {filtered.map((cmd, i) => (
        <div
          key={cmd.id}
          className={styles.option}
          role="option"
          data-selected={String(i === selectedRef.current)}
          aria-selected={i === selectedRef.current}
          onMouseDown={(e) => {
            e.preventDefault()
            selectItem(cmd)
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            <span className={styles.label}>{cmd.label}</span>
            <span className={styles.description}>{cmd.description}</span>
          </div>
        </div>
      ))}
    </div>
  )

  return createPortal(dropdown, document.body)
}
