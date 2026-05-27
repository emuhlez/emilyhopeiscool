import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ExpandDownIcon } from '../shared/ExpandIcons'
import { MenuDropdown, type MenuItem } from '../shared/MenuDropdown'
import viewportStyles from './ViewportAIInput.module.css'

export interface Agent {
  id: string
  label: string
  description?: string
}

export const AGENTS: Agent[] = [
  { id: 'auto', label: 'Auto', description: 'Automatically picks the best model for the task' },
  { id: 'claude-opus-4.7', label: 'Claude Opus 4.7', description: 'Most capable reasoning — best for complex, multi-step work' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', description: 'Balanced speed and intelligence — great default' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', description: 'Fastest Claude — quick edits and light tasks' },
  { id: 'gpt-5.4', label: 'GPT-5.4', description: 'OpenAI flagship — broad general capability' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', description: 'OpenAI coding specialist' },
  { id: 'composer-2-fast', label: 'Composer 2 Fast', description: 'Low-latency inline model' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Google flagship — long context' },
]

interface AgentDropdownProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

export function AgentDropdown({ selectedId, onSelect }: AgentDropdownProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownOverlayRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; bottom: number } | null>(null)

  const effectiveId = selectedId || 'auto'
  const effectiveAgent = AGENTS.find((a) => a.id === effectiveId) ?? AGENTS[0]

  const menuItems: MenuItem[] = AGENTS.map((agent) => ({
    label: agent.label,
    shortcut: agent.id === effectiveId ? 'Active' : undefined,
    onClick: () => onSelect(agent.id),
  }))

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setDropdownPosition(null)
      return
    }
    const triggerRect = triggerRef.current.getBoundingClientRect()
    setDropdownPosition({
      left: triggerRect.left,
      bottom: window.innerHeight - triggerRect.top + 4,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        dropdownOverlayRef.current?.contains(target)
      )
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={viewportStyles.viewportChatTrigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select agent"
        title={effectiveAgent.label}
        data-open={open}
      >
        <span className={viewportStyles.viewportChatTriggerLabel}>{effectiveAgent.label}</span>
        <ExpandDownIcon />
      </button>
      {open &&
        dropdownPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownOverlayRef}
            className={viewportStyles.viewportChatDropdownOverlay}
            style={{
              left: dropdownPosition.left,
              bottom: dropdownPosition.bottom,
            }}
          >
            <MenuDropdown
              items={menuItems}
              isOpen={open}
              onClose={() => setOpen(false)}
              className={viewportStyles.viewportChatDropdown}
            />
          </div>,
          document.body
        )}
    </>
  )
}
