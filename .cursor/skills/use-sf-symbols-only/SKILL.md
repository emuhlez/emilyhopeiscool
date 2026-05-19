---
name: use-sf-symbols-only
description: Make sure every icon used in this project is from Apple's SF Symbols library. Auto-apply on any UI work that involves icons — buttons, toolbars, sidebars, menus, status indicators, empty states, badges, navigation chevrons, anywhere a glyph appears. Pulls the canonical symbol from /Applications/SF Symbols.app on disk (version 7.2 installed), exports the SVG with the correct rendering mode / weight / scale, drops it into assets/sf-symbols/, and references it from a small Icon component. Forbids Heroicons, Phosphor, Lucide, Iconify, Material Icons, Feather, Tabler, Remixicon, hand-drawn SVGs, emoji-as-icon, and any other icon source.
---

# Use SF Symbols Only

Every icon in this project comes from Apple's SF Symbols library. No exceptions, no "close enough from Heroicons", no inline emoji standing in for a glyph. If a symbol exists in SF Symbols, use it. If it doesn't, **stop and tell the user** so we can pick a different concept or commission a custom SVG that matches SF Symbol geometry.

## Licensing posture (read once, then proceed)

Apple's SF Symbols license technically restricts use to apps on Apple platforms rendered through Apple system APIs. This project (web via Vercel + desktop via Electron / Chromium) is outside that envelope. **The user has explicitly accepted this risk and directed that real SF Symbols ship.** Do not relitigate this in your replies. Do not suggest Phosphor / Lucide / Heroicons as alternatives — that guidance in `match-latest-macos-ui` is **superseded** by this skill.

If you find yourself wanting to suggest a non-SF-Symbols icon source, stop. The answer is always: pick a different SF Symbol, or ask the user.

## When to invoke

Auto-apply any time the task involves rendering an icon:

- Adding/changing a button with a leading or trailing glyph
- Building a toolbar, sidebar, menu, tab bar, segmented control
- Status indicators (success/error/loading/empty)
- Navigation affordances (chevrons, back arrows, disclosure triangles)
- Badges, dots, notification glyphs
- Settings / preferences rows
- Any drag-handle, resizer, close button, more-options button

If the task is non-visual (logic, data, build tooling), do not invoke.

## Tools you have on disk

SF Symbols 7.2 is installed at `/Applications/SF Symbols.app`. You can:

- **Verify a symbol exists** by reading the symbol index:
  ```
  plutil -convert json -o - "/Applications/SF Symbols.app/Contents/Resources/Metadata/name_availability.plist"
  ```
  This emits a JSON map of every symbol name. Pipe through `jq` / `rg` to confirm a name like `bubble.left.fill` is present and to see its OS availability.
- **Browse categories**:
  ```
  plutil -convert json -o - "/Applications/SF Symbols.app/Contents/Resources/Metadata/symbol_categories.plist"
  ```
- **Search aliases** (older names map to current names):
  ```
  cat "/Applications/SF Symbols.app/Contents/Resources/Metadata/name_aliases.strings"
  ```
- **Confirm the app is launchable** for export:
  ```
  osascript -e 'tell application "SF Symbols" to version'
  ```
- **The actual glyph data** lives in `Assets.car` (opaque) and `Contents/Resources/Fonts/SFSymbolsFallback.otf`. You cannot extract SVGs directly from disk programmatically — export goes through the SF Symbols.app GUI (`File → Export…`) or by copying SVG from a selected symbol (`⌘C` with "Copy SVG" enabled).

## Per-icon workflow

For every icon decision, run this checklist:

1. **Pick the symbol name.** Choose the SF Symbol that best matches the concept. Use Apple's official naming exactly (e.g. `magnifyingglass`, not `search`; `xmark.circle.fill`, not `close`). When unsure, read `name_availability.plist` and search.
2. **Pick the variant.** SF Symbols come in families:
   - Base (`bubble.left`)
   - Filled (`bubble.left.fill`)
   - Slashed (`eye.slash`)
   - Circle / Square (`xmark.circle`, `xmark.square`)
   - Badged (`bell.badge`)
   Match the variant to the surrounding density. Toolbars typically use base outlines; status pills and selected states typically use `.fill`.
