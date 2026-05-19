import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  filterPhotosBySection,
  usePhotosStore,
  type PhotoItem,
} from '../../../stores/photos-store'

/* Trackpad pinch gestures and Ctrl+scroll on a mouse wheel both surface as
 * `wheel` events with `event.ctrlKey === true` in Chromium/Electron. The
 * grid's zoom value is *continuous* (1.0..5.0), so we translate each wheel
 * tick into a fractional zoom delta — the visual scale tracks the gesture
 * pixel-by-pixel rather than snapping between the 5 discrete row-height
 * stops. Lower = more sensitive (faster zoom per pinch). 250 was picked so
 * a deliberate ~½-second pinch traverses ~1 full discrete stop. */
const PINCH_DELTA_PER_UNIT = 250

/* Row-height stops for zoom 1..5 (px). Zoom 1 is the square "contact sheet"
 * (smaller because the appeal is density). Zooms 2..5 grow moderately —
 * the dramatic visual change between zoom stops is *density* (see
 * `RATIO_SUM_BY_ZOOM`), not size, but photos still grow enough that the
 * pinch gesture has continuous visual feedback as it interpolates between
 * adjacent stops. */
const ROW_HEIGHTS = [80, 100, 120, 145, 175] as const

/* Height of the floating photo / video count footer (px). The footer is
 * absolutely positioned at the bottom of the grid so photos scroll behind
 * it — this constant is also used to push the scroll container's bottom
 * padding clear of the footer and to inset the custom scrollbar so its
 * thumb resting position lines up with the footer's top edge. */
const FOOTER_H = 28

/* Density (target sum of aspect ratios per row) for justified zooms 2..5.
 * Lower number = fewer photos per row = each photo takes more horizontal
 * space. Each stop reads as a distinctly different *layout density*:
 *   zoom 2: ~6 photos / row, zoom 3: ~4, zoom 4: ~2-3, zoom 5: fixed 2.
 * (Zoom 1 is square contact-sheet mode and doesn't use these values for
 * packing — only for the last-row spacer.) */
const RATIO_SUM_BY_ZOOM = [8, 8, 5, 3, 2] as const

