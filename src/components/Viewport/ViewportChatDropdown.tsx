import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { stripLeadingBrackets, truncateTitle } from '../../ai/strip-brackets'
import { useConversationStore } from '../../store/conversationStore'
import { ExpandDownIcon } from '../shared/ExpandIcons'
import { MenuDropdown, type MenuItem } from '../shared/MenuDropdown'
import viewportStyles from './ViewportAIInput.module.css'

/** Sentinel value: user chose "New chat" but hasn't submitted yet */
export const NEW_CHAT_SENTINEL = '__new__'

interface ViewportChatDropdownProps {
  /** Locally-selected conversation id (or NEW_CHAT_SENTINEL). null = use global active. */
  selectedId: string | null
  /** Called when the user picks a conversation or "New chat" from the dropdown. */
  onSelect: (id: string) => void
}

export function ViewportChatDropdown({ selectedId, onSelect }: ViewportChatDropdownProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownOverlayRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; bottom: number } | null>(null)

  const listConversations = useConversationStore((state) => state.listConversations)
  const activeConversationId = useConversationStore((state) => state.activeConversationId)

  const conversations = listConversations()
  // The "effective" id shown as current: local override or global active
  const effectiveId = selectedId === NEW_CHAT_SENTINEL ? null : (selectedId ?? activeConversationId)
  const effectiveConversation = effectiveId ? conversations.find((c) => c.id === effectiveId) ?? null : null
  const otherConversations = conversations.filter((c) => c.id !== effectiveId)

  const menuItems: MenuItem[] = [
    {
      label: 'New chat',
      icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
      onClick: () => onSelect(NEW_CHAT_SENTINEL),
    },
    ...(conversations.length ? [{ divider: true } as MenuItem] : []),
    ...(effectiveConversation
      ? [
          {
            label: truncateTitle(effectiveConversation.summary || stripLeadingBrackets(effectiveConversation.title) || 'Untitled chat'),
            shortcut: 'Current',
            onClick: () => onSelect(effectiveConversation.id),
          },
        ]
      : []),
    ...otherConversations.map((conv) => ({
      label: truncateTitle(conv.summary || stripLeadingBrackets(conv.title) || 'Untitled chat'),
      onClick: () => onSelect(conv.id),
    })),
  ]

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

  const activeConversationLabel = selectedId === NEW_CHAT_SENTINEL
    ? 'New chat'
    : effectiveConversation
      ? truncateTitle(effectiveConversation.summary || stripLeadingBrackets(effectiveConversation.title))
      : 'Chats'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={viewportStyles.viewportChatTrigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Chat history – select conversation"
        title={activeConversationLabel}
        data-open={open}
      >
        <span className={viewportStyles.viewportChatTriggerLabel}>{activeConversationLabel}</span>
        <ExpandDownIcon />
      </button>
      {open &&
        dropdownPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownOverlayRef}
            className={viewportStyles.viewportChatDropdownOverlay}
            data-viewport-chat-dropdown
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