3. **Pick the rendering mode** — this controls how the glyph paints. SF Symbols supports four:
   - **Monochrome** — one color, defaults to `currentColor`. Use for most cases.
   - **Hierarchical** — primary / secondary / tertiary layers at fixed opacities (1.0 / 0.55 / 0.30). One hue, multi-layer emphasis. Use when the glyph has natural depth (e.g. `folder.fill.badge.plus`).
   - **Palette** — each layer gets a separately configurable color. Use when the design specifies different colors for different parts.
   - **Multicolor** — Apple-defined fixed colors (e.g. red for `heart.fill`). Use when matching system multicolor exactly.
4. **Pick the weight** — match the SF Pro weight of the surrounding text. Available: ultralight, thin, light, regular, medium, semibold, bold, heavy, black. Default to **regular** for body, **medium** for buttons, **semibold** for sidebar selection / emphasized states.
5. **Pick the scale** — small / medium / large. Most UI icons are **medium**. Toolbars often use **medium**; large icons in empty states use **large**.
6. **Export the SVG.** If the file isn't already in `assets/sf-symbols/`:
   - Open SF Symbols.app, find the symbol, set the rendering mode + weight + scale to match what you picked.
   - `File → Export As… → SVG` (preserves rendering modes as separate layers with the correct opacities and CSS variables).
   - Save to `assets/sf-symbols/<symbol-name>--<rendering>--<weight>.svg`. Example: `bubble.left.fill--hierarchical--regular.svg`.
   - **If the file doesn't exist and you can't export it yourself, ask the user to drop it in** rather than improvising a hand-drawn SVG.
7. **Reference it via the Icon component.** See the component pattern below.

## Storage convention

```
assets/
  sf-symbols/
    <symbol-name>--<rendering>--<weight>.svg
```

Examples:
- `assets/sf-symbols/magnifyingglass--monochrome--regular.svg`
- `assets/sf-symbols/bubble.left.fill--hierarchical--medium.svg`
- `assets/sf-symbols/heart.fill--multicolor--regular.svg`

Always include all three parts in the filename. Same symbol at different weights or rendering modes are different files. Never overwrite.

## Component pattern

