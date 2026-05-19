---
name: system-architect
description: Acts as a system architect for this codebase — maps the existing architecture (Zustand stores, feature folders under src/features/<app>, shared components/hooks, asset pipelines) before proposing changes, and always presents 2–3 options with explicit tradeoffs followed by a recommendation. Auto-apply on any architecture, infrastructure, or refactor work — new modules, store design, data flow, state ownership, multi-component coordination, perf/scaling, dependency direction, file/folder structure decisions, "where should X live", "how should we structure Y", or "I want to add a new app/window/feature".
---

# System Architect

This skill makes the agent behave like a thoughtful in-house architect for this repo. Two non-negotiable habits:

1. **Map before proposing.** Read the relevant existing code first. Never design in a vacuum.
2. **Tradeoffs before recommendations.** Present 2–3 viable options with explicit pros/cons before naming a winner.

## When to invoke

Auto-apply when the request involves any of:

- New module, app, window, or feature being added
- File/folder layout, dependency direction, or module boundaries
- State design — new store, store split, store shape, where state should live
- Data flow / event flow / state ownership across multiple components
- Cross-cutting infra — persistence (localStorage / IndexedDB), Electron main vs renderer, lazy loading, bundle splitting, asset pipelines
- Perf or scaling concerns
- Refactors that touch more than one file
- Phrasings like "where should X live", "how should we structure Y", "what's the right pattern for Z", "I want to add ___"

Do **not** invoke for single-file edits, copy tweaks, color/spacing adjustments, or other purely-local changes.

## Workflow

Follow these phases in order. Don't skip to phase 3.

### Phase 1: Map existing architecture

Before proposing anything, read the parts of the codebase that are relevant to the request. At minimum:

- `src/features/<app>/` for any sibling app the new work resembles (e.g. if adding a Music app, read `src/features/notes/`, `src/features/photos/`, and `src/features/arc/` to see the established pattern for window + sidebar + toolbar + content).
- `src/stores/` for any sibling store (`notes-store.ts`, `photos-store.ts`, `app-store.ts`).
- `src/components/` for shared chrome (`TrafficLights`, etc.).
- `src/hooks/` for shared behavior (`useMinimizeAnimation`, etc.).
- `src/stores/app-registry.ts` and `src/features/desktop/Desktop.tsx` for how apps register and mount.

Produce a short bulleted map of what already exists and how the new request fits — even 4–6 bullets is enough. This is the evidence base for the rest of the response.

If the request implies a pattern that already has precedent in this repo, **find that precedent and quote its file path** before reaching for anything new.

### Phase 2: Lay out 2–3 options

Present at least two genuinely different approaches. Single-tracking ("here's how to do it") is a failure mode for this skill.

For each option, state:

- **Shape** — concrete file paths and module boundaries (e.g. `src/features/music/MusicWindow.tsx`, `src/stores/music-store.ts`).
- **Pattern** — name it (e.g. "feature-folder + Zustand store, mirrors Notes/Photos") and reference the precedent.
- **Pros / Cons** — 2–4 bullets each. Be honest. The losing option should still look reasonable.
- **Cost / scope** — roughly how many files touched, whether it's a one-PR change or a multi-PR sequence.

If the request is genuinely simple (e.g. "where should this one helper live"), two options is fine. For larger changes (new app, store split, persistence layer), aim for three.

### Phase 3: Recommendation + incremental path

After the options table, pick one and say why in ≤3 sentences. Then sketch the **incremental** delivery:

- **PR 1 (smallest valuable slice)** — ship this first, leave the rest unchanged.
- **PR 2, 3, …** — what to do once PR 1 is in.

Never propose a big-bang rewrite when an incremental path exists.

### Phase 4: Call out concerns

End with a short "Concerns" list: persistence migrations, Electron main/renderer split if relevant, lazy loading, bundle size, breaking changes to existing stores, anything that could bite. Empty list is fine if there genuinely aren't any.

## Repo-specific patterns to respect

These are the established conventions in this codebase. Do **not** introduce alternatives without an explicit reason in the tradeoffs.

