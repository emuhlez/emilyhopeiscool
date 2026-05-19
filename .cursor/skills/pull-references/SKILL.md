---
name: pull-references
description: Resolve and read external reference material — sibling repos and folders on disk, macOS application bundles (e.g. /Applications/SF Symbols.app, /System/Applications/Photos.app), design files and screenshots, and web docs (Apple HIG, MDN, vendor documentation) — and feed them back into the implementation as concrete constraints. Use when the user asks to build, clone, match, replicate, mirror, port, or design "like" or "from" something outside the current workspace; references a `.app`, "SF Symbols", "Apple Photos", "Finder", "macOS native"; pastes a path outside the repo; or provides a screenshot / Figma / image to match.
---

# Pull References

This skill teaches the agent how to ground UI/feature work in **authoritative external sources** instead of guessing. The current workspace is rarely self-contained — designs live in screenshots, system behavior lives in `.app` bundles, and conventions live in vendor docs. Before writing code that "looks like X", read X.

## When to invoke

Auto-apply this skill whenever the user's request includes ANY of:

- A verb like **build / clone / match / replicate / mirror / port / design like / pull from / reference**
- A proper noun for an external system: **SF Symbols, Apple Photos, Finder, Music, Notes, Mail, Safari, Xcode, Figma, MDN, Apple HIG**
- A path outside the repo: `/Applications/...`, `/System/...`, `~/Desktop/...`, `~/Downloads/...`, another sibling repo path
- An attached image, screenshot, or "REFERENCE" callout
- The phrase **"do not deviate"** — this is a hard signal to consult the source before editing

If none of the above apply, do NOT invoke this skill. Reading external material has a token cost; only do it when grounding is required.

## Workflow

Follow these phases in order. Don't skip ahead.

### 1. Identify the source

Classify what you've been pointed at into one of four buckets and use the resolver below:

| Source type | Resolver |
|---|---|
| Sibling repo / on-disk folder | Use `Glob` / `Shell ls` to confirm the path. Search inside with `Grep` / `Glob` / `Read`. |
| macOS application bundle (`.app`) | Use `Shell` to inspect `Contents/` — see "macOS app bundles" below. |
| Design file / screenshot | If attached, it's already in `assets/`. If on disk, ask the user to drop it in (binary `.fig`/`.sketch` cannot be read). For PNG/JPG/WebP/PDF, `Read` works directly. |
| Web doc / URL | Use `WebFetch` for a specific URL, `WebSearch` only if you don't have one. |

If you can't resolve the source after one attempt, **stop and ask the user** rather than fabricating details.

### 2. Extract concrete constraints

Read the source with the goal of producing a short bulleted list of **measurable** constraints:
- exact colors / opacities
- exact stroke widths, corner radii, padding
- exact iconography (filled vs outline, hierarchical layers)
- exact copy / labels / ordering
- behavioral details (hover, selection, empty state)

Do not paraphrase loosely. If the reference says "white at two opacities for hierarchy", capture both opacities, not "kinda gray".

### 3. Apply with fidelity

When implementing, prefer the reference's exact values over inventing new ones. If you must deviate (e.g. a fully-white rectangle would hide a white play triangle), call it out in your reply with the reason.

### 4. Cite the source in your reply

End your reply with a one-line "Reference:" pointer so the user can verify, e.g.:

> Reference: `/Applications/SF Symbols.app` → "video.fill" (hierarchical, primary white, secondary 0.55).

---

## Source playbooks

### Sibling repos & on-disk folders

```
ls ~/projects                            # discover candidates
ls -la <path>                            # confirm shape
```

Then use `Glob` and `Grep` scoped to that absolute path. Treat read-only — never write outside the current workspace unless the user explicitly asks.

Common search patterns:
- "How does project X style its sidebar?" → `Grep -t tsx 'sidebar' <path>`
- "Reuse the auth helper from project Y" → `Glob "**/auth*" --target <path>` then `Read`.

### macOS app bundles

`.app` directories are folders. The agent CAN read most of their contents.

Inspect structure first:

```
ls -la "/Applications/SF Symbols.app/Contents/"
ls -la "/Applications/SF Symbols.app/Contents/Resources" | head
```

Useful artifacts:
- `Contents/Info.plist` — bundle metadata, version (read with `plutil -p`)
- `Contents/Resources/*.icns` and `*.png` / `*.svg` / `*.pdf` — icon assets
- `Contents/Resources/Assets.car` — compiled asset catalog (NOT directly readable; treat as opaque)
- `Contents/Resources/*.strings` — localized copy
- `Contents/Resources/*.nib` / `.storyboardc` — compiled UI (opaque)

Concrete examples:

```
# SF Symbols catalog metadata
plutil -p "/Applications/SF Symbols.app/Contents/Info.plist"

# List icon assets shipping with Photos
ls "/System/Applications/Photos.app/Contents/Resources" | rg -i 'icon|symbol' | head

# Pull native window chrome reference
ls "/System/Library/CoreServices/Finder.app/Contents/Resources" | head
```

If the reference is a **rendered visual** (e.g. "match SF Symbols' rendering of `heart.fill`"), and the asset is locked inside `Assets.car`, ask the user for a screenshot rather than guessing.

#### SF Symbols specifically

When the user says "match SF Symbols", the constraint set is:
- **Monochrome by default** — single white, no brand color tints in the glyph itself.
- **Hierarchical rendering** — primary at full opacity, secondary at ~0.55, tertiary at ~0.30.
- **Stroke widths** scale with weight (ultralight → black). At a 16×16 viewBox, default stroke ≈ 1.1–1.3.
- **No drop shadows, no gradients** within the glyph.
- Colored backgrounds (e.g. red rounded rect behind a play icon) are an SF Symbols *configuration* (palette / multicolor), but the **default and hierarchical** modes are monochrome — confirm which mode the user wants before adding color.

### Design files & screenshots

If the user attached an image, read it directly with `Read`. Look for:
- exact text strings (use them verbatim)
- pixel measurements you can infer (compare to known elements like traffic lights = 12px)
- color values (eyeball is fine for ambient, but state hex/rgba in your output)
- ordering of items in lists/sidebars/menus

If the user references a Figma file by URL and the `user-figma` MCP is available, use it. Otherwise ask for an exported PNG.

### Web docs & vendor URLs

- **Specific URL given** → `WebFetch` it directly. Don't re-search.
- **Topic only** → `WebSearch` with the current year, then `WebFetch` the top authoritative result (apple.com, developer.mozilla.org, vendor docs).
- **Apple HIG** lives at `https://developer.apple.com/design/human-interface-guidelines/...` — prefer this over third-party blog posts.
- Treat blog posts as low-confidence. Cross-check with primary sources.

---

## Output expectations

When this skill is active, your reply should:

1. **State what you read** before what you wrote ("I read `/Applications/SF Symbols.app/Contents/Info.plist` and the Apple HIG sidebar page; here's what changed.").
2. **List the extracted constraints** as a short bullet list.
3. **Note any deviations** with a reason.
4. **End with `Reference:`** pointing back to the source.

## Anti-patterns

- ❌ Implementing "macOS-style" without opening any macOS source.
- ❌ Reading binary `Assets.car` / `.nib` / `.storyboardc` and quoting made-up contents.
- ❌ Summarizing a screenshot as "modern dark UI" instead of extracting concrete measurements.
- ❌ Writing files into a sibling repo or system path. Read-only outside the workspace unless explicitly told otherwise.
- ❌ `WebSearch`-ing when the user already gave you a URL — `WebFetch` it.
- ❌ Skipping the source read because "I already know what SF Symbols looks like." Confirm, don't recall.
