import type { CSSProperties, PropsWithChildren } from 'react'
import { Children, Fragment, useState } from 'react'
import { TrafficLights } from '../../../components/TrafficLights'
import sidebarLeftMediumSvg from '../../../../assets/sf-symbols/sidebar.left--monochrome--medium.svg?raw'

/**
 * PhotosSidebarHeader
 *
 * Owns the chrome that visually belongs to the sidebar zone of the Photos window:
 * the traffic lights and the sidebar-toggle button. Decoupled from PhotosToolbar so
 * the two regions (sidebar header vs. content header) can be positioned, styled, and
 * dragged independently.
 *
 * Positioned absolutely at the top-left of the window. When the sidebar is visible,
 * the toggle button hugs the sidebar's inner-right edge; when collapsed, the toggle
 * floats just after the traffic lights as a standalone glass chip.
 */

const TOOLBAR_H = 64
const TRAFFIC_LIGHT_DOT = 12
const TRAFFIC_LIGHT_GAP = 8
const TRAFFIC_LEFT_INSET = 20
/** Width of the traffic-lights cluster: 3 dots + 2 inter-dot gaps. */
const TRAFFIC_BLOCK_WIDTH = TRAFFIC_LIGHT_DOT * 3 + TRAFFIC_LIGHT_GAP * 2
/** X position immediately after the traffic-lights cluster. */
const TRAFFIC_BLOCK_END = TRAFFIC_LEFT_INSET + TRAFFIC_BLOCK_WIDTH

const TOGGLE_CLUSTER_WIDTH = 46
const SIDEBAR_LEFT_INSET = 10
const SIDEBAR_RIGHT_INSET = 2
/** Static gap between traffic-lights cluster and the toggle chip (and to the
 *  right of the toggle chip) when the sidebar is collapsed. */
const COLLAPSED_TOGGLE_GAP = 8

/**
 * Width of the sidebar-header zone (traffic lights + sidebar-toggle chip)
 * when the sidebar is collapsed. Re-used by `PhotosWindow` to push the
 * toolbar's title plate past this zone, so the `Library` title sits to the
 * right of the toggle chip instead of underneath it.
 */
export const COLLAPSED_HEADER_ZONE_WIDTH =
  TRAFFIC_BLOCK_END + COLLAPSED_TOGGLE_GAP + TOGGLE_CLUSTER_WIDTH + COLLAPSED_TOGGLE_GAP

function GlassCluster({
  children,
  style,
  bare = false,
}: PropsWithChildren<{ style?: CSSProperties; bare?: boolean }>) {
  // Glass branch mirrors PhotosToolbar's GlassCluster tuning (Tahoe Liquid
  // Glass: blur 20 / saturate 180, single 0.5 px top highlight, tight 1+8 px
  // two-stop shadow, lighter 10/5/7 % gradient). Bare branch is intentional —
  // when the sidebar is visible the toggle chip sits inside the sidebar's
  // own glass surface, and a second glass capsule on top would re-create the
  // glass-on-glass stacking we explicitly avoid (see the view-tabs fix).
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // shrink-0 so the sidebar-toggle chip can never be compressed by its
        // flex parent (the header row), matching PhotosToolbar's GlassCluster.
        flexShrink: 0,
        gap: 1,
        padding: '5px 8px',
        borderRadius: 999,
        background: bare
          ? 'transparent'
          : 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.07) 100%)',
        backdropFilter: bare ? undefined : 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: bare ? undefined : 'blur(20px) saturate(180%)',
        boxShadow: bare
          ? undefined
          : 'inset 0 0.5px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 1px 1px rgba(0,0,0,0.18), 0 6px 14px -8px rgba(0,0,0,0.30)',
        filter: bare ? undefined : 'url(#photos-lg-edge)',
        isolation: 'isolate',
        ...style,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {Children.toArray(children).map((child, i) => (
        <Fragment key={i}>{child}</Fragment>
      ))}
    </div>
  )
}