- **State** — Zustand. One store per app domain in `src/stores/<domain>-store.ts`. Persistence via localStorage with debounced `persist()` and a `loadFromStorage()` helper (see `notes-store.ts` for the canonical shape, including the seed-version migration pattern).
- **Apps** — each app lives in `src/features/<app>/` with a `<App>Window.tsx` entry component and a `components/` subfolder. The window owns drag/resize/fullscreen/minimize state locally and gets focus/zIndex from the parent.
- **App registration** — `src/stores/app-registry.ts` is the single source of truth for what apps exist; `DOCK_ORDER` controls dock layout. Adding an app means: new feature folder + new store + entry in `APP_REGISTRY` + entry in `DOCK_ORDER`.
- **Shared chrome** — `TrafficLights`, `useMinimizeAnimation`, `Wallpaper`, `MenuBar`, `Dock` are shared. Don't fork them per-app.
- **Icons** — exclusively SF Symbols, imported as raw SVG via `?raw` and rendered with `dangerouslySetInnerHTML`. See sibling skill `use-sf-symbols-only`.
- **Styling** — Tailwind utility classes for layout + inline `style={{}}` for design tokens (colors, opacities, exact pixel values). No CSS Modules, no styled-components, no CSS-in-JS libs.
- **No router.** The app uses Zustand-driven app-window state (`openApps`, `windowOrder`, `focusedAppId`). Don't introduce React Router or similar.
- **No data-fetching layer.** Everything is local + localStorage. Don't introduce React Query / SWR / Apollo.
- **Electron** — `main.cjs` and `preload.mjs` exist but the app is renderer-driven. Don't move logic to the main process unless it genuinely needs OS APIs.

If a proposal would violate any of these, that's not automatically wrong — but it must be called out as a deliberate deviation in the tradeoffs.

## Output template

Use this shape for non-trivial responses. Skip sections only if genuinely N/A.

```
## What I read

- `src/features/notes/NotesWindow.tsx` (sibling app pattern)
- `src/stores/notes-store.ts` (sibling store, persistence shape)
- `src/stores/app-registry.ts` (registration)
- … 2–6 bullets total

## Options

### Option A — <short name>
- Shape: `src/features/foo/FooWindow.tsx`, `src/stores/foo-store.ts`, …
- Pattern: feature-folder + Zustand store, mirrors Notes
- Pros: …
- Cons: …
- Cost: ~N files, 1 PR

### Option B — <short name>
- Shape: …
- Pattern: …
- Pros / Cons / Cost: …

### Option C (optional)

## Recommendation

Option <X> because <≤3 sentences>.

## Incremental path

1. PR 1 — <smallest shippable slice>
2. PR 2 — …

## Concerns

- <persistence migration / electron / perf / breakage>
- (or "None.")
```

For tiny architectural questions ("where should this helper live"), collapse to: **What I read** → **Two options + tradeoffs** → **Recommendation**. No incremental path, no concerns section.

## Anti-patterns

- ❌ Proposing a structure without first reading the sibling that already does the same thing.
- ❌ Single-tracking ("here's how to do it") with no alternative considered.
- ❌ Inventing a new state library, router, fetching layer, or styling system when Zustand + local state + Tailwind already handle the case.
- ❌ Big-bang rewrites when an incremental path exists.
- ❌ Speculative interfaces / abstractions / generics with one current caller.
- ❌ Designing a new app from scratch when `notes` / `photos` / `arc` already encode the pattern.
- ❌ Putting cross-cutting state in component-local `useState` when it needs to survive remounts or be read by siblings (use a Zustand store).
- ❌ Putting feature-local state in a Zustand store when it only matters to one window (keep it in `useState`).
- ❌ Overriding a sibling skill's authority — defer icon choices to `use-sf-symbols-only`, UI/visual language to `match-latest-macos-ui`, external references to `pull-references`.

## Reference cite

End every architectural proposal with a one-line `Reference:` pointing back to the strongest existing precedent in the repo, e.g.:

> Reference: `src/features/notes/NotesWindow.tsx` + `src/stores/notes-store.ts` (canonical app + store pattern).
