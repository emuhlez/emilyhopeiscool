import { useRef, useState, useEffect, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useDockingStore } from '../../store/dockingStore'
import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'
import { processCommand } from '../../ai/keyword-engine'
import { executeTool } from '../../ai/tool-executor'
import { PenToolbar } from './PenToolbar'
import { renderAllStrokes, renderStroke, type Stroke, type Point, type DrawingTool } from './drawing-engine'
import styles from './PenToolOverlay.module.css'

export function PenToolOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('freehand')
  const [color, setColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [isSending, setIsSending] = useState(false)
  const isDrawing = useRef(false)

  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const aiInputOpen = useDockingStore((s) => s.viewportAIInputOpen)

  // Resize canvas to match container
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      redraw()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [strokes])

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    renderAllStrokes(ctx, strokes)
  }, [strokes])

  const getPoint = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || aiInputOpen) return
    isDrawing.current = true
    canvasRef.current?.setPointerCapture(e.pointerId)
    const point = getPoint(e)
    const stroke: Stroke = {
      tool: drawingTool,
      points: [point],
      color,
      width: strokeWidth,
    }
    setCurrentStroke(stroke)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || !currentStroke) return
    const point = getPoint(e)
    const updated = { ...currentStroke, points: [...currentStroke.points, point] }
    setCurrentStroke(updated)

    // Live preview
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      renderAllStrokes(ctx, strokes)
      renderStroke(ctx, updated)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDrawing.current || !currentStroke) return
    isDrawing.current = false
    setStrokes((prev) => [...prev, currentStroke])
    setCurrentStroke(null)
    // Anchor contextual input (Cmd+/) near this point when opened in pen tool
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      useEditorStore.getState().setPenToolLastDrawnPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const handleUndo = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) renderAllStrokes(ctx, next)
      return next
    })
  }

  const handleClear = () => {
    setStrokes([])
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  const handleCapture = async () => {
    const canvas = canvasRef.current
    if (!canvas || strokes.length === 0) return

    setIsSending(true)
    let taskId: string | null = null
    try {
      // Compute bounding-box center of all strokes for spatial positioning
      let worldPos: { x: number; y: number; z: number } | null = null
      const allPoints = strokes.flatMap((s) => s.points)
      if (allPoints.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const p of allPoints) {
          if (p.x < minX) minX = p.x
          if (p.y < minY) minY = p.y
          if (p.x > maxX) maxX = p.x
          if (p.y > maxY) maxY = p.y
        }
        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2
        const screenToWorld = useEditorStore.getState().screenToWorld
        if (screenToWorld) {
          worldPos = screenToWorld(centerX, centerY)
        }
      }

      // With local keyword engine, create a simple object at the sketch location
      taskId = useBackgroundTaskStore.getState().addRunningTask('Generating from sketch...')

      const editorState = useEditorStore.getState()
      const sceneContext = {
        gameObjects: editorState.gameObjects,
        selectedObjectIds: editorState.selectedObjectIds,
        rootObjectIds: editorState.rootObjectIds,
      }

      // Generate a basic object at the drawn position
      const position: [number, number, number] = worldPos
        ? [worldPos.x, worldPos.y, worldPos.z]
        : [0, 1, 0]

      const result = processCommand(`add a box at ${position[0]} ${position[1]} ${position[2]}`, sceneContext)
      for (const tc of result.toolCalls) {
        executeTool(tc.toolName, tc.args)
      }

      if (taskId) useBackgroundTaskStore.getState().completeTask(taskId)
    } catch (e) {
      console.error('[PenTool] Generate failed:', e)
      useEditorStore.getState().log(`Pen tool generation failed: ${e}`, 'error', 'PenTool')
      if (taskId) useBackgroundTaskStore.getState().failTask(taskId, String(e))
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    setActiveTool('select')
  }

  const isAILoading = useBackgroundTaskStore((s) => s.tasks.some((t) => t.status === 'running'))

  return (
    <div ref={containerRef} className={styles.overlay}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={aiInputOpen ? { pointerEvents: 'none' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <PenToolbar
        activeTool={drawingTool}
        onToolChange={setDrawingTool}
        color={color}
        onColorChange={setColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        onUndo={handleUndo}
        onClear={handleClear}
        onCapture={handleCapture}
        onClose={handleClose}
        canUndo={strokes.length > 0}
        isSending={isSending || isAILoading}
      />
    </div>
  )
}
