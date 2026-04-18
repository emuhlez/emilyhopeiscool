import { useCallback, useEffect, useRef } from 'react'
import { useNotesStore } from '../../../stores/notes-store'

const SAVE_DEBOUNCE = 300

export function NotesEditor() {
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId)
  const notes = useNotesStore((s) => s.notes)
  const updateNote = useNotesStore((s) => s.updateNote)

  const note = notes.find((n) => n.id === selectedNoteId)
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNoteIdRef = useRef<string | null>(null)

  // Load note content when selection changes
  useEffect(() => {
    if (!editorRef.current) return
    if (note && note.id !== lastNoteIdRef.current) {
      editorRef.current.innerHTML = note.body
      lastNoteIdRef.current = note.id
    } else if (!note) {
      editorRef.current.innerHTML = ''
      lastNoteIdRef.current = null
    }
  }, [note])

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!editorRef.current || !selectedNoteId) return
      const html = editorRef.current.innerHTML

      // Extract title from the first heading or first line of text
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html
      const firstHeading = tempDiv.querySelector('h1, h2, h3')
      const title = firstHeading
        ? (firstHeading.textContent ?? '').trim()
        : (tempDiv.textContent ?? '').trim().split('\n')[0].slice(0, 80)

      updateNote(selectedNoteId, {
        title: title || 'Untitled',
        body: html,
      })
    }, SAVE_DEBOUNCE)
  }, [selectedNoteId, updateNote])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'b') {
          e.preventDefault()
          document.execCommand('bold')
          debouncedSave()
        } else if (e.key === 'i') {
          e.preventDefault()
          document.execCommand('italic')
          debouncedSave()
        }
      }
    },
    [debouncedSave],
  )

  // Handle checkbox clicks inside the contentEditable
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
        // Let the browser handle the toggle naturally, just save after
        debouncedSave()
      }
    },
    [debouncedSave],
  )

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Select a note or create a new one
        </span>
      </div>
    )
  }

  return (
    <div
      ref={editorRef}
      className="notes-editor flex-1 overflow-y-auto px-6 py-4 outline-none"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onInput={debouncedSave}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      style={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        lineHeight: 1.6,
        caretColor: '#FFC149',
      }}
    />
  )
}
