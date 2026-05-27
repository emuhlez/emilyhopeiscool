export type DrawingTool = 'freehand' | 'line' | 'rect' | 'circle' | 'eraser'

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  tool: DrawingTool
  points: Point[]
  color: string
  width: number
}

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  ctx.save()

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
  }

  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (stroke.tool) {
    case 'freehand':
    case 'eraser':
      renderFreehand(ctx, stroke.points)
      break
    case 'line':
      renderLine(ctx, stroke.points)
      break
    case 'rect':
      renderRect(ctx, stroke.points)
      break
    case 'circle':
      renderCircle(ctx, stroke.points)
      break
  }

  ctx.restore()
}

function renderFreehand(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return
  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
}

function renderLine(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) return
  const start = points[0]
  const end = points[points.length - 1]
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
}

function renderRect(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) return
  const start = points[0]
  const end = points[points.length - 1]
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const w = Math.abs(end.x - start.x)
  const h = Math.abs(end.y - start.y)
  ctx.strokeRect(x, y, w, h)
}

function renderCircle(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) return
  const start = points[0]
  const end = points[points.length - 1]
  const cx = (start.x + end.x) / 2
  const cy = (start.y + end.y) / 2
  const rx = Math.abs(end.x - start.x) / 2
  const ry = Math.abs(end.y - start.y) / 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()
}

export function renderAllStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const stroke of strokes) {
    renderStroke(ctx, stroke)
  }
}
