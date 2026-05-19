---
name: match-latest-macos-ui
description: Scrub the web for the latest Apple macOS updates and UI, then implement UI/UX in that current Apple visual and interaction language. Auto-apply on any UI/UX work in this repo — building components, screens, layouts, sidebars, toolbars, menus, sheets, popovers, controls, icons, animations, typography, or visual polish. Pulls the current macOS release's design changes (Liquid Glass, materials, vibrancy, control shapes, SF Symbols updates) from Apple HIG, Apple Newsroom, the macOS release page, and recent WWDC "What's new in design" sessions, and grounds the implementation in those constraints rather than generic web idioms.
---

# Match Latest macOS UI

When doing UI/UX work in this project, that's how I want to implement a lot of this ui and ux — by matching the **current** Apple macOS design language. Don't pattern-match from memory; the language evolves every release (window chrome, materials, control shapes, motion curves, SF Symbols, icon style all shift). Pull the latest, then build to it.

## When to invoke

Auto-apply on any UI/UX task in this repo: new components, screen layouts, sidebars, toolbars, menus, sheets, popovers, controls, form fields, icons, animations, typography, color/material choices, hover/focus/empty/loading states, visual polish passes.

If the task is purely backend, data modeling, build tooling, or non-visual logic, do NOT invoke this skill.

## Caching contract

Reference fetches are **cached per session**. The first time this skill activates in a conversation, do the full freshness sweep below and write the extracted constraints into your reply. For the rest of the session, reuse those constraints — don't re-fetch unless:

- The user says "re-pull" / "refresh references" / "check again"
- A new macOS major version is mentioned that you haven't pulled yet
- You're more than ~24 hours into the same long-running conversation and a reference looks stale

## Phase 1 — Establish the current macOS

Before pulling design specifics, anchor on **which** macOS is current today. Do this once per session.

