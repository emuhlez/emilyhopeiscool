# Viewport Tab System

## Context
The viewport currently renders as a single `DockablePanel` with the title "Viewport". The user wants it converted to a tabbed interface so they can switch between a **3D Viewport** tab and a **Scripting** tab, preparing the workspace for multiple contexts.

## Approach
Swap the `DockablePanel` wrapper for the existing `TabbedPanel` component (already in the codebase at `src/components/shared/TabbedPanel.tsx`), which handles tab switching, drag-to-dock, and active tab state out of the box. Create a minimal Scripting placeholder panel for the second tab.

## Files to Modify

### 1. `src/App.tsx`
- Replace the `DockablePanel` wrapping `<Viewport />` with a `TabbedPanel`
- Define two tabs: `{ id: 'viewport', title: '3D Viewport', icon: <Monitor /> }` and `{ id: 'scripting-tab', title: 'Scripting', icon: <Code /> }`
- Provide `tabContents` mapping each tab id to its content (`<Viewport />` and `<ScriptingPanel />`)
- Import `TabbedPanel` from `../shared/TabbedPanel` and `Code` from lucide-react

### 2. Create `src/components/Scripting/ScriptingPanel.tsx`
- Minimal placeholder component with centered text: "Scripting workspace coming soon"
- Styled to fill the tab content area (flex: 1, centered)

### 3. Create `src/components/Scripting/ScriptingPanel.module.css`
- Simple styles: full-height flex container, centered placeholder text, matching app color scheme

## Existing code reused
- `TabbedPanel` (`src/components/shared/TabbedPanel.tsx`) — handles tab bar, active state, drag-to-dock
- `TabHeader` (`src/components/shared/TabHeader.tsx`) — renders tab buttons, single-tab fallback
- `TabHeader.module.css` — tab styling (12px uppercase, active/hover states)

## Verification
1. Run `npm run dev` — no TypeScript or build errors
2. Viewport area should show a tab bar with "3D Viewport" and "Scripting" tabs
3. Clicking "3D Viewport" shows the 3D scene as before
4. Clicking "Scripting" shows the placeholder panel
5. Tab bar matches existing tab styling in the app