function GlassButton({
  onClick,
  children,
  width = 30,
  height = 30,
}: PropsWithChildren<{ onClick?: () => void; width?: number; height?: number }>) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="flex items-center justify-center"
      style={{
        // Pin the icon button at its full hit target — see the matching note
        // in PhotosToolbar's GlassButton. As a flex child with flex-basis:
        // auto it would otherwise be free to compress below width/height.
        position: 'relative',
        flexShrink: 0,
        width,
        height,
        minWidth: width,
        minHeight: height,
        cursor: 'default',
        color: 'rgba(255,255,255,0.92)',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        aria-hidden
        style={{
          // Hover overlay is structurally pinned to width×height (centered),
          // not derived from the outer box — identical pattern to
          // PhotosToolbar's GlassButton so both 30×30 chips animate the same
          // hover pill regardless of any parent layout pressure.
          position: 'absolute',
          top: '50%',
          left: '50%',
          width,
          height,
          transform: 'translate(-50%, -50%)',
          borderRadius: Math.min(width, height) / 2,
          background: hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
          transition: 'background 140ms ease',
          pointerEvents: 'none',
        }}
      />
      <div className="relative flex items-center justify-center">{children}</div>
    </div>
  )
}

export function PhotosSidebarHeader({
  onDragStart,
  onClose,
  onMinimize,
  onFullscreen,
  onToggleSidebar,
  sidebarCollapsed,
  sidebarWidth,
}: {
  onDragStart: (e: React.PointerEvent) => void
  onClose?: () => void
  onMinimize?: () => void
  onFullscreen?: () => void
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
  sidebarWidth: number
}) {
  /**
   * When the sidebar is visible, anchor the toggle button to the inside-right of the
   * sidebar so traffic lights + toggle visibly sit *within* the sidebar glass.
   * When collapsed, the toggle simply floats after the traffic-lights cluster.
   */
  const toggleAnchoredLeft =
    SIDEBAR_LEFT_INSET + sidebarWidth - SIDEBAR_RIGHT_INSET - TOGGLE_CLUSTER_WIDTH
  const toggleGap = sidebarCollapsed
    ? COLLAPSED_TOGGLE_GAP
    : Math.max(COLLAPSED_TOGGLE_GAP, toggleAnchoredLeft - TRAFFIC_BLOCK_END)

  /**
   * The header zone covers the sidebar's horizontal extent so a click-drag anywhere
   * over the sidebar's top strip moves the window. When the sidebar is collapsed
   * we fall back to a tight zone that just wraps the traffic lights + toggle chip.
   */
  const zoneWidth = sidebarCollapsed
    ? COLLAPSED_HEADER_ZONE_WIDTH
    : SIDEBAR_LEFT_INSET + sidebarWidth

  return (
    // z-30 (above the PhotosToolbar's z-20 drag layer): when the sidebar is
    // collapsed, the toolbar's frosted drag overlay starts at left: 12, which
    // overlaps the traffic-light + toggle zone. Without lifting the header, the
    // toolbar's drag layer would win the overlap (later in the tree, equal z),
    // making close/min/fullscreen and the sidebar-toggle chip drag-the-window
    // instead of fire onClick. Sitting one z-layer above the toolbar gives the
    // header (its drag overlay AND its interactive chips) priority on clicks.
    <div
      className="pointer-events-none absolute left-0 top-0 z-30 flex items-center"
      style={{
        width: zoneWidth,
        height: TOOLBAR_H,
        cursor: 'default',
      }}
    >
      <div
        className="pointer-events-auto absolute inset-0"
        style={{ zIndex: 0 }}
        onPointerDown={onDragStart}
      />

      <div
        className="pointer-events-none relative z-[1] flex h-full w-full min-w-0 items-center"
        style={{ paddingLeft: TRAFFIC_LEFT_INSET }}
      >
        <div
          className="pointer-events-auto flex items-center"
          style={{ gap: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <TrafficLights
            onClose={onClose}
            onMinimize={onMinimize}
            onFullscreen={onFullscreen}
            dotSize={TRAFFIC_LIGHT_DOT}
            gapPx={TRAFFIC_LIGHT_GAP}
          />
        </div>

        <div
          className="pointer-events-auto flex shrink-0 items-center"
          style={{ marginLeft: toggleGap }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <GlassCluster bare={!sidebarCollapsed}>
            <GlassButton width={30} height={30} onClick={onToggleSidebar}>
              <span
                aria-label="Hide or show sidebar"
                className="inline-flex shrink-0 [&>svg]:block"
                style={{ width: 20, height: 20 }}
                dangerouslySetInnerHTML={{ __html: sidebarLeftMediumSvg }}
              />
            </GlassButton>
          </GlassCluster>
        </div>
      </div>
    </div>
  )
}
