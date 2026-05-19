/**
 * Shared drop-shadow stack for floating app windows.
 *
 * Modeled on the macOS Tahoe focused-window shadow: three stacked layers
 * (close contact + mid lift + broad ambient) so the falloff feels like real
 * light spilling onto the wallpaper instead of a single blurry rectangle.
 * A 0.5 px white hairline on the window edge catches light against dark
 * wallpapers and reads as the window's outline.
 *
 * Lives in `src/styles/` so PhotosWindow / NotesWindow / ArcWindow /
 * RobloxStudioWindow can't drift — change the shadow here and every app
 * window updates in lockstep.
 *
 * - `WINDOW_DROP_SHADOW`: outer shadow layers only. Use when the window
 *   already paints its own border (e.g. an inset hairline) and you only
 *   want the outer drop.
 * - `WINDOW_SHADOW`: outer drop + a soft white edge hairline. The default
 *   for app windows on the dark Tahoe wallpaper.
 */

export const WINDOW_DROP_SHADOW =
  '0 1px 2px rgba(0, 0, 0, 0.32), 0 14px 28px -6px rgba(0, 0, 0, 0.45), 0 48px 96px -16px rgba(0, 0, 0, 0.55)'

export const WINDOW_SHADOW = `0 0 0 0.5px rgba(255, 255, 255, 0.08), ${WINDOW_DROP_SHADOW}`