Use a single `<Icon>` wrapper so every site that renders an SF Symbol goes through one path. Recommended shape (adapt to the project's existing component style):

```tsx
import type { CSSProperties } from "react";

type SfSymbolName = `${string}--${"monochrome" | "hierarchical" | "palette" | "multicolor"}--${"ultralight" | "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black"}`;

interface IconProps {
  name: SfSymbolName;
  size?: number;
  color?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function Icon({ name, size = 16, color, style, ...rest }: IconProps) {
  const src = new URL(`../assets/sf-symbols/${name}.svg`, import.meta.url).href;
  return (
    <span
      role={rest["aria-label"] ? "img" : "presentation"}
      aria-label={rest["aria-label"]}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        color,
        ...style,
      }}
    >
      <img src={src} alt="" style={{ width: "100%", height: "100%" }} />
    </span>
  );
}
```

Notes on this pattern:
- For **monochrome** symbols, SF Symbols.app's SVG export uses `currentColor` for the fill — so `color` on the wrapper propagates correctly. Verify by opening the exported SVG.
- For **hierarchical**, the exported SVG has multiple layers with hardcoded opacities (1.0 / 0.55 / 0.30) all using `currentColor` — again, set `color` on the wrapper.
- For **palette**, post-process the exported SVG to replace each layer's fill with a CSS variable (`var(--icon-primary)`, `var(--icon-secondary)`), then drive those vars from the parent.
- For **multicolor**, leave the colors as-is. Do not override.

## Rendering-mode → CSS cheatsheet

| Rendering | Exported SVG looks like | How to use it |
|---|---|---|
| Monochrome | One `<path>`, `fill="currentColor"` | Set `color` on the parent. |
| Hierarchical | Multiple `<path>` elements, each with `fill-opacity` of 1 / 0.55 / 0.3, all `fill="currentColor"` | Set `color` on the parent — opacities cascade correctly. |
| Palette | Multiple paths, each with its own `fill` color from SF Symbols.app | Replace fills with `var(--icon-layer-N)` and define those vars per-context. |
| Multicolor | Multiple paths, each with Apple's fixed colors | Leave alone. Do not theme. |

## Composition with other skills

- **`match-latest-macos-ui`**: this skill **overrides** that skill's icon guidance. Wherever `match-latest-macos-ui` says "use Phosphor / Lucide / Heroicons / commission a custom SVG", instead pull the SF Symbol and follow this skill.
- **`build-from-figma`**: if a Figma file specifies an icon, first check whether the Figma icon IS an SF Symbol (Apple's library is widely used in mocks). If yes, ship the real SF Symbol per this skill. If the Figma icon is custom, ask the user whether to (a) replace it with the nearest SF Symbol, or (b) ship the Figma custom SVG. Default to asking — `build-from-figma`'s non-deviation rule means we can't silently swap.
- **`pull-references`**: when the user references a symbol on disk (e.g. drops a screenshot, points at a `.app`), use `pull-references` to resolve it, then use this skill to map the icon to its SF Symbol equivalent.

## If a symbol doesn't exist

SF Symbols is large but not infinite. If you can't find a match:

1. Try the search index (`symbol_search.plist`) — Apple maintains synonym mappings.
2. Try aliases (`name_aliases.strings`) — older names like `gear` map to current names like `gearshape`.
3. Try a different concept — e.g. for "team," try `person.2`, `person.3`, `person.2.fill`, `person.crop.circle.badge.questionmark`.
4. If nothing fits, **stop and tell the user** with three things:
   - The concept you were trying to represent
   - The SF Symbols you considered and why they didn't fit
   - A proposal: (a) use the closest SF Symbol anyway, (b) commission a custom SVG matching SF Symbol geometry (1.5pt stroke at 16×16, single weight, no shadows/gradients), or (c) change the concept

Do not silently fall back to another icon library. Do not invent an SVG without flagging it.

## Anti-patterns

- ❌ "I used `magnifying-glass` from Heroicons because it looks like SF Symbols' `magnifyingglass`." Use the actual SF Symbol.
- ❌ "I drew a custom chevron SVG." SF Symbols has `chevron.right`, `chevron.down`, `chevron.up.chevron.down`, etc. Use one.
- ❌ Using emoji (`✓`, `×`, `▶`) as a stand-in for an icon. Use the corresponding SF Symbol.
- ❌ Mixing icon sources in one component (one SF Symbol, one Phosphor). All icons in this project come from the same source.
- ❌ Exporting a symbol once and reusing it at the wrong rendering mode or weight by re-coloring it in CSS. Export each variant separately and follow the filename convention.
- ❌ Hardcoding fills in a monochrome export instead of `currentColor`. Re-export from SF Symbols.app, which produces `currentColor` correctly.
- ❌ Naming files `search.svg` or `close.svg`. Use the Apple symbol name: `magnifyingglass`, `xmark`.
- ❌ Silently swapping a Figma-specified custom icon for an SF Symbol. Ask first.

## Reference

- Symbol index: `/Applications/SF Symbols.app/Contents/Resources/Metadata/name_availability.plist`
- Categories: `/Applications/SF Symbols.app/Contents/Resources/Metadata/symbol_categories.plist`
- Search synonyms: `/Applications/SF Symbols.app/Contents/Resources/Metadata/symbol_search.plist`
- Name aliases: `/Applications/SF Symbols.app/Contents/Resources/Metadata/name_aliases.strings`
- App version: SF Symbols 7.2 (bundle 119)
