import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react'
import nebulaViewportIcon from '../../../icons/nebula-viewport.svg'
import bubbleIcon from '../../../icons/bubble.svg'
import sendIcon from '../../../icons/send.svg'
import { useEditorStore } from '../../store/editorStore'
import { useDockingStore } from '../../store/dockingStore'
import { useConversationStore } from '../../store/conversationStore'
import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'
import { useCommentStore } from '../../store/commentStore'
import { ViewportChatDropdown } from './ViewportChatDropdown'
import { PillInput } from '../shared/PillInput'
import { MentionDropdown, type MentionItem } from '../shared/MentionDropdown'
import { SlashCommandDropdown } from '../shared/SlashCommandDropdown'
import { SLASH_COMMANDS } from '../shared/slashCommands'
import { MENTION_TOOLS } from './mentionItems'
import { stripLeadingBrackets, truncateTitle } from '../../ai/strip-brackets'
import type { InputSegment, PillInputHandle, MentionQuery, SlashCommandQuery } from '../../types'
import styles from './ViewportAIInput.module.css'

export function ViewportAIInput() {
  const [segments, setSegments] = useState<InputSegment[]>([])
  const [expandedIndicatorId, setExpandedIndicatorId] = useState<string | null>(null)
  const pillInputRef = useRef<PillInputHandle>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null)
  const [slashQuery, setSlashQuery] = useState<SlashCommandQuery | null>(null)
  // Local conversation selection — only applied to the store when user hits send (doSubmit), never on dropdown select
  const [pendingConvId, setPendingConvId] = useState<string | null>(null)
  const handleChatSelect = useCallback((id: string) => {
    setPendingConvId(id)
    // Keep focus in viewport input; do not move to main composer until send
    requestAnimationFrame(() => pillInputRef.current?.focus())
  }, [])
  const visible = useDockingStore((s) => s.viewportAIInputOpen)
  const setVisible = useDockingStore((s) => s.setViewportAIInputOpen)
  const aiGenerating = useEditorStore((s) => s.aiGenerating)
  const aiWorkingObjectPositions = useEditorStore((s) => s.aiWorkingObjectPositions)
  const gameObjects = useEditorStore((s) => s.gameObjects)
  const collaborators = useEditorStore((s) => s.collaborators)
  const rootObjectIds = useEditorStore((s) => s.rootObjectIds)
  const aiInputAnchorPosition = useEditorStore((s) => s.aiInputAnchorPosition)

  const mentionItems: MentionItem[] = useMemo(() => {
    const items: MentionItem[] = []
    // Collaborators
    for (const c of collaborators) {
      items.push({ id: c.id, label: c.name, kind: 'collaborator', category: 'collaborator' })
    }
    // Scene objects
    const workspaceId = rootObjectIds[0]
    const workspace = workspaceId ? gameObjects[workspaceId] : null
    if (workspace?.children) {
      for (const childId of workspace.children) {
        const obj = gameObjects[childId]
        if (obj && obj.name !== 'Drops') {
          items.push({
            id: childId,
            label: obj.name,
            kind: 'object',
            category: 'object',
            objectType: obj.primitiveType === 'terrain' ? 'terrain' : obj.type !== 'mesh' && obj.type !== 'empty' ? obj.type : undefined,
          })
        }
      }
    }
    // Tools
    items.push(...MENTION_TOOLS)
    return items
  }, [collaborators, gameObjects, rootObjectIds])

  // @-mention picking mode
  const mentionPickingSource = useEditorStore((s) => s.mentionPickingSource)
  const mentionPickedObject = useEditorStore((s) => s.mentionPickedObject)

  useEffect(() => {
    if (mentionQuery) {
      useEditorStore.getState().setMentionPickingSource('viewport-input')
    } else {
      if (useEditorStore.getState().mentionPickingSource === 'viewport-input') {
        useEditorStore.getState().setMentionPickingSource(null)
      }
    }
  }, [mentionQuery])

  // Consume picked object from viewport
  useEffect(() => {
    if (!mentionPickedObject) return
    if (mentionPickingSource !== 'viewport-input') return
    pillInputRef.current?.replaceMentionWithPill({
      id: mentionPickedObject.id,
      label: mentionPickedObject.name,
      kind: 'object',
      objectType: mentionPickedObject.objectType,
    })
    useEditorStore.getState().setMentionPickedObject(null)
    useEditorStore.getState().setMentionPickingSource(null)
    setMentionQuery(null)
  }, [mentionPickedObject, mentionPickingSource])

  // Clear picking mode when overlay closes or on unmount
  useEffect(() => {
    if (!visible) {
      if (useEditorStore.getState().mentionPickingSource === 'viewport-input') {
        useEditorStore.getState().setMentionPickingSource(null)
      }
    }
  }, [visible])
  useEffect(() => {
    return () => {
      if (useEditorStore.getState().mentionPickingSource === 'viewport-input') {
        useEditorStore.getState().setMentionPickingSource(null)
      }
    }
  }, [])

  const doSubmit = useCallback(() => {
    let text = pillInputRef.current?.getTextContent()?.trim() ?? ''
    if (!text) return

    // Check if any collaborator pills are present → route to comments instead of AI
    const collabPills = segments.filter(
      (s) => s.type === 'pill' && s.kind === 'collaborator',
    )
    if (collabPills.length > 0) {
      // Strip collaborator names from the text for the comment body
      const commentText = segments
        .map((s) => (s.type === 'text' ? s.text : s.kind === 'collaborator' ? '' : s.label))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      useCommentStore.getState().addComment({
        author: 'You',
        text: commentText,
        taggedCollaboratorIds: collabPills.map((s) => s.type === 'pill' ? s.id : ''),
        taggedCollaboratorNames: collabPills.map((s) => s.type === 'pill' ? s.label : ''),
      })
      // Open the comments panel so the user sees their comment
      const dock = useDockingStore.getState()
      if (!dock.widgets['comments']) {
        dock.dockWidget('comments', 'right-top')
      }
      setSegments([])
      setVisible(false)
      return
    }

    // When pen tool is active, prepend world-position context from last drawn position
    const editorState = useEditorStore.getState()
    if (editorState.activeTool === 'pen' && editorState.penToolLastDrawnPosition && editorState.screenToWorld) {
      const { x, y } = editorState.penToolLastDrawnPosition
      const worldPos = editorState.screenToWorld(x, y)
      if (worldPos) {
        text = `[Context: the user drew near world position [${worldPos.x}, ${worldPos.y}, ${worldPos.z}]] ${text}`
      }
    }

    // When area selection circle exists, prepend spatial context
    if (editorState.areaSelectionCircle && editorState.screenToWorld) {
      const c = editorState.areaSelectionCircle
      const centerWorld = editorState.screenToWorld(c.centerX, c.centerY)
      const edgeWorld = editorState.screenToWorld(c.centerX + c.radius, c.centerY)
      if (centerWorld) {
        let worldRadius = 0
        if (edgeWorld) {
          const dx = edgeWorld.x - centerWorld.x
          const dy = edgeWorld.y - centerWorld.y
          const dz = edgeWorld.z - centerWorld.z
          worldRadius = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 100) / 100
        }
        text = `[Context: the user circled an area centered at world position [${centerWorld.x}, ${centerWorld.y}, ${centerWorld.z}], approximate world radius: ${worldRadius}. Objects inside this area are already selected.] ${text}`
      }
      editorState.setAreaSelectionCircle(null)
    }

    // Signal generating state immediately so the toolbar spinner shows
    const edState = useEditorStore.getState()
    edState.setAiGenerating(true)
    // Snapshot selected objects as "working" so per-object indicators appear
    if (edState.selectedObjectIds.length > 0) {
      edState.setAiWorkingObjectIds(new Set(edState.selectedObjectIds))
    }
    // Route through background tasks so simple tasks stay as viewport bubbles
    // without opening the expanded composer. Plans/conversations will be
    // promoted to the full assistant panel by the background task runner.
    useBackgroundTaskStore.getState().enqueueTask(text)
    setSegments([])
    setPendingConvId(null)
    setVisible(false)
    // Hide the AI panel so only the viewport bubble shows progress
    const dock = useDockingStore.getState()
    if (dock.widgets['ai-assistant']) {
      dock.undockWidget('ai-assistant')
    }
    // Keep selection so Cmd+/ "remembers" what was selected for follow-up actions
  }, [setVisible, segments])

  // Focus input when overlay opens; reset state when it closes
  const prevVisibleRef = useRef(visible)
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => pillInputRef.current?.focus(), 0)
      prevVisibleRef.current = true
      return () => clearTimeout(t)
    }
    if (prevVisibleRef.current) {
      setSegments([])
      setPendingConvId(null)
      setMentionQuery(null)
      setSlashQuery(null)
    }
    prevVisibleRef.current = false
  }, [visible])

  // Click outside: close contextual input
  useEffect(() => {
    if (!visible) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (overlayRef.current && !overlayRef.current.contains(target)) {
        // Don't close when clicking the viewport canvas (user is selecting assets)
        if (target.hasAttribute?.('data-viewport-canvas')) return
        // Don't close when clicking the @ mention dropdown (portaled to body)
        if (target.closest('[role="listbox"][aria-label="Mention"]')) return
        // Don't close when clicking the chat dropdown (portaled to body)
        if (target.closest('[data-viewport-chat-dropdown]')) return
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown, true)
    return () => document.removeEventListener('mousedown', handleMouseDown, true)
  }, [visible, setVisible])

  const handleProgressClick = useCallback(() => {
    const dock = useDockingStore.getState()
    if (!dock.widgets['ai-assistant']) {
      dock.dockWidget('ai-assistant', 'right-top')
    }
    dock.setAiAssistantBodyCollapsed(false)
    // Switch to the background task's conversation if one is running
    const runningTask = useBackgroundTaskStore.getState().tasks.find(
      (t) => t.status === 'running' && t.conversationId,
    )
    if (runningTask?.conversationId) {
      useConversationStore.getState().switchConversation(runningTask.conversationId)
    }
  }, [])

  // Clamp the mini composer inside the viewport frame so it stays visible
  useLayoutEffect(() => {
    if (!visible) return
    const overlayEl = overlayRef.current
    if (!overlayEl) return
    const parentEl = overlayEl.parentElement
    if (!parentEl) return

    const parentRect = parentEl.getBoundingClientRect()
    const overlayRect = overlayEl.getBoundingClientRect()
    const margin = 8

    const width = overlayRect.width
    const height = overlayRect.height

    let centerX = aiInputAnchorPosition ? aiInputAnchorPosition.x : parentRect.width / 2
    let top = aiInputAnchorPosition
      ? aiInputAnchorPosition.y
      : parentRect.height - 16 - height

    const halfWidth = width / 2
    const minCenterX = margin + halfWidth
    const maxCenterX = parentRect.width - margin - halfWidth
    if (centerX < minCenterX) centerX = minCenterX
    if (centerX > maxCenterX) centerX = maxCenterX

    const minTop = margin
    const maxTop = parentRect.height - margin - height
    if (top < minTop) top = minTop
    if (top > maxTop) top = maxTop

    overlayEl.style.left = `${centerX}px`
    overlayEl.style.top = `${top}px`
    overlayEl.style.bottom = 'auto'
    overlayEl.style.transform = 'translateX(-50%)'
  }, [visible, aiInputAnchorPosition])

  const showIndicator = !visible && aiGenerating

  if (showIndicator) {
    const runningTask = useBackgroundTaskStore.getState().tasks.find(
      (t) => t.status === 'running',
    )
    const taskLabel = runningTask
      ? truncateTitle(stripLeadingBrackets(runningTask.summary || runningTask.command), 50)
      : 'Working...'
    const taskFull = runningTask
      ? stripLeadingBrackets(runningTask.summary || runningTask.command)
      : 'Working...'

    // When objects have tracked positions, attach a bubble to each one.
    // Otherwise show a single bubble at the bottom-center of the viewport.
    const positions = aiWorkingObjectPositions.length > 0
      ? aiWorkingObjectPositions
      : aiInputAnchorPosition
        ? [{ id: '__anchor__', x: aiInputAnchorPosition.x, y: aiInputAnchorPosition.y }]
        : [{ id: '__viewport-center__', x: -1, y: -1 }]

    return (
      <>
        {positions.map((pos) => {
          const isCentered = pos.id === '__viewport-center__'
          return (
            <div
              key={pos.id}
              className={`${styles.progressIndicator} ${expandedIndicatorId === pos.id ? styles.progressIndicatorExpanded : ''} ${isCentered ? styles.progressIndicatorCentered : ''}`}
              style={isCentered ? undefined : { left: pos.x, top: pos.y }}
              onClick={() => {
                if (expandedIndicatorId === pos.id) {
                  setExpandedIndicatorId(null)
                  handleProgressClick()
                } else {
                  setExpandedIndicatorId(pos.id)
                }
              }}
            >
              <div className={styles.progressBubbleIcon}>
                <img src={bubbleIcon} alt="" width={32} height={32} />
                <img
                  src={nebulaViewportIcon}
                  alt=""
                  width={24}
                  height={24}
                  className={styles.progressBubbleInnerIcon}
                />
              </div>
              {expandedIndicatorId === pos.id ? (
                <div className={styles.progressExpanded}>
                  <span className={styles.progressExpandedText}>{taskFull}</span>
                </div>
              ) : (
                <div className={styles.progressBubble}>
                  <span className={styles.progressBubbleText}>{taskLabel}</span>
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }

  if (!visible) {
    return null
  }

  const hasText = segments.some(s => s.type === 'text' && s.text.trim()) || segments.some(s => s.type === 'pill')

  return (
    <div ref={overlayRef} className={styles.overlay}>
      <div className={styles.inputRow} role="search">
        <div className={styles.inputRowInner}>
          <PillInput
          ref={pillInputRef}
          segments={segments}
          onSegmentsChange={setSegments}
          onSubmit={doSubmit}
          placeholder="Build anything"
          autoFocus
          className={styles.pillsAndInput}
          ariaLabel="Describe what to do"
          onMentionQuery={setMentionQuery}
          onSlashQuery={setSlashQuery}
        />
        <MentionDropdown
          mention={mentionQuery}
          items={mentionItems}
          pillInputRef={pillInputRef}
          onClose={() => setMentionQuery(null)}
        />
        <SlashCommandDropdown
          query={slashQuery}
          commands={SLASH_COMMANDS}
          pillInputRef={pillInputRef}
          onClose={() => setSlashQuery(null)}
        />
          <ViewportChatDropdown selectedId={pendingConvId} onSelect={handleChatSelect} />
          <button
            type="button"
            className={styles.sendButton}
            onClick={doSubmit}
            disabled={!hasText || aiGenerating}
            title="Send"
            aria-label="Send"
          >
            <img src={sendIcon} alt="" width={16} height={16} className={styles.sendButtonIcon} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
