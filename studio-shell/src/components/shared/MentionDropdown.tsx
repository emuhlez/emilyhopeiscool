import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import type { MentionQuery, PillInputHandle, PillKind } from '../../types'
import { publicUrl } from '../../utils/assetUrl'
import styles from './MentionDropdown.module.css'

export interface MentionItem {
  id: string
  label: string
  kind: PillKind
  category: 'collaborator' | 'object' | 'tool'
  /** For scene objects: the GameObject type or primitiveType, used to pick the right icon */
  objectType?: string
}

interface MentionDropdownProps {
  mention: MentionQuery | null
  items: MentionItem[]
  pillInputRef: React.RefObject<PillInputHandle | null>
  onClose: () => void
}

type CategoryKey = 'collaborator' | 'object' | 'tool'

const CATEGORY_ORDER: CategoryKey[] = ['collaborator', 'object', 'tool']
const CATEGORY_LABELS: Record<string, string> = {
  collaborator: 'Collaborators',
  object: 'Scene Objects',
  tool: 'Tools',
}

/** Collaborator avatar colors (deterministic by name) */
const AVATAR_COLORS = ['#7b8af9', '#f97b8a', '#8af97b', '#f9d67b', '#7bf9e0', '#d67bf9']

/** Small avatar for collaborators — initial-based, no external network requests */
function CollaboratorAvatar({ label }: { label: string }) {
  const initial = (label || '?').charAt(0).toUpperCase()
  const colorIdx = label.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return (
    <span
      className={styles.avatar}
      aria-hidden
      title={label}
      style={{ background: AVATAR_COLORS[colorIdx] }}
    >
      <span className={styles.avatarInitial}>{initial}</span>
    </span>
  )
}

/** Map scene-object types to their explorer-style icons (mirrors PillInput). */
const OBJECT_TYPE_ICON_PATH: Record<string, string> = {
  model: 'icons/model.svg',
  mesh: 'icons/meshpart.svg',
  meshpart: 'icons/meshpart.svg',
  camera: 'icons/camera.svg',
  terrain: 'icons/terrain.svg',
  light: 'icons/terrain.svg',
}