1. `WebSearch` for `"latest macOS version <current year>"` — use the current year from the system timestamp, not a hardcoded year.
2. From the top result (apple.com/macos or apple.com/newsroom is authoritative; Wikipedia's "macOS version history" is acceptable as a cross-check), confirm:
   - Current macOS name + version number (e.g. "macOS Tahoe 26")
   - Release date / whether it's GA or in developer beta
   - The headline design changes called out in the announcement

Write these three facts at the top of your reply. They're the frame for everything else.

## Phase 2 — Pull the design language

Now fetch the authoritative design sources. Prefer `WebFetch` on specific URLs over `WebSearch` once you know where to look.

| Source | URL pattern | What to extract |
|---|---|---|
| Apple HIG — Foundations | `developer.apple.com/design/human-interface-guidelines/foundations` | Materials, color, typography, motion, layout, accessibility updates for this release |
| Apple HIG — Patterns / Components | `developer.apple.com/design/human-interface-guidelines/<pattern>` | Component-specific specs (sidebars, toolbars, menus, sheets, popovers, etc.) — fetch only the ones relevant to the task |
| Apple Newsroom — macOS announcement | `apple.com/newsroom/<year>/<month>/apple-introduces-macos-<name>/` | Marketing-level summary of design shifts and feature names |
| macOS product page | `apple.com/macos/` or `apple.com/macos/macos-<name>/` | High-res visuals of the current chrome |
| WWDC "What's new in design" | `developer.apple.com/videos/play/wwdc<year>/...` (find via search) | Rationale for the year's design changes, motion specs, material specs |
| SF Symbols release notes | `developer.apple.com/sf-symbols/` + `apple.com/newsroom` searches | New symbols, weight/rendering changes |

For each source you read, extract **concrete, measurable** constraints — not vibes. Examples of the shape:

- Materials: "windowBackground uses Liquid Glass at ~12% tint, ~30px blur, inner highlight at top edge"
- Corner radii: "Standard control radius is 8pt at default size; large is 12pt"
- Typography: "System font is SF Pro; body 13pt / 16pt line-height; sidebar labels 11pt semibold"
- Motion: "Sheet present uses spring(response: 0.5, dampingFraction: 0.85)"
- Icons: "Default rendering is hierarchical; primary fill at 100% / secondary at 55% / tertiary at 30%"
- Sidebar: "Selection pill is solid accent at full opacity, 6pt radius, with white SF Symbol"

If a HIG page contradicts what you recall from older macOS releases, the HIG wins. Flag the change explicitly in your reply (e.g. "HIG now specifies 8pt radius for default controls; older 6pt convention is deprecated for this release.").

## Phase 3 — Map to the implementation stack

This repo is a web app (not a native macOS app), so the constraints translate into CSS / component code, not AppKit / SwiftUI. Translate with these rules:

- **Materials → CSS (default tier)**: `backdrop-filter: blur(<N>px) saturate(<N>%);` plus a translucent fill plus an inner top-edge highlight (e.g. `box-shadow: inset 0 1px 0 rgba(255,255,255,0.3)`). Don't approximate Liquid Glass with a flat color. See the **Material fidelity ladder** below for when this isn't enough.
- **System font**: `font-family: -apple-system, "SF Pro", BlinkMacSystemFont, ...` — use the system stack so macOS users get the real SF Pro.
- **Icons → SF Symbols**: this project ships real SF Symbols. See the `use-sf-symbols-only` skill for the export/storage/rendering-mode workflow. Do not use Phosphor / Lucide / Heroicons or any other icon source.
- **Window chrome**: traffic lights, title-bar tinting, sidebar translucency — replicate visually with CSS, knowing the result is an approximation in a browser context.
- **Motion**: translate spring specs to `cubic-bezier(...)` or framer-motion `spring` configs that produce visually equivalent timing.
- **Accent color**: macOS users set their accent system-wide. If feasible, expose a CSS variable; otherwise pick a default that matches the current macOS marketing accent.

If the codebase already has tokens (Tailwind config, CSS variables, design system primitives), use the ones whose values match the macOS spec. Otherwise, write the exact values inline and flag the missing token.

### Material fidelity ladder

Liquid Glass on macOS Tahoe 26 does more than blur — it also refracts, disperses light at curved edges, and has a specular highlight that responds to motion and content behind it. The browser can't reproduce all of that natively. Decide which tier the surface needs **before** writing code:

| Tier | Use for | Technique |
|---|---|---|
| **1 — CSS approximation** (default) | Sidebars, toolbars, popovers, sheets, menus, hovers, any "ambient" surface | `backdrop-filter: blur() saturate()` + translucent tint + inner edge highlight + 1px translucent border. Fast, ships everywhere. Reads as Liquid Glass at a glance. |
| **2 — SVG filter with displacement** | Signature panels, key controls, anywhere a careful eye will linger | Tier 1 + an `<svg>` `<filter>` chaining `<feGaussianBlur>` and `<feDisplacementMap>` driven by a procedural noise / gradient `<feTurbulence>` to fake edge refraction. Apply via `filter: url(#liquid-glass-edge)`. Watch perf on large surfaces. |
| **3 — WebGL / WebGPU shader** | Hero surfaces, marketing pages, the one "wow" element on a landing screen | Render the surface (and what's behind it) into a `<canvas>` and write a fragment shader that samples the background, applies chromatic dispersion at the edges, a specular highlight that tracks pointer position, and a subtle refraction normal map. Heaviest; use sparingly. Libraries: raw WebGL, ogl, three.js, or a Rive/Lottie pre-baked animation if the surface is mostly static. |

Default to **Tier 1**. Escalate to Tier 2 only when the user calls out a specific hero surface or says the Tier 1 result "looks flat / fake / doesn't feel like glass." Escalate to Tier 3 only when the user explicitly asks for hero-quality or marketing-grade material, or when the surface is clearly the centerpiece of the screen. Always state the tier you chose, and why, in your reply.

When escalating, keep Tier 1 as a fallback under `@supports not (backdrop-filter: blur(1px))` or as a no-WebGL fallback for `<canvas>` — never ship a surface that degrades to a flat rectangle.

## Phase 4 — Implement and report

Build the UI using the extracted constraints. In your reply:

1. List the three anchor facts (current macOS name/version, release status, headline design shifts).
2. List the concrete constraints you extracted, grouped by category (material, typography, motion, iconography, layout).
3. Note any deviations from the macOS spec with the reason (e.g. "Used Phosphor `chat-circle` instead of SF Symbol `bubble.left` — SF Symbols not licensed for web; geometry is closest match.").
4. End with `References:` listing the URLs you fetched, so the user can verify.

## Composition with other skills

- If the user shares a Figma file, `build-from-figma` takes precedence — the Figma spec is the source of truth, and this skill only fills in gaps the Figma doesn't specify.
- If the user provides a screenshot or path into an `.app` bundle, `pull-references` handles the resolution; this skill then provides the broader macOS context.

## Anti-patterns

- ❌ Implementing "macOS-style" from memory of Big Sur / Monterey / Sonoma. The current release is different.
- ❌ Citing "Apple HIG" generically without fetching the specific page for the component you're building.
- ❌ Approximating Liquid Glass / vibrancy with a flat `rgba(255,255,255,0.1)` — implement the blur and the edge highlight.
- ❌ Shipping a hero surface at Tier 1 when the user asked for "real Liquid Glass" — escalate to Tier 2 or 3.
- ❌ Shipping a Tier 3 WebGL material on every sidebar and popover — that's a perf disaster, default to Tier 1.
- ❌ Skipping the no-`backdrop-filter` / no-WebGL fallback and letting a surface degrade to a flat rectangle.
- ❌ Substituting Phosphor / Lucide / Heroicons / Iconify / Material / emoji for an SF Symbol. This project uses real SF Symbols — see `use-sf-symbols-only`.
- ❌ Re-fetching the same HIG pages every turn within one session — cache the constraints into your reply and reuse them.
- ❌ Skipping Phase 1 and writing code grounded in a stale macOS version.