function interpolateRowHeight(zoom: number): number {
  const z = Math.max(1, Math.min(5, zoom))
  const lo = Math.floor(z)
  const hi = Math.ceil(z)
  if (lo === hi) return ROW_HEIGHTS[lo - 1]
  const t = z - lo
  return ROW_HEIGHTS[lo - 1] * (1 - t) + ROW_HEIGHTS[hi - 1] * t
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/**
 * Single photo tile + its overlays (comment badge, video duration, favorite
 * heart). Extracted so the justified-row mode and the uniform-square-grid
 * mode can render the same visual without duplicating the overlay JSX.
 *
 * Sizing is layout-mode dependent and passed in via `style`:
 *  - Justified mode passes `flex: <ratio>` so the tile fills its row slice.
 *  - Square mode passes explicit `width`/`height` so the tile is a true
 *    `rowHeight × rowHeight` square inside a flex-wrap grid.
 */
function PhotoTile({
  photo,
  isSelected,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
  style,
  square = false,
}: {
  photo: PhotoItem
  isSelected: boolean
  isHovered: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  style: CSSProperties
  /** When true, the photo is rendered as a true 1:1 square (zoom-1 mode). */
  square?: boolean
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        minWidth: 0,
        cursor: 'default',
        borderRadius: square ? 0 : 3,
        outline: isSelected ? '2.5px solid #0A84FF' : 'none',
        outlineOffset: square ? 0 : -2,
        opacity: isHovered && !isSelected ? 0.92 : 1,
        transition: 'opacity 140ms cubic-bezier(0.32, 0.72, 0, 1)',
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        className="h-full w-full object-cover"
        draggable={false}
      />

      {photo.hasComment && (
        <div className="absolute" style={{ left: 4, bottom: 4 }}>
          <CommentBadge />
        </div>
      )}

      {photo.isVideo && photo.duration != null && (
        <div
          className="absolute"
          style={{
            right: 4,
            bottom: 4,
            fontFamily:
              '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            letterSpacing: '0.01em',
          }}
        >
          {formatDuration(photo.duration)}
        </div>
      )}

      {photo.favorite && !photo.hasComment && (
        <div className="absolute" style={{ left: 4, bottom: 4 }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="#fff">
            <path
              d="M8 13.6 C5 11.6 2.2 9.5 2.2 7 A2.8 2.8 0 0 1 8 5.3 A2.8 2.8 0 0 1 13.8 7 C13.8 9.5 11 11.6 8 13.6 Z"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
            />
          </svg>
        </div>
      )}
    </div>
  )
}

function CommentBadge() {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <path
          d="M1.4 4.5 a3 3 0 1 1 1.4 2.5 L1 8 L1.6 6.4 a3 3 0 0 1 -0.2 -1.9 z"
          fill="#fff"
        />
      </svg>
    </div>
  )
}

export function PhotosGrid({ topInset = 0 }: { topInset?: number }) {
  const photos = usePhotosStore((s) => s.photos)
  const selectedSection = usePhotosStore((s) => s.selectedSection)
  const selectedPhotoId = usePhotosStore((s) => s.selectedPhotoId)
  const selectPhoto = usePhotosStore((s) => s.selectPhoto)
  const zoom = usePhotosStore((s) => s.zoom)
  const nudgeZoom = usePhotosStore((s) => s.nudgeZoom)
  const snapZoom = usePhotosStore((s) => s.snapZoom)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isPinchingRef = useRef(false)

  /* Wire up trackpad-pinch / Ctrl+wheel zoom. We attach the native event
   * directly (rather than React's `onWheel`) so we can register with
   * `{ passive: false }` and call `preventDefault()` — React's synthetic
   * wheel handler is passive by default and silently no-ops preventDefault.
   * Each tick translates `deltaY` into a fractional zoom delta and pipes it
   * through the store's `nudgeZoom`, giving a continuous (sub-stop) scale
   * that tracks the gesture. When the gesture ends (no wheel events for
   * `PINCH_END_DEBOUNCE_MS`), we call `snapZoom` so the resting state is
   * always one of the 5 defined integer stops — pinch is smooth during the
   * gesture, detent-clean once released, and the existing height/gap
   * transitions animate the snap (since `isPinchingRef` flips back to
   * false, re-enabling the 220 ms row transitions). */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const PINCH_END_DEBOUNCE_MS = 160
    let pinchEndTimer: number | null = null
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return // plain scroll: let the container scroll normally
      e.preventDefault()
      // Mark active so we can suppress the row-height CSS transition (the
      // transition is for *toolbar* steps and snap-on-release; during the
      // pinch itself we want the height to follow the gesture frame-by-frame
      // with zero lag).
      isPinchingRef.current = true
      if (pinchEndTimer != null) window.clearTimeout(pinchEndTimer)
      pinchEndTimer = window.setTimeout(() => {
        isPinchingRef.current = false
        snapZoom()
      }, PINCH_END_DEBOUNCE_MS)
      // Pinch apart → deltaY < 0 → zoom in.
      // Pinch together → deltaY > 0 → zoom out.
      nudgeZoom(-e.deltaY / PINCH_DELTA_PER_UNIT)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (pinchEndTimer != null) window.clearTimeout(pinchEndTimer)
    }
  }, [nudgeZoom, snapZoom])

  const filteredPhotos = filterPhotosBySection(photos, selectedSection)
  const isEmpty = filteredPhotos.length === 0

  /* `rowHeight` interpolates continuously between stops so a pinch has
   * frame-by-frame visual feedback. Packing decisions (`TARGET_RATIO_SUM`,
   * `FIXED_PER_ROW`, `isSquareMode`) use the *snapped* integer zoom so the
   * row composition only re-flows at the midpoint between stops, not on
   * every gesture frame. */
  const snappedZoom = Math.round(zoom)
  const rowHeight = interpolateRowHeight(zoom)
  const isSquareMode = snappedZoom <= 1
  /* Gap scales with row height so density-vs-spacing feels consistent. */
  const photoGap = isSquareMode ? 0 : Math.max(2, rowHeight * 0.08)
  const FIXED_PER_ROW = snappedZoom >= 5 ? 2 : null
  const TARGET_RATIO_SUM = RATIO_SUM_BY_ZOOM[snappedZoom - 1]
  const containerWidth = 0

  type Row = {
    items: typeof filteredPhotos
    ratios: number[]
    totalRatio: number
  }
  const rows: Row[] = []
  let current: Row = { items: [], ratios: [], totalRatio: 0 }
  for (const p of filteredPhotos) {
    const r = p.width / p.height
    current.items.push(p)
    current.ratios.push(r)
    current.totalRatio += r
    const shouldBreak =
      FIXED_PER_ROW != null
        ? current.items.length >= FIXED_PER_ROW
        : current.totalRatio >= TARGET_RATIO_SUM
    if (shouldBreak) {
      rows.push(current)
      current = { items: [], ratios: [], totalRatio: 0 }
    }
  }
  if (current.items.length > 0) rows.push(current)

  // Reference container width unused at runtime but useful to silence TS
  void containerWidth

  const photoCount = filteredPhotos.filter((p) => !p.isVideo).length
  const videoCount = filteredPhotos.filter((p) => p.isVideo).length

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="photos-grid-scroll min-h-0 flex-1 overflow-y-auto"
        style={{
          // Drives `::-webkit-scrollbar-track`/`-thumb` margin-top/bottom in
          // index.css so the visible scrollbar starts below the floating
          // toolbar and stops above the floating footer instead of running
          // behind either. paddingTop / paddingBottom still push the first
          // and last photo rows clear of the floating chrome — only the
          // scrollbar gutter is inset.
          ['--photos-scrollbar-inset-top' as any]: `${topInset}px`,
          ['--photos-scrollbar-inset-bottom' as any]: `${FOOTER_H}px`,
          paddingTop: topInset + 4,
          paddingBottom: FOOTER_H + 4,
          // Horizontal insets come from `scrollbar-gutter: stable both-edges`
          // in index.css, not paddingLeft/Right — that way the gutter on the
          // right (which houses the scrollbar when it appears) is mirrored
          // by an identical empty gutter on the left, so the photo grid is
          // visually centered regardless of whether the scrollbar is
          // currently showing.
        }}
      >
        {isEmpty && (
          <div
            className="flex h-full flex-col items-center justify-center"
            style={{ gap: 4 }}
          >
            <span
              style={{
                fontFamily:
                  '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: 12,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              No Photos
            </span>
          </div>
        )}
        {!isEmpty && isSquareMode && (
          /* Uniform-square contact-sheet grid at the smallest zoom.
           * CSS Grid with `auto-fill` + `1fr` packs as many ≥`rowHeight`
           * columns as fit, then stretches them to consume the full
           * container width — so each row spans edge-to-edge with no
           * leftover gap on the right. `aspect-ratio: 1` on each tile
           * keeps cells square as the column width stretches. Matches
           * macOS Photos.app's "All Photos" smallest-zoom layout. */
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${rowHeight}px, 1fr))`,
              gap: 0,
              alignContent: 'flex-start',
            }}
          >
            {filteredPhotos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                isSelected={photo.id === selectedPhotoId}
                isHovered={photo.id === hoveredId}
                onClick={() => selectPhoto(photo.id)}
                onMouseEnter={() => setHoveredId(photo.id)}
                onMouseLeave={() => setHoveredId(null)}
                square
                style={{ aspectRatio: '1 / 1' }}
              />
            ))}
          </div>
        )}
        {!isEmpty && !isSquareMode && rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="flex"
            style={{
              gap: photoGap,
              marginBottom: photoGap,
              height: rowHeight,
              /* During a trackpad pinch the height + gap already update
               * frame-by-frame with the gesture — a transition there would
               * *lag* behind the user's fingers. Only animate when the zoom
               * value was changed by the toolbar +/- buttons (discrete step). */
              transition: isPinchingRef.current
                ? 'none'
                : 'height 220ms cubic-bezier(0.32, 0.72, 0, 1), gap 220ms cubic-bezier(0.32, 0.72, 0, 1), margin-bottom 220ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {row.items.map((photo, i) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                isSelected={photo.id === selectedPhotoId}
                isHovered={photo.id === hoveredId}
                onClick={() => selectPhoto(photo.id)}
                onMouseEnter={() => setHoveredId(photo.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ flex: row.ratios[i] }}
              />
            ))}
            {/* Spacer item for last incomplete row to keep heights consistent */}
            {row.totalRatio < TARGET_RATIO_SUM && rowIdx === rows.length - 1 && (
              <div style={{ flex: TARGET_RATIO_SUM - row.totalRatio, minWidth: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Floating photo / video count footer. Absolutely positioned at the
          bottom of the grid so photos scroll *behind* it (matching the
          floating toolbar at the top). Frost material mirrors the toolbar's
          backing strip; top edge dissolves via a mask gradient so the band
          fades into the scrolling photo content above instead of cutting
          with a hairline. The visible scrollbar stops at the footer's top
          edge thanks to `--photos-scrollbar-inset-bottom` set on the
          scroll container. */}
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: 0,
          left: 0,
          right: 0,
          height: FOOTER_H,
          zIndex: 15,
        }}
      >
        {/* Frost backing — masked separately from the text so the top fade
            doesn't dim the label. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: 'rgba(28, 28, 30, 0.50)',
            backdropFilter: 'blur(30px) saturate(160%)',
            WebkitBackdropFilter: 'blur(30px) saturate(160%)',
            boxShadow: 'inset 0 -0.5px 0 rgba(255, 255, 255, 0.06)',
            maskImage:
              'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 18px), rgba(0,0,0,0.7) calc(100% - 6px), rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 18px), rgba(0,0,0,0.7) calc(100% - 6px), rgba(0,0,0,0) 100%)',
          }}
        />
        {/* Text layer — sits on top of the frost, unaffected by the mask. */}
        <div className="relative flex h-full items-center justify-center">
          <span
            style={{
              fontFamily:
                '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: 0.3,
              color: 'rgba(255,255,255,0.99)',
            }}
          >
            {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
            {videoCount > 0 &&
              `, ${videoCount} ${videoCount === 1 ? 'Video' : 'Videos'}`}
          </span>
        </div>
      </div>
    </div>
  )
}