/** FileCode icon for script objects (mirrors PillInput's inline SVG). */
const FILECODE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/></svg>`

function ObjectTypeIcon({ objectType }: { objectType?: string }) {
  if (objectType === 'script') {
    return (
      <span
        aria-hidden
        style={{ display: 'inline-flex', alignItems: 'center' }}
        dangerouslySetInnerHTML={{ __html: FILECODE_SVG }}
      />
    )
  }
  const path = OBJECT_TYPE_ICON_PATH[objectType ?? ''] ?? 'icons/model.svg'
  return <img src={publicUrl(path)} alt="" width={12} height={12} aria-hidden />
}

function ItemIcon({ item }: { item: MentionItem }) {
  if (item.category === 'collaborator') {
    return <CollaboratorAvatar label={item.label} />
  }
  if (item.category === 'object') {
    return <ObjectTypeIcon objectType={item.objectType} />
  }
  return null
}

const SUBMENU_HOVER_DELAY_MS = 120

export function MentionDropdown({ mention, items, pillInputRef, onClose }: MentionDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const subMenuRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(0)
  const closeSubMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null)

  const clearCloseSubMenuTimeout = useCallback(() => {
    if (closeSubMenuTimeoutRef.current !== null) {
      clearTimeout(closeSubMenuTimeoutRef.current)
      closeSubMenuTimeoutRef.current = null
    }
  }, [])

  const scheduleCloseSubMenu = useCallback(() => {
    clearCloseSubMenuTimeout()
    closeSubMenuTimeoutRef.current = setTimeout(() => {
      closeSubMenuTimeoutRef.current = null
      setExpandedCategory(null)
    }, SUBMENU_HOVER_DELAY_MS)
  }, [clearCloseSubMenuTimeout])

  const hasQuery = mention ? mention.query.length > 0 : false

  const filtered = useMemo(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [mention, items])

  // When no query: group all items for sub-menus. When query: group filtered items for inline list.
  const groups = useMemo(() => {
    const source = hasQuery ? filtered : items
    const map = new Map<string, MentionItem[]>()
    for (const item of source) {
      const arr = map.get(item.category) ?? []
      arr.push(item)
      map.set(item.category, arr)
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, label: CATEGORY_LABELS[cat], items: map.get(cat)! }))
  }, [hasQuery, filtered, items])

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Reset selection when query changes
  useEffect(() => {
    selectedRef.current = 0
    setExpandedCategory(null)
    clearCloseSubMenuTimeout()
  }, [mention?.query, clearCloseSubMenuTimeout])

  // Clear close timeout on unmount
  useEffect(() => {
    return () => clearCloseSubMenuTimeout()
  }, [clearCloseSubMenuTimeout])

  const selectItem = useCallback(
    (item: MentionItem) => {
      pillInputRef.current?.replaceMentionWithPill({
        id: item.id,
        label: item.label,
        kind: item.kind,
        objectType: item.objectType,
      })
      setExpandedCategory(null)
      onClose()
    },
    [pillInputRef, onClose],
  )

  // Close sub-menu on click outside
  useEffect(() => {
    if (expandedCategory === null) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current?.contains(target) ||
        subMenuRef.current?.contains(target)
      ) return
      setExpandedCategory(null)
    }
    document.addEventListener('mousedown', handleMouseDown, true)
    return () => document.removeEventListener('mousedown', handleMouseDown, true)
  }, [expandedCategory])

  // Keyboard: when no query, move over categories and Enter opens sub-menu; when query, move over items
  useEffect(() => {
    if (!mention) return
    const handler = (e: KeyboardEvent) => {
      if (hasQuery) {
        if (flatItems.length === 0) return
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          selectedRef.current = Math.min(selectedRef.current + 1, flatItems.length - 1)
          updateHighlight()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          selectedRef.current = Math.max(selectedRef.current - 1, 0)
          updateHighlight()
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          if (flatItems[selectedRef.current]) {
            e.preventDefault()
            e.stopPropagation()
            selectItem(flatItems[selectedRef.current])
          }
        }
      } else {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          selectedRef.current = Math.min(selectedRef.current + 1, groups.length - 1)
          updateHighlight()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          selectedRef.current = Math.max(selectedRef.current - 1, 0)
          updateHighlight()
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          const group = groups[selectedRef.current]
          if (group) {
            e.preventDefault()
            e.stopPropagation()
            setExpandedCategory(group.category)
          }
        } else if (e.key === 'Escape') {
          if (expandedCategory !== null) {
            e.preventDefault()
            setExpandedCategory(null)
          }
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
  }, [mention, hasQuery, flatItems, groups, selectItem, expandedCategory])

  // No mention, or with query but no matches: hide
  if (!mention) return null
  if (hasQuery && flatItems.length === 0) return null
  // No query: show only if we have at least one category with items
  if (!hasQuery && groups.length === 0) return null

  const { rect } = mention
  const mainStyle: React.CSSProperties = {
    left: rect.left,
    top: rect.top - 6,
    transform: 'translateY(-100%)',
  }

  // No query: only category rows (sub-menus on hover or click)
  if (!hasQuery) {
    const dropdown = (
      <>
        <div
          ref={menuRef}
          className={styles.dropdown}
          style={mainStyle}
          role="listbox"
          aria-label="Mention"
          data-node-id="1181:1558"
        >
          {groups.map((group, i) => (
            <div
              key={group.category}
              className={styles.categoryRow}
              role="option"
              data-selected={String(i === selectedRef.current)}
              aria-selected={i === selectedRef.current}
              onMouseEnter={() => {
                clearCloseSubMenuTimeout()
                setExpandedCategory(group.category)
              }}
              onMouseLeave={scheduleCloseSubMenu}
              onMouseDown={(e) => {
                e.preventDefault()
                setExpandedCategory((prev) => (prev === group.category ? null : group.category))
              }}
            >
              <span className={styles.categoryLabel}>{group.label}</span>
              <ChevronRight size={14} className={styles.categoryChevron} />
            </div>
          ))}
        </div>
        {expandedCategory !== null && (() => {
          const group = groups.find((g) => g.category === expandedCategory)
          if (!group || group.items.length === 0) return null
          const subRect = menuRef.current?.getBoundingClientRect()
          const subLeft = subRect ? subRect.right + 4 : rect.left + 224
          const subTop = subRect ? subRect.top : rect.top - 6
          return createPortal(
            <div
              ref={subMenuRef}
              className={styles.subMenu}
              style={{ left: subLeft, top: subTop }}
              role="listbox"
              aria-label={group.label}
              onMouseEnter={clearCloseSubMenuTimeout}
              onMouseLeave={scheduleCloseSubMenu}
            >
              {group.items.map((item, _i) => (
                <div
                  key={item.id}
                  className={styles.option}
                  role="option"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectItem(item)
                  }}
                >
                  {(item.category === 'collaborator' || item.category === 'object') && (
                    <span className={styles.icon}>
                      <ItemIcon item={item} />
                    </span>
                  )}
                  <span className={styles.label}>{item.label}</span>
                </div>
              ))}
            </div>,
            document.body
          )
        })()}
      </>
    )
    return createPortal(dropdown, document.body)
  }

  // Has query: categories with items inline (current behavior)
  let flatIdx = 0
  const dropdown = (
    <div
      ref={menuRef}
      className={styles.dropdown}
      style={mainStyle}
      role="listbox"
      aria-label="Mention"
      data-node-id="1181:1558"
    >
      {groups.map((group) => (
        <div key={group.category} className={styles.section}>
          <div className={styles.categoryHeader} aria-hidden>
            <span className={styles.categoryLabel}>{group.label}</span>
          </div>
          {group.items.map((item) => {
            const i = flatIdx++
            return (
              <div
                key={item.id}
                className={styles.option}
                role="option"
                data-selected={String(i === selectedRef.current)}
                aria-selected={i === selectedRef.current}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectItem(item)
                }}
              >
                <span className={styles.icon}>
                  <ItemIcon item={item} />
                </span>
                <span className={styles.label}>{item.label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  return createPortal(dropdown, document.body)
}
